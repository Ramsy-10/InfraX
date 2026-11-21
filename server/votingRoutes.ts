import { Router, type Request, type Response } from 'express';
import { requireAdminMiddleware } from './adminAuth.ts';
import { getEmailDeliveryStatus, sendVotingOtpEmail } from './mailer.ts';
import {
  addApprovedVoters,
  addInvitedSchool,
  castVerifiedVote,
  checkVoterEligibility,
  computeVotingStatus,
  createOtpChallenge,
  createSubmission,
  deleteApprovedVoter,
  deleteInvitedSchool,
  deleteSubmission,
  getAdminSubmissionsWithScores,
  getPublicSubmissions,
  getSubmissionThumbnail,
  getVoterSessionState,
  getVotingSettings,
  listApprovedVoters,
  listInvitedSchools,
  rollbackOtpChallenge,
  saveSubmissionThumbnail,
  updateInvitedSchool,
  updateSubmission,
  updateVotingSettings,
  verifyOtpAndCreateSession,
  verifySessionCookieValue,
  type EligibilityMode,
} from './votingDb.ts';

const VOTER_COOKIE_NAME = 'infrax_voter_session';

// Sliding-window IP rate limiter
const ipBuckets = new Map<string, number[]>();

function isIpRateLimited(ip: string, maxHits: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (ipBuckets.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= maxHits) {
    ipBuckets.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipBuckets.set(ip, hits);
  return false;
}

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie || '';
  const result: Record<string, string> = {};
  if (!header) return result;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function setVoterCookie(req: Request, res: Response, value: string, maxAgeSeconds: number): void {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';

  const parts = [
    `${VOTER_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearVoterCookie(req: Request, res: Response): void {
  setVoterCookie(req, res, '', 0);
}

function csvCell(val: string | number): string {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const votingRouter = Router();

// ============================================================================
// PUBLIC VOTING ROUTES
// ============================================================================

votingRouter.get('/api/voting/public-state', (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    const settings = getVotingSettings();
    const votingStatus = computeVotingStatus(settings);
    const submissions = getPublicSubmissions();
    const eligibleSchools = listInvitedSchools(true).map((s) => ({
      id: s.id,
      schoolName: s.schoolName,
    }));

    const cookies = parseCookies(req);
    const sessionId = verifySessionCookieValue(cookies[VOTER_COOKIE_NAME]);
    const session = getVoterSessionState(sessionId);

    res.json({
      votingStatus,
      isOpen: votingStatus === 'open',
      opensAt: settings.opensAt,
      closesAt: settings.closesAt,
      eligibilityMode: settings.eligibilityMode,
      theme: settings.theme,
      serverNow: new Date().toISOString(),
      emailServiceConfigured: getEmailDeliveryStatus().configured,
      eligibleSchools,
      submissions,
      session,
    });
  } catch (err) {
    console.error('Public voting state error:', err);
    res.status(503).json({
      error: 'The voting database is temporarily unavailable. Please try again shortly.',
    });
  }
});

votingRouter.get('/api/voting/thumbnails/:thumbId', (req: Request, res: Response) => {
  try {
    const thumb = getSubmissionThumbnail(String(req.params.thumbId || ''));
    if (!thumb) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('Content-Type', thumb.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(thumb.data));
  } catch (err) {
    console.error('Thumbnail fetch error:', err);
    res.status(503).send('Temporarily unavailable');
  }
});

votingRouter.post('/api/voting/request-otp', async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (isIpRateLimited(`otp:${ip}`, 10, 15 * 60 * 1000)) {
    res.status(429).json({
      error: 'Too many verification requests from this connection. Please wait a few minutes.',
    });
    return;
  }

  const settings = getVotingSettings();
  const windowStatus = computeVotingStatus(settings);
  if (windowStatus !== 'open') {
    res.status(403).json({
      error:
        windowStatus === 'upcoming'
          ? 'Short Film public voting has not opened yet.'
          : 'Short Film public voting is currently closed.',
    });
    return;
  }

  const body = (req.body ?? {}) as {
    email?: unknown;
    schoolId?: unknown;
    schoolName?: unknown;
    invitationCode?: unknown;
  };
  const email = typeof body.email === 'string' ? body.email : '';
  const schoolId = typeof body.schoolId === 'string' ? body.schoolId : '';
  const schoolName = typeof body.schoolName === 'string' ? body.schoolName : '';
  const invitationCode = typeof body.invitationCode === 'string' ? body.invitationCode : '';

  const eligibility = checkVoterEligibility({
    email,
    schoolId,
    schoolName,
    invitationCode,
  });
  if (eligibility.ok === false) {
    res.status(eligibility.status ?? 403).json({ error: eligibility.reason });
    return;
  }

  const emailStatus = getEmailDeliveryStatus();
  if (!emailStatus.configured) {
    res.status(503).json({
      error:
        'Email verification delivery is not yet configured on the server. Please contact the InfraX organizing committee.',
    });
    return;
  }

  const challenge = createOtpChallenge({
    email,
    schoolId: eligibility.schoolId,
    schoolName: eligibility.schoolName,
  });

  if (challenge.ok === false) {
    res.status(challenge.status).json({
      error: challenge.reason,
      retryAfterSeconds: challenge.retryAfterSeconds,
    });
    return;
  }

  try {
    await sendVotingOtpEmail({
      toEmail: email.trim().toLowerCase(),
      otpCode: challenge.otpCode,
      schoolName: eligibility.schoolName,
      expiresInMinutes: Math.round(challenge.expiresInSeconds / 60),
    });

    res.json({
      ok: true,
      schoolName: eligibility.schoolName,
      expiresInSeconds: challenge.expiresInSeconds,
      cooldownSeconds: challenge.cooldownSeconds,
    });
  } catch (err) {
    rollbackOtpChallenge(challenge.challengeId);
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Failed to dispatch OTP email:', msg);
    const userMessage = msg.includes('RESEND_DELIVERY_ERROR:')
      ? `Email delivery rejected by Resend (${msg.replace('RESEND_DELIVERY_ERROR:', '').trim()}).`
      : 'Unable to deliver verification email at this moment. Please verify email configuration or try again shortly.';
    res.status(503).json({ error: userMessage });
  }
});

votingRouter.post('/api/voting/verify-otp', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (isIpRateLimited(`verify:${ip}`, 20, 15 * 60 * 1000)) {
    res.status(429).json({
      error: 'Too many verification attempts. Please wait a few minutes and try again.',
    });
    return;
  }

  const settings = getVotingSettings();
  if (computeVotingStatus(settings) !== 'open') {
    res.status(403).json({ error: 'Short Film public voting is currently closed.' });
    return;
  }

  const body = (req.body ?? {}) as { email?: unknown; code?: unknown };
  const email = typeof body.email === 'string' ? body.email : '';
  const code = typeof body.code === 'string' ? body.code : '';

  const result = verifyOtpAndCreateSession({ email, code });
  if (result.ok === false) {
    res.status(result.status).json({ error: result.reason });
    return;
  }

  setVoterCookie(req, res, result.cookieValue, 30 * 60);
  res.json({
    ok: true,
    session: result.sessionState,
  });
});

votingRouter.post('/api/voting/cast', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (isIpRateLimited(`cast:${ip}`, 15, 15 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    return;
  }

  const cookies = parseCookies(req);
  const sessionId = verifySessionCookieValue(cookies[VOTER_COOKIE_NAME]);
  if (!sessionId) {
    res.status(401).json({
      error: 'Email verification is required before submitting your vote.',
    });
    return;
  }

  const body = (req.body ?? {}) as { filmId?: unknown };
  const filmId = typeof body.filmId === 'string' ? body.filmId.trim() : '';
  if (!filmId) {
    res.status(400).json({ error: 'Please select a valid film submission.' });
    return;
  }

  const result = castVerifiedVote({ sessionId, filmId });
  if (result.ok === false) {
    res.status(result.status).json({ error: result.reason });
    return;
  }

  res.json({
    ok: true,
    message: 'Your vote has been successfully recorded. Thank you for being part of InfraX.',
    session: result.sessionState,
  });
});

votingRouter.post('/api/voting/logout-session', (req: Request, res: Response) => {
  clearVoterCookie(req, res);
  res.json({ ok: true });
});

// ============================================================================
// ADMIN VOTING MANAGEMENT ROUTES (Firebase Admin Auth Protected)
// ============================================================================

votingRouter.get(
  '/api/admin/voting/overview',
  requireAdminMiddleware,
  (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    const settings = getVotingSettings();
    const votingStatus = computeVotingStatus(settings);
    const emailDelivery = getEmailDeliveryStatus();
    const submissions = getAdminSubmissionsWithScores();
    const schools = listInvitedSchools(false);
    const voters = listApprovedVoters();

    res.json({
      settings,
      votingStatus,
      emailDelivery,
      submissions,
      schools,
      voters,
    });
  }
);

votingRouter.put(
  '/api/admin/voting/settings',
  requireAdminMiddleware,
  (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        isOpen?: boolean;
        opensAt?: string | null;
        closesAt?: string | null;
        eligibilityMode?: EligibilityMode;
        manualPaused?: boolean;
        theme?: {
          label?: string;
          title?: string;
          accentColor?: string;
          surfaceColor?: string;
        };
      };

      const mode: EligibilityMode =
        body.eligibilityMode === 'invited_school' ||
        body.eligibilityMode === 'approved_list' ||
        body.eligibilityMode === 'invitation_code' ||
        body.eligibilityMode === 'both'
          ? body.eligibilityMode
          : 'invited_school';

      const updated = updateVotingSettings({
        isOpen: Boolean(body.isOpen),
        opensAt: body.opensAt ?? null,
        closesAt: body.closesAt ?? null,
        eligibilityMode: mode,
        manualPaused: Boolean(body.manualPaused),
        theme: body.theme
          ? {
              label: typeof body.theme.label === 'string' ? body.theme.label : undefined,
              title: typeof body.theme.title === 'string' ? body.theme.title : undefined,
              accentColor:
                typeof body.theme.accentColor === 'string' ? body.theme.accentColor : undefined,
              surfaceColor:
                typeof body.theme.surfaceColor === 'string' ? body.theme.surfaceColor : undefined,
            }
          : undefined,
      });

      res.json({
        ok: true,
        settings: updated,
        votingStatus: computeVotingStatus(updated),
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to update voting settings.',
      });
    }
  }
);

votingRouter.post(
  '/api/admin/voting/submissions',
  requireAdminMiddleware,
  (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        schoolName?: string;
        schoolLogoUrl?: string | null;
        title?: string;
        description?: string;
        videoUrl?: string | null;
        thumbnailUrl?: string | null;
        enabled?: boolean;
        judgesScore?: number;
      };
      const submission = createSubmission({
        schoolName: body.schoolName ?? '',
        schoolLogoUrl: body.schoolLogoUrl,
        title: body.title ?? '',
        description: body.description,
        videoUrl: body.videoUrl,
        thumbnailUrl: body.thumbnailUrl,
        enabled: body.enabled,
        judgesScore: body.judgesScore,
      });
      res.status(201).json({ ok: true, submission });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to add submission.',
      });
    }
  }
);

votingRouter.put(
  '/api/admin/voting/submissions/:id',
  requireAdminMiddleware,
  (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        schoolName?: string;
        schoolLogoUrl?: string | null;
        title?: string;
        description?: string;
        videoUrl?: string | null;
        thumbnailUrl?: string | null;
        enabled?: boolean;
        judgesScore?: number;
        displayOrder?: number;
      };
      const submission = updateSubmission(String(req.params.id), body);
      res.json({ ok: true, submission });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to update submission.',
      });
    }
  }
);

votingRouter.post(
  '/api/admin/voting/submissions/:id/thumbnail',
  requireAdminMiddleware,
  (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { dataUrl?: unknown };
      if (typeof body.dataUrl !== 'string' || !body.dataUrl) {
        res.status(400).json({ error: 'Thumbnail image payload is required.' });
        return;
      }
      const thumbnailUrl = saveSubmissionThumbnail(String(req.params.id), body.dataUrl);
      res.json({ ok: true, thumbnailUrl });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to upload thumbnail.',
      });
    }
  }
);

votingRouter.delete(
  '/api/admin/voting/submissions/:id',
  requireAdminMiddleware,
  (req: Request, res: Response) => {
    try {
      deleteSubmission(String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to delete submission.',
      });
    }
  }
);

votingRouter.post(
  '/api/admin/voting/schools',
  requireAdminMiddleware,
  (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        schoolName?: string;
        invitationCode?: string;
        isEligible?: boolean;
      };
      const school = addInvitedSchool({
        schoolName: body.schoolName ?? '',
        invitationCode: body.invitationCode,
        isEligible: body.isEligible,
      });
      res.status(201).json({ ok: true, school });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to add school.',
      });
    }
  }
);

votingRouter.put(
  '/api/admin/voting/schools/:id',
  requireAdminMiddleware,
  (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        schoolName?: string;
        invitationCode?: string;
        isEligible?: boolean;
      };
      const school = updateInvitedSchool(String(req.params.id), body);
      res.json({ ok: true, school });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to update school.',
      });
    }
  }
);

votingRouter.delete(
  '/api/admin/voting/schools/:id',
  requireAdminMiddleware,
  (req: Request, res: Response) => {
    deleteInvitedSchool(String(req.params.id));
    res.json({ ok: true });
  }
);

votingRouter.post(
  '/api/admin/voting/voters',
  requireAdminMiddleware,
  (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { emails?: unknown; schoolId?: unknown };
      const schoolId = typeof body.schoolId === 'string' ? body.schoolId : '';
      const emails = Array.isArray(body.emails)
        ? body.emails.filter((e): e is string => typeof e === 'string')
        : [];
      const result = addApprovedVoters({ emails, schoolId });
      res.status(201).json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to add approved voters.',
      });
    }
  }
);

votingRouter.delete(
  '/api/admin/voting/voters/:id',
  requireAdminMiddleware,
  (req: Request, res: Response) => {
    deleteApprovedVoter(String(req.params.id));
    res.json({ ok: true });
  }
);

votingRouter.get(
  '/api/admin/voting/export-csv',
  requireAdminMiddleware,
  (_req: Request, res: Response) => {
    const submissions = getAdminSubmissionsWithScores().sort(
      (a, b) => b.finalScore - a.finalScore
    );

    const header = [
      'Rank',
      'School Name',
      'Film Title',
      'Status',
      'Public Vote Share (%)',
      'Public Score (/30)',
      'Judges Score (/70)',
      'Final Score (/100)',
    ].join(',');

    const lines = submissions.map((s, idx) =>
      [
        idx + 1,
        csvCell(s.schoolName),
        csvCell(s.title),
        s.enabled ? 'Active' : 'Disabled',
        `${s.votePercentage.toFixed(2)}%`,
        s.publicScore.toFixed(2),
        s.judgesScore.toFixed(2),
        s.finalScore.toFixed(2),
      ].join(',')
    );

    const csvContent = [header, ...lines].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="infrax-short-film-results.csv"'
    );
    res.send(csvContent);
  }
);

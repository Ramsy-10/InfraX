export type EligibilityMode = 'invited_school' | 'both' | 'approved_list' | 'invitation_code';
export type VotingWindowStatus = 'open' | 'upcoming' | 'closed' | 'disabled';

export interface PublicFilmSubmission {
  id: string;
  schoolName: string;
  schoolLogoUrl?: string | null;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  displayOrder: number;
}

export interface EligibleSchoolOption {
  id: string;
  schoolName: string;
}

export interface VoterSessionState {
  verified: boolean;
  maskedEmail: string | null;
  schoolName: string | null;
  hasVoted: boolean;
  votedFilmTitle: string | null;
  votedSchoolName: string | null;
}

export interface VotingThemeConfig {
  label: string;
  title: string;
  accentColor: string;
  surfaceColor: string;
}

export const DEFAULT_VOTING_THEME: VotingThemeConfig = {
  label: 'INFRAX SHORT FILM COMPETITION',
  title: 'Your choice. Your voice.',
  accentColor: '#AEDD00',
  surfaceColor: '#050505',
};

const COLOMBO_OFFSET_MS = 330 * 60 * 1000;

export function toColomboDatetimeLocal(iso: string | null | undefined): string {
  if (!iso || !iso.trim()) return '';
  const ms = Date.parse(iso.trim());
  if (Number.isNaN(ms)) return '';
  const shifted = new Date(ms + COLOMBO_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate()
  )}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

export function fromColomboDatetimeLocal(localValue: string): string | null {
  const clean = localValue.trim();
  if (!clean) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(clean);
  if (!match) {
    const parsed = Date.parse(clean);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - COLOMBO_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

export function sanitizeVotingHex(raw: string | null | undefined, fallback: string): string {
  const val = (raw ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(val) ? val.toUpperCase() : fallback;
}

export function normalizeVotingTheme(
  raw?: Partial<VotingThemeConfig> | null
): VotingThemeConfig {
  return {
    label: (raw?.label ?? '').trim() || DEFAULT_VOTING_THEME.label,
    title: (raw?.title ?? '').trim() || DEFAULT_VOTING_THEME.title,
    accentColor: sanitizeVotingHex(raw?.accentColor, DEFAULT_VOTING_THEME.accentColor),
    surfaceColor: sanitizeVotingHex(raw?.surfaceColor, DEFAULT_VOTING_THEME.surfaceColor),
  };
}

export function computeLiveVotingStatus(
  params: {
    votingStatus: VotingWindowStatus;
    opensAt: string | null;
    closesAt: string | null;
    manualPaused?: boolean;
  },
  nowMs: number = Date.now()
): VotingWindowStatus {
  if (params.manualPaused || params.votingStatus === 'disabled') {
    return 'disabled';
  }
  const opensMs = params.opensAt ? Date.parse(params.opensAt) : Number.NaN;
  const closesMs = params.closesAt ? Date.parse(params.closesAt) : Number.NaN;
  const hasOpens = !Number.isNaN(opensMs);
  const hasCloses = !Number.isNaN(closesMs);

  if (hasOpens || hasCloses) {
    if (hasOpens && hasCloses && closesMs <= opensMs) {
      return 'closed';
    }
    if (hasOpens && nowMs < opensMs) {
      return 'upcoming';
    }
    if (hasCloses && nowMs > closesMs) {
      return 'closed';
    }
    return 'open';
  }

  return params.votingStatus;
}

export interface PublicVotingState {
  votingStatus: VotingWindowStatus;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  eligibilityMode: EligibilityMode;
  theme: VotingThemeConfig;
  serverNow?: string;
  emailServiceConfigured?: boolean;
  eligibleSchools: EligibleSchoolOption[];
  submissions: PublicFilmSubmission[];
  session: VoterSessionState;
}

export interface AdminFilmSubmission extends PublicFilmSubmission {
  enabled: boolean;
  judgesScore: number;
  votePercentage: number;
  publicScore: number;
  finalScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvitedSchoolRecord {
  id: string;
  schoolName: string;
  invitationCode: string;
  isEligible: boolean;
  createdAt: string;
}

export interface ApprovedVoterRecord {
  id: string;
  email: string;
  schoolId: string;
  schoolName: string;
  hasVoted: boolean;
  createdAt: string;
}

export interface AdminVotingOverview {
  settings: {
    isOpen: boolean;
    manualPaused: boolean;
    opensAt: string | null;
    closesAt: string | null;
    eligibilityMode: EligibilityMode;
    theme: VotingThemeConfig;
    updatedAt: string;
  };
  votingStatus: VotingWindowStatus;
  emailDelivery: {
    configured: boolean;
    provider: 'resend' | 'smtp' | null;
  };
  submissions: AdminFilmSubmission[];
  schools: InvitedSchoolRecord[];
  voters: ApprovedVoterRecord[];
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: ({ error?: string; message?: string } & T) | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string; message?: string } & T;
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (data?.error) {
      throw new Error(data.error);
    }
    if (data?.message) {
      throw new Error(data.message);
    }
    if (res.status === 403) {
      throw new Error(
        'Eligibility or access verification denied (403). Please verify your selected school and email address.'
      );
    }
    if (res.status >= 500) {
      throw new Error(
        'The voting service or database is temporarily unavailable. Please try again in a moment.'
      );
    }
    throw new Error(`Request failed (${res.status}).`);
  }

  if (!data) {
    throw new Error('Unexpected empty or invalid response from voting service.');
  }
  return data;
}

async function adminHeaders(): Promise<Record<string, string>> {
  const { auth } = await import('./firebase');
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Administrator sign-in is required.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// ============================================================================
// PUBLIC VOTING CLIENT API
// ============================================================================

export async function fetchPublicVotingState(): Promise<PublicVotingState> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch('/api/voting/public-state', {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
    const raw = await parseJsonResponse<Partial<PublicVotingState>>(res);

    const votingStatus: VotingWindowStatus =
      raw.votingStatus === 'open' ||
      raw.votingStatus === 'upcoming' ||
      raw.votingStatus === 'closed' ||
      raw.votingStatus === 'disabled'
        ? raw.votingStatus
        : 'disabled';

    return {
      votingStatus,
      isOpen: votingStatus === 'open',
      opensAt: typeof raw.opensAt === 'string' ? raw.opensAt : null,
      closesAt: typeof raw.closesAt === 'string' ? raw.closesAt : null,
      eligibilityMode:
        raw.eligibilityMode === 'invited_school' ||
        raw.eligibilityMode === 'approved_list' ||
        raw.eligibilityMode === 'invitation_code' ||
        raw.eligibilityMode === 'both'
          ? raw.eligibilityMode
          : 'invited_school',
      theme: normalizeVotingTheme(raw.theme),
      serverNow: typeof raw.serverNow === 'string' ? raw.serverNow : undefined,
      emailServiceConfigured: raw.emailServiceConfigured,
      eligibleSchools: Array.isArray(raw.eligibleSchools) ? raw.eligibleSchools : [],
      submissions: Array.isArray(raw.submissions) ? raw.submissions : [],
      session: {
        verified: Boolean(raw.session?.verified),
        maskedEmail: raw.session?.maskedEmail ?? null,
        schoolName: raw.session?.schoolName ?? null,
        hasVoted: Boolean(raw.session?.hasVoted),
        votedFilmTitle: raw.session?.votedFilmTitle ?? null,
        votedSchoolName: raw.session?.votedSchoolName ?? null,
      },
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        'The voting service took too long to respond. Please check your connection and try again.'
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function requestVotingOtp(params: {
  email: string;
  schoolId?: string;
  schoolName?: string;
  invitationCode?: string;
}): Promise<{
  ok: boolean;
  schoolName: string;
  expiresInSeconds: number;
  cooldownSeconds: number;
}> {
  const res = await fetch('/api/voting/request-otp', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return parseJsonResponse(res);
}

export async function verifyVotingOtp(params: {
  email: string;
  code: string;
}): Promise<{ ok: boolean; session: VoterSessionState }> {
  const res = await fetch('/api/voting/verify-otp', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return parseJsonResponse(res);
}

export async function castShortFilmVote(filmId: string): Promise<{
  ok: boolean;
  message: string;
  session: VoterSessionState;
}> {
  const res = await fetch('/api/voting/cast', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filmId }),
  });
  return parseJsonResponse(res);
}

export async function resetVoterSession(): Promise<void> {
  await fetch('/api/voting/logout-session', {
    method: 'POST',
    credentials: 'include',
  });
}

// ============================================================================
// ADMIN VOTING MANAGEMENT CLIENT API
// ============================================================================

export async function fetchAdminVotingOverview(): Promise<AdminVotingOverview> {
  const res = await fetch('/api/admin/voting/overview', {
    cache: 'no-store',
    headers: await adminHeaders(),
  });
  const data = await parseJsonResponse<AdminVotingOverview>(res);
  return {
    ...data,
    settings: {
      ...data.settings,
      manualPaused: Boolean(data.settings?.manualPaused),
      theme: normalizeVotingTheme(data.settings?.theme),
    },
  };
}

export async function saveAdminVotingSettings(settings: {
  isOpen?: boolean;
  manualPaused?: boolean;
  opensAt: string | null;
  closesAt: string | null;
  eligibilityMode: EligibilityMode;
  theme?: Partial<VotingThemeConfig>;
}): Promise<void> {
  const res = await fetch('/api/admin/voting/settings', {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify(settings),
  });
  await parseJsonResponse(res);
}

export async function createAdminSubmission(payload: {
  schoolName: string;
  schoolLogoUrl?: string | null;
  title: string;
  description?: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  enabled?: boolean;
  judgesScore?: number;
}): Promise<{ submission: AdminFilmSubmission }> {
  const res = await fetch('/api/admin/voting/submissions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}

export async function updateAdminSubmission(
  id: string,
  payload: {
    schoolName?: string;
    schoolLogoUrl?: string | null;
    title?: string;
    description?: string;
    videoUrl?: string | null;
    thumbnailUrl?: string | null;
    enabled?: boolean;
    judgesScore?: number;
  }
): Promise<{ submission: AdminFilmSubmission }> {
  const res = await fetch(`/api/admin/voting/submissions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}

export async function uploadAdminSubmissionThumbnail(
  id: string,
  file: File
): Promise<{ thumbnailUrl: string }> {
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Thumbnail image must be smaller than 2 MB.');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  const res = await fetch(
    `/api/admin/voting/submissions/${encodeURIComponent(id)}/thumbnail`,
    {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify({ dataUrl }),
    }
  );
  return parseJsonResponse(res);
}

export async function deleteAdminSubmission(id: string): Promise<void> {
  const res = await fetch(`/api/admin/voting/submissions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await adminHeaders(),
  });
  await parseJsonResponse(res);
}

export async function addAdminInvitedSchool(payload: {
  schoolName: string;
  invitationCode?: string;
  isEligible?: boolean;
}): Promise<void> {
  const res = await fetch('/api/admin/voting/schools', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify(payload),
  });
  await parseJsonResponse(res);
}

export async function updateAdminInvitedSchool(
  id: string,
  payload: {
    schoolName?: string;
    invitationCode?: string;
    isEligible?: boolean;
  }
): Promise<void> {
  const res = await fetch(`/api/admin/voting/schools/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify(payload),
  });
  await parseJsonResponse(res);
}

export async function deleteAdminInvitedSchool(id: string): Promise<void> {
  const res = await fetch(`/api/admin/voting/schools/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await adminHeaders(),
  });
  await parseJsonResponse(res);
}

export async function addAdminApprovedVoters(payload: {
  schoolId: string;
  emails: string[];
}): Promise<{ added: number; skipped: number }> {
  const res = await fetch('/api/admin/voting/voters', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}

export async function deleteAdminApprovedVoter(id: string): Promise<void> {
  const res = await fetch(`/api/admin/voting/voters/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await adminHeaders(),
  });
  await parseJsonResponse(res);
}

export async function downloadAdminResultsCsv(): Promise<void> {
  const res = await fetch('/api/admin/voting/export-csv', {
    headers: await adminHeaders(),
  });
  if (!res.ok) {
    throw new Error('Unable to export results CSV.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'infrax-short-film-results.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

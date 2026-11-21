import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Film,
  Lock,
  Mail,
  Play,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { EVENT_CONFIG } from '../config/infraxConfig';
import { getEmbeddableVideoUrl, isSafeHttpUrl } from '../lib/videoUtils';
import {
  castShortFilmVote,
  computeLiveVotingStatus,
  DEFAULT_VOTING_THEME,
  fetchPublicVotingState,
  requestVotingOtp,
  verifyVotingOtp,
  type PublicFilmSubmission,
  type PublicVotingState,
} from '../lib/votingApi';

type VotingStep = 'browse' | 'verify-email' | 'confirm-vote' | 'recorded';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getContrastTextColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#000000';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#FFFFFF';
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatWindowDate(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Colombo',
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

function getSchoolInitials(schoolName: string): string {
  const words = schoolName
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(and|of|the|college|school)$/i.test(w));
  const source = words.length > 0 ? words : schoolName.trim().split(/\s+/).filter(Boolean);
  if (source.length === 0) return 'SC';
  if (source.length === 1) return source[0].slice(0, 2).toUpperCase();
  return `${source[0][0]}${source[1][0]}`.toUpperCase();
}

export function VotingPage() {
  const [state, setState] = useState<PublicVotingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string>('');
  const [modalFilm, setModalFilm] = useState<PublicFilmSubmission | null>(null);
  const [imgErrorMap, setImgErrorMap] = useState<Record<string, boolean>>({});
  const [logoErrorMap, setLogoErrorMap] = useState<Record<string, boolean>>({});

  // 4-stage voting workflow state
  const [step, setStep] = useState<VotingStep>('browse');
  const [email, setEmail] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifiedSchoolHint, setVerifiedSchoolHint] = useState<string | null>(null);

  const [expirySecondsLeft, setExpirySecondsLeft] = useState(0);
  const [resendCooldownLeft, setResendCooldownLeft] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const isMountedRef = useRef(true);
  const pageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadVotingState = useCallback(async (showSpinner = false) => {
    if (showSpinner && isMountedRef.current) {
      setLoading(true);
    }
    try {
      if (isMountedRef.current) {
        setLoadError(null);
      }
      const data = await fetchPublicVotingState();
      if (!isMountedRef.current) return;

      if (data.serverNow) {
        const parsedServerMs = Date.parse(data.serverNow);
        if (!Number.isNaN(parsedServerMs)) {
          setServerOffsetMs(parsedServerMs - Date.now());
        }
      }
      setClockNowMs(Date.now());
      setState(data);

      const safeSubmissions = Array.isArray(data.submissions) ? data.submissions : [];
      const safeSchools = Array.isArray(data.eligibleSchools) ? data.eligibleSchools : [];

      setSelectedId((prev) => {
        if (prev && safeSubmissions.some((s) => s.id === prev)) return prev;
        return safeSubmissions[0]?.id ?? '';
      });

      if (safeSchools.length > 0) {
        setSelectedSchoolId((prev) => prev || safeSchools[0].id);
      }

      if (data.session?.hasVoted) {
        setStep('recorded');
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Unable to load the Short Film voting portal. Please try again.'
      );
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    document.title = 'The Public Vote — InfraX Short Film Competition';
    window.scrollTo(0, 0);
    void loadVotingState();
  }, [loadVotingState]);

  // Keep synchronized with Admin schedule/theme edits on focus and every 30s
  useEffect(() => {
    const refreshSilently = () => {
      void loadVotingState(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshSilently();
      }
    };
    window.addEventListener('focus', refreshSilently);
    document.addEventListener('visibilitychange', onVisibility);
    const pollTimer = window.setInterval(refreshSilently, 30_000);
    return () => {
      window.removeEventListener('focus', refreshSilently);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(pollTimer);
    };
  }, [loadVotingState]);

  // Real-time 1s clock tick when schedule boundaries exist so status transitions live
  useEffect(() => {
    if (!state?.opensAt && !state?.closesAt) return;
    const timer = window.setInterval(() => {
      setClockNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state?.opensAt, state?.closesAt]);

  // Apply persisted Admin Voting Theme CSS custom properties without inline JSX styles
  const activeTheme = state?.theme ?? DEFAULT_VOTING_THEME;
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    el.style.setProperty('--voting-accent', activeTheme.accentColor);
    el.style.setProperty('--voting-accent-fg', getContrastTextColor(activeTheme.accentColor));
    el.style.setProperty('--voting-surface', activeTheme.surfaceColor);
  }, [activeTheme]);

  // Live countdown timers for OTP expiry and resend cooldown
  useEffect(() => {
    if (expirySecondsLeft <= 0 && resendCooldownLeft <= 0) return;
    const timer = window.setInterval(() => {
      setExpirySecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldownLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expirySecondsLeft, resendCooldownLeft]);

  // Close video modal on Escape key
  useEffect(() => {
    if (!modalFilm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalFilm(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalFilm]);

  const submissions = state?.submissions ?? [];
  const selectedFilm: PublicFilmSubmission | undefined = useMemo(
    () => submissions.find((f) => f.id === selectedId) ?? submissions[0],
    [submissions, selectedId]
  );

  const liveVotingStatus = useMemo(() => {
    if (!state) return 'disabled' as const;
    return computeLiveVotingStatus(
      {
        votingStatus: state.votingStatus,
        opensAt: state.opensAt,
        closesAt: state.closesAt,
      },
      clockNowMs + serverOffsetMs
    );
  }, [state, clockNowMs, serverOffsetMs]);

  const votingOpen = liveVotingStatus === 'open';
  const session = state?.session;
  const hasAlreadyVoted = Boolean(session?.hasVoted);

  const handleWatchFilm = (film: PublicFilmSubmission) => {
    setSelectedId(film.id);
    const embedUrl = getEmbeddableVideoUrl(film.videoUrl);
    if (embedUrl) {
      setModalFilm(film);
      return;
    }
    if (isSafeHttpUrl(film.videoUrl) && film.videoUrl) {
      window.open(film.videoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleStartVoteFlow = (filmId?: string) => {
    if (filmId) {
      setSelectedId(filmId);
    }
    setModalFilm(null);
    setStepError(null);

    if (!votingOpen) return;

    if (hasAlreadyVoted) {
      setStep('recorded');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (session?.verified) {
      setStep('confirm-vote');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setStep('verify-email');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRequestOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setStepError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setStepError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const needsCode =
        state?.eligibilityMode === 'both' || state?.eligibilityMode === 'invitation_code';
      const res = await requestVotingOtp({
        email: trimmedEmail,
        schoolId:
          state?.eligibilityMode === 'approved_list' ? undefined : selectedSchoolId || undefined,
        invitationCode: needsCode ? invitationCode.trim() || undefined : undefined,
      });
      setOtpSent(true);
      setOtpCode('');
      setVerifiedSchoolHint(res.schoolName);
      setExpirySecondsLeft(res.expiresInSeconds);
      setResendCooldownLeft(res.cooldownSeconds);
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to send verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setStepError(null);

    if (!/^\d{6}$/.test(otpCode.trim())) {
      setStepError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await verifyVotingOtp({
        email: email.trim(),
        code: otpCode.trim(),
      });
      setState((prev) => (prev ? { ...prev, session: res.session } : prev));
      setStep('confirm-vote');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmVote = async () => {
    if (!selectedFilm) return;
    setStepError(null);
    setSubmitting(true);
    try {
      const res = await castShortFilmVote(selectedFilm.id);
      setState((prev) => (prev ? { ...prev, session: res.session } : prev));
      setStep('recorded');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to record your vote.';
      setStepError(msg);
      if (msg.toLowerCase().includes('already been recorded')) {
        await loadVotingState();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleImgError = (filmId: string) => {
    setImgErrorMap((prev) => ({ ...prev, [filmId]: true }));
  };

  const handleLogoError = (filmId: string) => {
    setLogoErrorMap((prev) => ({ ...prev, [filmId]: true }));
  };

  const statusBannerText = useMemo(() => {
    if (!state) return null;
    if (liveVotingStatus === 'open') {
      const closeLabel = formatWindowDate(state.closesAt);
      return closeLabel ? `Voting Open · Closes ${closeLabel} (SLST)` : 'Voting Open';
    }
    if (liveVotingStatus === 'upcoming') {
      const openLabel = formatWindowDate(state.opensAt);
      return openLabel ? `Voting Not Open Yet · Opens ${openLabel} (SLST)` : 'Voting Not Open Yet';
    }
    if (liveVotingStatus === 'closed') {
      const closeLabel = formatWindowDate(state.closesAt);
      return closeLabel ? `Voting Closed · Ended ${closeLabel} (SLST)` : 'Voting Closed';
    }
    return 'Public Voting Not Open Yet';
  }, [state, liveVotingStatus]);

  const modalEmbedUrl = modalFilm ? getEmbeddableVideoUrl(modalFilm.videoUrl) : null;

  return (
    <div
      ref={pageRef}
      className="flex min-h-screen flex-col bg-[var(--voting-surface,#050505)] text-white transition-colors duration-300"
    >
      {/* Minimal Top Navigation */}
      <header className="border-b border-white/10 bg-[var(--voting-surface,#050505)]">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="InfraX Home" className="shrink-0">
            <img
              src="/assets/aistudio/InfraX_Logo_c4d52eba.jpg"
              alt="InfraX"
              className="h-8 w-24 object-cover object-center mix-blend-lighten"
            />
          </Link>

          <nav aria-label="Voting navigation" className="flex items-center gap-4 sm:gap-6">
            <Link
              to="/competitions/short-film"
              className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] transition-colors hover:text-[var(--voting-accent,#AEDD00)] whitespace-nowrap"
            >
              Short Film
            </Link>
            <Link
              to="/"
              className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] transition-colors hover:text-[var(--voting-accent,#AEDD00)] whitespace-nowrap"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Home</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        {/* Hero Header */}
        <div className="flex flex-col justify-between gap-6 border-b border-white/15 pb-10 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--voting-accent,#AEDD00)]">
              {activeTheme.label}
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold uppercase tracking-tight text-white sm:text-5xl lg:text-6xl">
              THE PUBLIC VOTE
            </h1>
            <p className="mt-3 font-display text-lg font-semibold text-white sm:text-xl">
              {activeTheme.title}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[#A0A0A0] sm:text-base">
              Watch the submissions and support your favourite short film.
            </p>
          </div>

          {statusBannerText && (
            <div className="shrink-0 border border-[var(--voting-accent,#AEDD00)]/40 bg-[#111111] px-4 py-2.5">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--voting-accent,#AEDD00)]">
                {statusBannerText}
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <div role="status" aria-live="polite" className="mt-10 sm:mt-12">
            <p className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-[#A0A0A0]">
              Loading Short Film Submissions...
            </p>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  aria-hidden="true"
                  className="animate-pulse border border-white/10 bg-[#111111]"
                >
                  <div className="flex items-center gap-3 border-b border-white/10 bg-[#0A0A0A] px-5 py-3.5">
                    <div className="h-10 w-10 bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-2.5 w-24 bg-white/10" />
                      <div className="h-3.5 w-40 bg-white/15" />
                    </div>
                  </div>
                  <div className="aspect-video w-full bg-[#080808]" />
                  <div className="space-y-3 p-6">
                    <div className="h-5 w-3/4 bg-white/15" />
                    <div className="h-3.5 w-full bg-white/10" />
                    <div className="mt-4 flex gap-3 pt-4">
                      <div className="h-10 flex-1 bg-white/10" />
                      <div className="h-10 flex-1 bg-white/15" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="mt-10 border border-red-500/40 bg-[#111111] p-6 sm:p-8"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-red-300">
                  Voting Service Unavailable
                </p>
                <p className="mt-2 text-sm leading-relaxed text-red-100">{loadError}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void loadVotingState(true)}
                    className="bg-[var(--voting-accent,#AEDD00)] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--voting-accent-fg,#000000)] transition-opacity hover:opacity-90"
                  >
                    Retry
                  </button>
                  <Link
                    to="/"
                    className="border border-white/20 bg-[#000000] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[var(--voting-accent,#AEDD00)] hover:text-[var(--voting-accent,#AEDD00)]"
                  >
                    Return Home
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* STAGE 4 — VOTE CONFIRMATION */}
            {step === 'recorded' && (
              <section
                aria-label="Vote recorded confirmation"
                className="mt-10 border border-[var(--voting-accent,#AEDD00)]/45 bg-[#111111] p-8 sm:p-12"
              >
                <div className="max-w-xl">
                  <div className="flex items-center gap-2.5 text-[var(--voting-accent,#AEDD00)]">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-mono text-xs uppercase tracking-[0.2em]">
                      Confirmed
                    </span>
                  </div>

                  <h2 className="mt-4 font-display text-3xl font-extrabold uppercase tracking-tight text-white sm:text-4xl">
                    VOTE RECORDED
                  </h2>

                  <p className="mt-3 text-base leading-relaxed text-[#A0A0A0]">
                    Thank you for being part of InfraX.
                  </p>

                  {session?.votedFilmTitle && (
                    <div className="mt-6 border border-white/10 bg-[#000000] p-4">
                      <p className="font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                        Recorded Selection
                      </p>
                      <p className="mt-1 font-display text-lg font-bold text-white">
                        {session.votedFilmTitle}
                      </p>
                      {session.votedSchoolName && (
                        <p className="mt-0.5 text-xs text-[var(--voting-accent,#AEDD00)]">
                          {session.votedSchoolName}
                        </p>
                      )}
                    </div>
                  )}

                  {session?.maskedEmail && (
                    <p className="mt-4 font-mono text-xs text-[#A0A0A0]">
                      Verified voter: {session.maskedEmail}
                      {session.schoolName ? ` · ${session.schoolName}` : ''}
                    </p>
                  )}

                  <div className="mt-8 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('browse')}
                      className="border border-white/20 bg-[#000000] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[var(--voting-accent,#AEDD00)] hover:text-[var(--voting-accent,#AEDD00)]"
                    >
                      View Submissions
                    </button>
                    <Link
                      to="/"
                      className="bg-[var(--voting-accent,#AEDD00)] px-6 py-3 text-xs font-bold uppercase tracking-wider text-[var(--voting-accent-fg,#000000)] transition-opacity hover:opacity-90"
                    >
                      Return Home
                    </Link>
                  </div>
                </div>
              </section>
            )}

            {/* STAGE 1 & STAGE 2 — EMAIL ENTRY & OTP VERIFICATION */}
            {step === 'verify-email' && (
              <section
                aria-label="Email verification"
                className="mt-10 border border-white/15 bg-[#111111] p-6 sm:p-10"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--voting-accent,#AEDD00)]">
                      {otpSent ? 'Step 2 · Verification Code' : 'Step 1 · Voter Eligibility'}
                    </p>
                    <h2 className="mt-1.5 font-display text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl">
                      {otpSent ? 'VERIFY YOUR EMAIL' : 'ENTER YOUR SCHOOL EMAIL'}
                    </h2>
                    <p className="mt-1.5 text-sm text-[#A0A0A0]">
                      {otpSent
                        ? 'Enter the six-digit verification code sent to your email address.'
                        : 'Eligible students from invited schools must verify their email before voting.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('browse');
                      setStepError(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] hover:text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Submissions</span>
                  </button>
                </div>

                {selectedFilm && (
                  <div className="mt-5 border border-white/10 bg-[#000000] px-4 py-3 text-xs text-[#A0A0A0]">
                    Selected film:{' '}
                    <span className="font-semibold text-white">{selectedFilm.title}</span> —{' '}
                    <span className="text-[var(--voting-accent,#AEDD00)]">
                      {selectedFilm.schoolName}
                    </span>
                  </div>
                )}

                {state?.emailServiceConfigured === false && !otpSent && (
                  <div className="mt-5 flex items-start gap-2.5 border border-white/20 bg-[#000000] p-3.5 text-xs leading-relaxed text-[#A0A0A0]">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--voting-accent,#AEDD00)]" />
                    <span>
                      Verification email delivery is not configured in this environment yet.
                      Organizers must set Resend or SMTP credentials before OTP codes can be sent.
                    </span>
                  </div>
                )}

                {stepError && (
                  <div
                    role="alert"
                    className="mt-5 flex items-start gap-2.5 border border-red-500/40 bg-red-950/30 p-3.5 text-xs leading-relaxed text-red-200"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <span>{stepError}</span>
                  </div>
                )}

                {!otpSent ? (
                  <form onSubmit={handleRequestOtp} className="mt-6 max-w-xl space-y-5">
                    <div>
                      <label
                        htmlFor="voter-email"
                        className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]"
                      >
                        Voter Email Address
                      </label>
                      <input
                        id="voter-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="student@gmail.com"
                        className="mt-1.5 w-full border border-white/15 bg-[#000000] px-3.5 py-3 text-sm text-white placeholder:text-white/30 focus:border-[var(--voting-accent,#AEDD00)] focus:outline-none"
                      />
                      <p className="mt-1.5 text-xs text-[#A0A0A0]">
                        Personal email addresses (Gmail, Outlook, Yahoo) and school emails are
                        supported. One vote per verified email; organizing school addresses are not
                        permitted to vote.
                      </p>
                    </div>

                    {state?.eligibilityMode !== 'approved_list' && (
                      <div
                        className={`grid gap-4 ${
                          state?.eligibilityMode === 'invited_school'
                            ? 'grid-cols-1'
                            : 'sm:grid-cols-2'
                        }`}
                      >
                        <div>
                          <label
                            htmlFor="voter-school"
                            className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]"
                          >
                            Your Invited School
                          </label>
                          <select
                            id="voter-school"
                            value={selectedSchoolId}
                            onChange={(e) => setSelectedSchoolId(e.target.value)}
                            className="mt-1.5 w-full border border-white/15 bg-[#000000] px-3.5 py-3 text-sm text-white focus:border-[var(--voting-accent,#AEDD00)] focus:outline-none"
                          >
                            {state?.eligibleSchools.length === 0 ? (
                              <option value="">No invited schools active</option>
                            ) : (
                              state?.eligibleSchools.map((sch) => (
                                <option key={sch.id} value={sch.id}>
                                  {sch.schoolName}
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        {(state?.eligibilityMode === 'both' ||
                          state?.eligibilityMode === 'invitation_code') && (
                          <div>
                            <label
                              htmlFor="school-code"
                              className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]"
                            >
                              School Invitation Code
                              {state?.eligibilityMode === 'both' ? ' (If not pre-approved)' : ''}
                            </label>
                            <input
                              id="school-code"
                              type="text"
                              value={invitationCode}
                              onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                              placeholder="e.g. INFRAX-XXXXXX"
                              className="mt-1.5 w-full border border-white/15 bg-[#000000] px-3.5 py-3 font-mono text-sm uppercase text-white placeholder:text-white/30 focus:border-[var(--voting-accent,#AEDD00)] focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 bg-[var(--voting-accent,#AEDD00)] px-7 py-3 text-xs font-bold uppercase tracking-wider text-[var(--voting-accent-fg,#000000)] transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Mail className="h-4 w-4" />
                      <span>
                        {submitting ? 'Sending Code...' : 'Send Verification Code'}
                      </span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="mt-6 max-w-xl space-y-5">
                    <div className="border border-[var(--voting-accent,#AEDD00)]/30 bg-[#000000] p-4 text-xs leading-relaxed text-[#A0A0A0]">
                      Verification code sent to{' '}
                      <strong className="text-white">{email.trim()}</strong>
                      {verifiedSchoolHint ? ` (${verifiedSchoolHint})` : ''}.
                      <span className="mt-1.5 block font-mono text-[var(--voting-accent,#AEDD00)] tabular-nums">
                        {expirySecondsLeft > 0
                          ? `Code expires in ${formatCountdown(expirySecondsLeft)}`
                          : 'Verification code expired — please request a new code.'}
                      </span>
                    </div>

                    <div>
                      <label
                        htmlFor="otp-code-input"
                        className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]"
                      >
                        6-Digit Verification Code
                      </label>
                      <input
                        id="otp-code-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) =>
                          setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="000000"
                        className="mt-1.5 w-full border border-white/15 bg-[#000000] px-4 py-3.5 font-mono text-2xl tracking-[0.4em] text-[var(--voting-accent,#AEDD00)] placeholder:text-white/20 focus:border-[var(--voting-accent,#AEDD00)] focus:outline-none tabular-nums"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={submitting || expirySecondsLeft === 0}
                        className="inline-flex min-h-[48px] items-center justify-center gap-2 bg-[var(--voting-accent,#AEDD00)] px-7 py-3 text-xs font-bold uppercase tracking-wider text-[var(--voting-accent-fg,#000000)] transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        <Lock className="h-4 w-4" />
                        <span>{submitting ? 'Verifying...' : 'Verify'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={submitting || resendCooldownLeft > 0}
                        onClick={() => void handleRequestOtp()}
                        className="inline-flex min-h-[48px] items-center justify-center border border-white/20 bg-[#000000] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:border-[var(--voting-accent,#AEDD00)] hover:text-[var(--voting-accent,#AEDD00)] disabled:opacity-45 tabular-nums"
                      >
                        {resendCooldownLeft > 0
                          ? `Resend Code (${resendCooldownLeft}s)`
                          : 'Resend Code'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode('');
                          setStepError(null);
                        }}
                        className="text-xs text-[#A0A0A0] underline hover:text-white"
                      >
                        Change Email
                      </button>
                    </div>
                  </form>
                )}
              </section>
            )}

            {/* STAGE 3 — VOTE SELECTION & FINAL CONFIRMATION */}
            {step === 'confirm-vote' && session?.verified && !hasAlreadyVoted && (
              <section
                aria-label="Confirm your vote"
                className="mt-10 border border-white/15 bg-[#111111] p-6 sm:p-10"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--voting-accent,#AEDD00)]">
                      Step 3 · Confirm Vote
                    </p>
                    <h2 className="mt-1.5 font-display text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl">
                      CONFIRM YOUR SELECTION
                    </h2>
                    <p className="mt-1 font-mono text-xs text-[#A0A0A0]">
                      Verified: {session.maskedEmail}
                      {session.schoolName ? ` · ${session.schoolName}` : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('browse');
                      setStepError(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] hover:text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Submissions</span>
                  </button>
                </div>

                {stepError && (
                  <div
                    role="alert"
                    className="mt-5 flex items-start gap-2.5 border border-red-500/40 bg-red-950/30 p-3.5 text-xs leading-relaxed text-red-200"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <span>{stepError}</span>
                  </div>
                )}

                <div className="mt-6 grid gap-6 lg:grid-cols-12">
                  {/* Selectable Approved Submissions */}
                  <div className="space-y-2.5 lg:col-span-7">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#A0A0A0]">
                      Approved Submissions
                    </p>
                    {submissions.map((film) => {
                      const isChosen = selectedFilm?.id === film.id;
                      return (
                        <button
                          key={film.id}
                          type="button"
                          onClick={() => setSelectedId(film.id)}
                          className={`flex w-full items-center justify-between gap-4 border p-4 text-left transition-colors ${
                            isChosen
                              ? 'border-[var(--voting-accent,#AEDD00)] bg-[#000000]'
                              : 'border-white/10 bg-[#0A0A0A] hover:border-white/25'
                          }`}
                        >
                          <div className="min-w-0">
                            <p
                              className={`font-display text-base font-bold ${
                                isChosen ? 'text-[var(--voting-accent,#AEDD00)]' : 'text-white'
                              }`}
                            >
                              {film.title}
                            </p>
                            <p className="mt-0.5 text-xs text-[#A0A0A0]">{film.schoolName}</p>
                          </div>

                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center border ${
                              isChosen
                                ? 'border-[var(--voting-accent,#AEDD00)] bg-[var(--voting-accent,#AEDD00)] text-[var(--voting-accent-fg,#000000)]'
                                : 'border-white/20 text-transparent'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Confirmation Summary Panel */}
                  <div className="lg:col-span-5">
                    {selectedFilm && (
                      <div className="border border-[var(--voting-accent,#AEDD00)]/45 bg-[#000000] p-6">
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--voting-accent,#AEDD00)]">
                          Final Selection
                        </p>
                        <h3 className="mt-2 font-display text-xl font-bold text-white">
                          {selectedFilm.title}
                        </h3>
                        <p className="mt-1 text-sm text-[#A0A0A0]">{selectedFilm.schoolName}</p>

                        <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-[#A0A0A0]">
                          Once confirmed, your vote cannot be changed or resubmitted from this
                          verified email address.
                        </p>

                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void handleConfirmVote()}
                          className="mt-6 flex min-h-[50px] w-full items-center justify-center bg-[var(--voting-accent,#AEDD00)] px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-[var(--voting-accent-fg,#000000)] transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {submitting ? 'Recording Vote...' : 'Confirm Vote'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* SUBMISSION GRID (STAGE 1) */}
            {step === 'browse' && (
              <section aria-label="Short film submissions" className="mt-10 sm:mt-12">
                {session?.verified && !hasAlreadyVoted && submissions.length > 0 && (
                  <div className="mb-8 flex flex-col justify-between gap-4 border border-[var(--voting-accent,#AEDD00)]/40 bg-[#111111] p-5 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--voting-accent,#AEDD00)]">
                        Email Verified · {session.maskedEmail}
                      </p>
                      <p className="mt-1 text-sm text-[#A0A0A0]">
                        Select Vote on any submission below to record your People&apos;s Choice
                        vote.
                      </p>
                    </div>
                    {selectedFilm && (
                      <button
                        type="button"
                        onClick={() => handleStartVoteFlow(selectedFilm.id)}
                        className="inline-flex min-h-[44px] shrink-0 items-center justify-center bg-[var(--voting-accent,#AEDD00)] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--voting-accent-fg,#000000)] hover:opacity-90"
                      >
                        Proceed to Confirm Vote
                      </button>
                    )}
                  </div>
                )}

                {submissions.length === 0 ? (
                  <div className="border border-white/15 bg-[#111111] p-10 text-center sm:p-12">
                    <Film className="mx-auto h-7 w-7 text-[var(--voting-accent,#AEDD00)]" />
                    <p className="mt-4 font-display text-lg font-bold text-white">
                      No Short Film Submissions Published Yet
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-[#A0A0A0]">
                      Approved short film submissions will appear here once released by the
                      organizers.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => void loadVotingState(true)}
                        className="bg-[var(--voting-accent,#AEDD00)] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--voting-accent-fg,#000000)] transition-opacity hover:opacity-90"
                      >
                        Refresh
                      </button>
                      <Link
                        to="/competitions/short-film"
                        className="border border-white/20 bg-[#000000] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[var(--voting-accent,#AEDD00)] hover:text-[var(--voting-accent,#AEDD00)]"
                      >
                        Short Film Details
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {submissions.map((film) => {
                      const hasThumb =
                        Boolean(film.thumbnailUrl) && !imgErrorMap[film.id];
                      const hasLogo =
                        Boolean(film.schoolLogoUrl && isSafeHttpUrl(film.schoolLogoUrl)) &&
                        !logoErrorMap[film.id];
                      const hasVideo = Boolean(film.videoUrl && isSafeHttpUrl(film.videoUrl));

                      return (
                        <article
                          key={film.id}
                          className="flex flex-col border border-white/15 bg-[#111111]"
                        >
                          {/* Participating School Identity Header */}
                          <div className="flex items-center gap-3.5 border-b border-white/10 bg-[#0A0A0A] px-5 py-3.5">
                            {hasLogo && film.schoolLogoUrl ? (
                              <img
                                src={film.schoolLogoUrl}
                                alt={`${film.schoolName} logo`}
                                referrerPolicy="no-referrer"
                                onError={() => handleLogoError(film.id)}
                                className="h-10 w-10 shrink-0 border border-white/15 bg-[#000000] object-contain p-1"
                              />
                            ) : (
                              <div
                                aria-hidden="true"
                                className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--voting-accent,#AEDD00)]/45 bg-[#111111] font-mono text-xs font-bold tracking-wider text-[var(--voting-accent,#AEDD00)]"
                              >
                                {getSchoolInitials(film.schoolName)}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-[#A0A0A0]">
                                Participating School
                              </span>
                              <p className="truncate font-display text-sm font-bold uppercase tracking-wide text-[var(--voting-accent,#AEDD00)] sm:text-base">
                                {film.schoolName}
                              </p>
                            </div>
                          </div>

                          {/* 16:9 Thumbnail / Preview */}
                          <div className="relative aspect-video w-full overflow-hidden border-b border-white/10 bg-[#080808]">
                            {hasThumb && film.thumbnailUrl ? (
                              <img
                                src={film.thumbnailUrl}
                                alt={`${film.title} — ${film.schoolName}`}
                                referrerPolicy="no-referrer"
                                onError={() => handleImgError(film.id)}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center bg-[#080808] p-4 text-center">
                                <Film className="h-6 w-6 text-[var(--voting-accent,#AEDD00)]" />
                                <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#A0A0A0]">
                                  Film Submission
                                </span>
                              </div>
                            )}

                            {hasVideo && (
                              <button
                                type="button"
                                onClick={() => handleWatchFilm(film)}
                                aria-label={`Watch ${film.title} by ${film.schoolName}`}
                                className="group absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/45"
                              >
                                <span className="flex h-12 w-12 items-center justify-center border border-white/35 bg-[#000000]/85 text-white transition-colors group-hover:border-[var(--voting-accent,#AEDD00)] group-hover:text-[var(--voting-accent,#AEDD00)]">
                                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                                </span>
                              </button>
                            )}
                          </div>

                          {/* Card Body */}
                          <div className="flex flex-1 flex-col justify-between p-6">
                            <div>
                              <h2 className="font-display text-xl font-bold leading-snug text-white">
                                {film.title}
                              </h2>
                              {film.description && (
                                <p className="mt-2.5 text-sm leading-relaxed text-[#A0A0A0]">
                                  {film.description}
                                </p>
                              )}
                            </div>

                            {/* Card Actions */}
                            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
                              {hasVideo && (
                                <button
                                  type="button"
                                  onClick={() => handleWatchFilm(film)}
                                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 border border-white/20 bg-[#000000] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[var(--voting-accent,#AEDD00)] hover:text-[var(--voting-accent,#AEDD00)]"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  <span>Watch Film</span>
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={!votingOpen || hasAlreadyVoted}
                                onClick={() => handleStartVoteFlow(film.id)}
                                className={`inline-flex min-h-[42px] flex-1 items-center justify-center px-4 py-2 text-xs font-bold uppercase tracking-wider transition-opacity ${
                                  votingOpen && !hasAlreadyVoted
                                    ? 'bg-[var(--voting-accent,#AEDD00)] text-[var(--voting-accent-fg,#000000)] hover:opacity-90'
                                    : 'cursor-not-allowed border border-white/10 bg-[#000000] text-white/35'
                                }`}
                              >
                                {hasAlreadyVoted
                                  ? 'Voted'
                                  : votingOpen
                                    ? 'Vote'
                                    : liveVotingStatus === 'closed'
                                      ? 'Closed'
                                      : 'Not Open Yet'}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {!votingOpen && submissions.length > 0 && (
                  <p className="mt-8 text-center font-mono text-xs uppercase tracking-[0.16em] text-[#A0A0A0]">
                    {liveVotingStatus === 'closed'
                      ? 'Public voting is closed.'
                      : 'Public voting is not open yet. Feel free to preview the submissions above.'}
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Embedded Video Modal */}
      {modalFilm && modalEmbedUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${modalFilm.title} video player`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-6"
          onClick={() => setModalFilm(null)}
        >
          <div
            className="w-full max-w-4xl border border-white/20 bg-[#111111]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--voting-accent,#AEDD00)]">
                  {modalFilm.schoolName}
                </p>
                <h3 className="truncate font-display text-lg font-bold text-white">
                  {modalFilm.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setModalFilm(null)}
                aria-label="Close video player"
                className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/20 bg-[#000000] text-white hover:border-[var(--voting-accent,#AEDD00)] hover:text-[var(--voting-accent,#AEDD00)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative aspect-video w-full bg-[#000000]">
              <iframe
                src={modalEmbedUrl}
                title={`${modalFilm.title} — ${modalFilm.schoolName}`}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3.5">
              {modalFilm.videoUrl && isSafeHttpUrl(modalFilm.videoUrl) ? (
                <a
                  href={modalFilm.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] hover:text-white"
                >
                  <span>Open Video Link</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span />
              )}

              {votingOpen && !hasAlreadyVoted && (
                <button
                  type="button"
                  onClick={() => handleStartVoteFlow(modalFilm.id)}
                  className="inline-flex min-h-[40px] items-center justify-center bg-[var(--voting-accent,#AEDD00)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[var(--voting-accent-fg,#000000)] hover:opacity-90"
                >
                  Vote for This Film
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Minimal Footer */}
      <footer className="border-t border-white/10 bg-[var(--voting-surface,#050505)] py-7">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-3 px-4 text-xs text-[#A0A0A0] sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <span>
            &copy; {new Date().getFullYear()} InfraX · {EVENT_CONFIG.organizerShort}
          </span>
          <Link
            to="/"
            className="text-white transition-colors hover:text-[var(--voting-accent,#AEDD00)]"
          >
            Return to InfraX Home
          </Link>
        </div>
      </footer>
    </div>
  );
}

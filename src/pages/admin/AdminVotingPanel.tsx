import {
  AlertCircle,
  CheckCircle2,
  Download,
  Film,
  Palette,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addAdminApprovedVoters,
  addAdminInvitedSchool,
  computeLiveVotingStatus,
  createAdminSubmission,
  DEFAULT_VOTING_THEME,
  deleteAdminApprovedVoter,
  deleteAdminInvitedSchool,
  deleteAdminSubmission,
  downloadAdminResultsCsv,
  fetchAdminVotingOverview,
  fromColomboDatetimeLocal,
  saveAdminVotingSettings,
  sanitizeVotingHex,
  toColomboDatetimeLocal,
  updateAdminInvitedSchool,
  updateAdminSubmission,
  uploadAdminSubmissionThumbnail,
  type AdminFilmSubmission,
  type AdminVotingOverview,
  type EligibilityMode,
} from '../../lib/votingApi';

type SubTab = 'submissions' | 'schedule' | 'results';

interface AdminVotingPanelProps {
  onNotify: (type: 'success' | 'error', text: string) => void;
  onConfirm: (action: {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }) => void;
}

const ACCENT_PRESETS = [
  { label: 'InfraX Lime', value: '#AEDD00' },
  { label: 'Electric Cyan', value: '#22D3EE' },
  { label: 'Cinema Amber', value: '#F59E0B' },
  { label: 'Neon Emerald', value: '#34D399' },
  { label: 'Stage Rose', value: '#FB7185' },
];

const SURFACE_PRESETS = [
  { label: 'Obsidian (#050505)', value: '#050505' },
  { label: 'Pure Black (#000000)', value: '#000000' },
  { label: 'Deep Slate (#0A0E14)', value: '#0A0E14' },
  { label: 'Charcoal (#111111)', value: '#111111' },
];

function getContrastTextColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#050505';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#050505' : '#FFFFFF';
}

export function AdminVotingPanel({ onNotify, onConfirm }: AdminVotingPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>('submissions');
  const [overview, setOverview] = useState<AdminVotingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Add Submission form
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolLogoUrl, setNewSchoolLogoUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newThumbUrl, setNewThumbUrl] = useState('');
  const [newThumbFile, setNewThumbFile] = useState<File | null>(null);

  // Editable submissions map
  const [subDrafts, setSubDrafts] = useState<
    Record<
      string,
      {
        schoolName: string;
        schoolLogoUrl: string;
        title: string;
        description: string;
        videoUrl: string;
        thumbnailUrl: string;
        enabled: boolean;
      }
    >
  >({});

  // Judges scores map
  const [judgeDrafts, setJudgeDrafts] = useState<Record<string, string>>({});

  // Schedule, theme & eligibility state
  const [isOpen, setIsOpen] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [opensAtLocal, setOpensAtLocal] = useState('');
  const [closesAtLocal, setClosesAtLocal] = useState('');
  const [eligibilityMode, setEligibilityMode] = useState<EligibilityMode>('invited_school');

  // Public Voting Theme state
  const [themeLabel, setThemeLabel] = useState(DEFAULT_VOTING_THEME.label);
  const [themeTitle, setThemeTitle] = useState(DEFAULT_VOTING_THEME.title);
  const [themeAccent, setThemeAccent] = useState(DEFAULT_VOTING_THEME.accentColor);
  const [themeSurface, setThemeSurface] = useState(DEFAULT_VOTING_THEME.surfaceColor);

  // Invited schools form
  const [inviteSchoolName, setInviteSchoolName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // Approved voters form
  const [voterSchoolId, setVoterSchoolId] = useState('');
  const [voterEmailsText, setVoterEmailsText] = useState('');

  const loadOverview = useCallback(async () => {
    try {
      const data = await fetchAdminVotingOverview();
      setOverview(data);

      const nextSubDrafts: Record<
        string,
        {
          schoolName: string;
          schoolLogoUrl: string;
          title: string;
          description: string;
          videoUrl: string;
          thumbnailUrl: string;
          enabled: boolean;
        }
      > = {};
      const nextJudgeDrafts: Record<string, string> = {};

      for (const s of data.submissions) {
        nextSubDrafts[s.id] = {
          schoolName: s.schoolName,
          schoolLogoUrl: s.schoolLogoUrl ?? '',
          title: s.title,
          description: s.description,
          videoUrl: s.videoUrl ?? '',
          thumbnailUrl: s.thumbnailUrl ?? '',
          enabled: s.enabled,
        };
        nextJudgeDrafts[s.id] = String(s.judgesScore);
      }

      setSubDrafts(nextSubDrafts);
      setJudgeDrafts(nextJudgeDrafts);

      setIsOpen(data.settings.isOpen);
      setManualPaused(Boolean(data.settings.manualPaused));
      setOpensAtLocal(toColomboDatetimeLocal(data.settings.opensAt));
      setClosesAtLocal(toColomboDatetimeLocal(data.settings.closesAt));
      setEligibilityMode(data.settings.eligibilityMode);

      const theme = data.settings.theme ?? DEFAULT_VOTING_THEME;
      setThemeLabel(theme.label || DEFAULT_VOTING_THEME.label);
      setThemeTitle(theme.title || DEFAULT_VOTING_THEME.title);
      setThemeAccent(theme.accentColor || DEFAULT_VOTING_THEME.accentColor);
      setThemeSurface(theme.surfaceColor || DEFAULT_VOTING_THEME.surfaceColor);

      if (data.schools.length > 0) {
        setVoterSchoolId((prev) => prev || data.schools[0].id);
      }
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'Unable to load voting overview.'
      );
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleAddSubmission = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim() || !newTitle.trim()) {
      onNotify('error', 'School name and film title are required.');
      return;
    }

    setBusyKey('add-sub');
    try {
      const created = await createAdminSubmission({
        schoolName: newSchoolName.trim(),
        schoolLogoUrl: newSchoolLogoUrl.trim() || null,
        title: newTitle.trim(),
        description: newDesc.trim(),
        videoUrl: newVideoUrl.trim() || null,
        thumbnailUrl: newThumbUrl.trim() || null,
        enabled: true,
      });

      if (newThumbFile) {
        await uploadAdminSubmissionThumbnail(created.submission.id, newThumbFile);
      }

      setNewSchoolName('');
      setNewSchoolLogoUrl('');
      setNewTitle('');
      setNewDesc('');
      setNewVideoUrl('');
      setNewThumbUrl('');
      setNewThumbFile(null);
      const fileInput = document.getElementById('new-sub-thumb') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';

      await loadOverview();
      onNotify('success', 'Short film submission added.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to add submission.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveSubmission = async (sub: AdminFilmSubmission) => {
    const draft = subDrafts[sub.id];
    if (!draft) return;
    setBusyKey(`save-sub-${sub.id}`);
    try {
      await updateAdminSubmission(sub.id, {
        schoolName: draft.schoolName,
        schoolLogoUrl: draft.schoolLogoUrl.trim() || null,
        title: draft.title,
        description: draft.description,
        videoUrl: draft.videoUrl.trim() || null,
        thumbnailUrl: draft.thumbnailUrl.trim() || null,
        enabled: draft.enabled,
      });
      await loadOverview();
      onNotify('success', `Saved "${draft.title}".`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update submission.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleReplaceThumbnail = async (subId: string, file: File | null) => {
    if (!file) return;
    setBusyKey(`thumb-${subId}`);
    try {
      await uploadAdminSubmissionThumbnail(subId, file);
      await loadOverview();
      onNotify('success', 'Thumbnail uploaded and updated.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to upload thumbnail.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteSubmission = (sub: AdminFilmSubmission) => {
    onConfirm({
      title: 'Remove Short Film Submission',
      message: `Remove "${sub.title}" (${sub.schoolName}) and exclude any votes cast for it? This action cannot be undone.`,
      confirmLabel: 'Remove Submission',
      onConfirm: async () => {
        setBusyKey(`del-sub-${sub.id}`);
        try {
          await deleteAdminSubmission(sub.id);
          await loadOverview();
          onNotify('success', `Removed "${sub.title}".`);
        } catch (err) {
          onNotify('error', err instanceof Error ? err.message : 'Delete failed.');
        } finally {
          setBusyKey(null);
        }
      },
    });
  };

  const hasScheduleConfigured = Boolean(opensAtLocal.trim() || closesAtLocal.trim());

  const draftVotingStatus = useMemo(
    () =>
      computeLiveVotingStatus({
        votingStatus: manualPaused ? 'disabled' : isOpen ? 'open' : 'disabled',
        opensAt: fromColomboDatetimeLocal(opensAtLocal),
        closesAt: fromColomboDatetimeLocal(closesAtLocal),
        manualPaused,
      }),
    [opensAtLocal, closesAtLocal, manualPaused, isOpen]
  );

  const handleApplyOneWeekWindow = () => {
    const now = Date.now();
    const oneWeekLater = now + 7 * 24 * 60 * 60 * 1000;
    setOpensAtLocal(toColomboDatetimeLocal(new Date(now).toISOString()));
    setClosesAtLocal(toColomboDatetimeLocal(new Date(oneWeekLater).toISOString()));
    setManualPaused(false);
    setIsOpen(true);
  };

  const handleCloseVotingNow = () => {
    const pastIso = new Date(Date.now() - 60 * 1000).toISOString();
    if (!opensAtLocal) {
      setOpensAtLocal(toColomboDatetimeLocal(new Date(Date.now() - 3600 * 1000).toISOString()));
    }
    setClosesAtLocal(toColomboDatetimeLocal(pastIso));
    setManualPaused(false);
    setIsOpen(false);
  };

  const handleClearSchedule = () => {
    setOpensAtLocal('');
    setClosesAtLocal('');
  };

  const handleResetThemeDefaults = () => {
    setThemeLabel(DEFAULT_VOTING_THEME.label);
    setThemeTitle(DEFAULT_VOTING_THEME.title);
    setThemeAccent(DEFAULT_VOTING_THEME.accentColor);
    setThemeSurface(DEFAULT_VOTING_THEME.surfaceColor);
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setBusyKey('save-settings');
    try {
      const opensIso = fromColomboDatetimeLocal(opensAtLocal);
      const closesIso = fromColomboDatetimeLocal(closesAtLocal);
      const normalizedAccent = sanitizeVotingHex(themeAccent, DEFAULT_VOTING_THEME.accentColor);
      const normalizedSurface = sanitizeVotingHex(themeSurface, DEFAULT_VOTING_THEME.surfaceColor);

      await saveAdminVotingSettings({
        isOpen,
        manualPaused,
        opensAt: opensIso,
        closesAt: closesIso,
        eligibilityMode,
        theme: {
          label: themeLabel.trim() || DEFAULT_VOTING_THEME.label,
          title: themeTitle.trim() || DEFAULT_VOTING_THEME.title,
          accentColor: normalizedAccent,
          surfaceColor: normalizedSurface,
        },
      });
      await loadOverview();
      onNotify('success', 'Voting schedule, theme, and eligibility settings saved.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddSchool = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteSchoolName.trim()) {
      onNotify('error', 'Please enter the invited school name.');
      return;
    }
    setBusyKey('add-school');
    try {
      await addAdminInvitedSchool({
        schoolName: inviteSchoolName.trim(),
        invitationCode: inviteCode.trim() || undefined,
        isEligible: true,
      });
      setInviteSchoolName('');
      setInviteCode('');
      await loadOverview();
      onNotify('success', 'Invited school added.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to add school.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleSchoolEligibility = async (schoolId: string, nextVal: boolean) => {
    setBusyKey(`sch-${schoolId}`);
    try {
      await updateAdminInvitedSchool(schoolId, { isEligible: nextVal });
      await loadOverview();
      onNotify('success', nextVal ? 'School enabled for voting.' : 'School disabled.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to update school.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddVoters = async (e: FormEvent) => {
    e.preventDefault();
    const emails = voterEmailsText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!voterSchoolId || emails.length === 0) {
      onNotify('error', 'Select an invited school and enter at least one email address.');
      return;
    }
    setBusyKey('add-voters');
    try {
      const res = await addAdminApprovedVoters({ schoolId: voterSchoolId, emails });
      setVoterEmailsText('');
      await loadOverview();
      onNotify(
        'success',
        `Added ${res.added} approved voter(s)${res.skipped ? ` (${res.skipped} skipped/duplicate)` : ''}.`
      );
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to add voters.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveJudgeScore = async (subId: string) => {
    const raw = Number(judgeDrafts[subId]);
    if (Number.isNaN(raw) || raw < 0 || raw > 70) {
      onNotify('error', 'Judges score must be between 0 and 70.');
      return;
    }
    setBusyKey(`judge-${subId}`);
    try {
      await updateAdminSubmission(subId, { judgesScore: raw });
      await loadOverview();
      onNotify('success', 'Judges score updated.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to save score.');
    } finally {
      setBusyKey(null);
    }
  };

  if (loading || !overview) {
    return (
      <div className="py-16 text-center font-mono text-xs uppercase tracking-[0.2em] text-[#A0A0A0]">
        Loading Short Film Voting Module...
      </div>
    );
  }

  const rankedResults = [...overview.submissions].sort((a, b) => b.finalScore - a.finalScore);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#AEDD00]">
            People&apos;s Choice · 70% Judges / 30% Public Vote
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold uppercase tracking-tight text-white">
            Short Film Voting
          </h1>
        </div>

        <span className="font-mono text-xs uppercase tracking-wider text-[#AEDD00]">
          Live Status: {overview.votingStatus}
        </span>
      </div>

      {/* Email Delivery Diagnostic Banner */}
      <div
        className={`flex items-start gap-2.5 border p-3.5 text-xs leading-relaxed ${
          overview.emailDelivery.configured
            ? 'border-[#AEDD00]/30 bg-[#111111] text-[#A0A0A0]'
            : 'border-amber-500/40 bg-amber-950/20 text-amber-200'
        }`}
      >
        {overview.emailDelivery.configured ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#AEDD00]" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        )}
        <span>
          {overview.emailDelivery.configured
            ? `Email OTP delivery active via ${overview.emailDelivery.provider?.toUpperCase()}.`
            : 'OTP Email delivery is not configured yet. Configure RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS in your server Secrets before opening voting.'}
        </span>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'submissions', label: `Submissions (${overview.submissions.length})` },
            { id: 'schedule', label: 'Schedule, Theme & Eligibility' },
            { id: 'results', label: 'Results & Judges Scores' },
          ] as { id: SubTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              subTab === tab.id
                ? 'border-[#AEDD00] bg-[#AEDD00] text-[#050505]'
                : 'border-white/15 bg-[#111111] text-[#A0A0A0] hover:border-white/30 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBTAB 1: SUBMISSIONS */}
      {subTab === 'submissions' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddSubmission}
            className="space-y-4 border border-white/10 bg-[#111111] p-6"
          >
            <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white">
              Add Short Film Submission
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                  Participating School Name
                </label>
                <input
                  type="text"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  placeholder="e.g. Kegalu Vidyalaya"
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                  Film Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Beyond the Screen"
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                  Video URL (YouTube / Vimeo / Drive / Link)
                </label>
                <input
                  type="url"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                  Upload Thumbnail (Optional, Max 2 MB)
                </label>
                <input
                  id="new-sub-thumb"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setNewThumbFile(e.target.files?.[0] ?? null)}
                  className="mt-1.5 block w-full border border-white/15 bg-[#050505] px-3 py-1.5 text-xs text-[#A0A0A0] file:mr-3 file:border-0 file:bg-[#AEDD00] file:px-3 file:py-1 file:text-[11px] file:font-bold file:uppercase file:text-[#050505]"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                  Short Description (Optional)
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief film synopsis"
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                  School Logo URL (Optional)
                </label>
                <input
                  type="url"
                  value={newSchoolLogoUrl}
                  onChange={(e) => setNewSchoolLogoUrl(e.target.value)}
                  placeholder="https://.../school-crest.png"
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                  Or External Thumbnail URL
                </label>
                <input
                  type="url"
                  value={newThumbUrl}
                  onChange={(e) => setNewThumbUrl(e.target.value)}
                  placeholder="Optional https://..."
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busyKey === 'add-sub'}
                className="inline-flex items-center gap-2 bg-[#AEDD00] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>{busyKey === 'add-sub' ? 'Adding...' : 'Add Submission'}</span>
              </button>
            </div>
          </form>

          {/* Existing Submissions */}
          <div className="space-y-4">
            {overview.submissions.map((sub) => {
              const draft = subDrafts[sub.id];
              if (!draft) return null;
              return (
                <div
                  key={sub.id}
                  className="border border-white/10 bg-[#111111] p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="aspect-video w-16 overflow-hidden border border-white/10 bg-[#050505]">
                        {sub.thumbnailUrl ? (
                          <img
                            src={sub.thumbnailUrl}
                            alt={sub.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Film className="h-4 w-4 text-white/30" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-display text-base font-bold text-white">
                          {sub.title}
                        </h3>
                        <p className="text-xs text-[#A0A0A0]">{sub.schoolName}</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white">
                      <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(e) =>
                          setSubDrafts((prev) => ({
                            ...prev,
                            [sub.id]: { ...draft, enabled: e.target.checked },
                          }))
                        }
                        className="h-4 w-4 accent-[#AEDD00]"
                      />
                      <span>{draft.enabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                        School Name
                      </label>
                      <input
                        type="text"
                        value={draft.schoolName}
                        onChange={(e) =>
                          setSubDrafts((prev) => ({
                            ...prev,
                            [sub.id]: { ...draft, schoolName: e.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                        Film Title
                      </label>
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) =>
                          setSubDrafts((prev) => ({
                            ...prev,
                            [sub.id]: { ...draft, title: e.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                        Video URL
                      </label>
                      <input
                        type="url"
                        value={draft.videoUrl}
                        onChange={(e) =>
                          setSubDrafts((prev) => ({
                            ...prev,
                            [sub.id]: { ...draft, videoUrl: e.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                        Thumbnail URL
                      </label>
                      <input
                        type="text"
                        value={draft.thumbnailUrl}
                        onChange={(e) =>
                          setSubDrafts((prev) => ({
                            ...prev,
                            [sub.id]: { ...draft, thumbnailUrl: e.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                        Short Description
                      </label>
                      <input
                        type="text"
                        value={draft.description}
                        onChange={(e) =>
                          setSubDrafts((prev) => ({
                            ...prev,
                            [sub.id]: { ...draft, description: e.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                        School Logo URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={draft.schoolLogoUrl}
                        onChange={(e) =>
                          setSubDrafts((prev) => ({
                            ...prev,
                            [sub.id]: { ...draft, schoolLogoUrl: e.target.value },
                          }))
                        }
                        placeholder="https://.../school-crest.png"
                        className="mt-1 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex cursor-pointer items-center gap-2 border border-white/20 bg-[#050505] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white hover:border-[#AEDD00] hover:text-[#AEDD00]">
                      <Upload className="h-3.5 w-3.5" />
                      <span>
                        {busyKey === `thumb-${sub.id}`
                          ? 'Uploading...'
                          : 'Upload / Replace Thumbnail'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          void handleReplaceThumbnail(sub.id, e.target.files?.[0] ?? null);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteSubmission(sub)}
                        className="inline-flex items-center gap-1.5 border border-red-500/30 bg-[#050505] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-red-300 hover:border-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>

                      <button
                        type="button"
                        disabled={busyKey === `save-sub-${sub.id}`}
                        onClick={() => void handleSaveSubmission(sub)}
                        className="bg-[#AEDD00] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216] disabled:opacity-50"
                      >
                        {busyKey === `save-sub-${sub.id}` ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: VOTING SCHEDULE, THEME & ELIGIBILITY */}
      {subTab === 'schedule' && (
        <div className="space-y-8">
          {/* Voting Window + Theme Form */}
          <form
            onSubmit={handleSaveSettings}
            className="space-y-6 border border-white/10 bg-[#111111] p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                  Voting Schedule &amp; Verification Mode
                </h2>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                  All schedule times use Sri Lanka Standard Time (Asia/Colombo · UTC+05:30).
                  Computed state:{' '}
                  <span className="text-[#AEDD00]">{draftVotingStatus}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleApplyOneWeekWindow}
                  className="border border-white/20 bg-[#050505] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#AEDD00] hover:border-[#AEDD00]"
                >
                  Set 1-Week Window
                </button>
                <button
                  type="button"
                  onClick={handleCloseVotingNow}
                  className="border border-white/20 bg-[#050505] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white hover:border-red-400 hover:text-red-300"
                >
                  Close Voting Now
                </button>
                {hasScheduleConfigured && (
                  <button
                    type="button"
                    onClick={handleClearSchedule}
                    className="border border-white/15 bg-[#050505] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#A0A0A0] hover:border-white/40 hover:text-white"
                  >
                    Clear Schedule
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                  Opening Date &amp; Time (SLST · Asia/Colombo)
                </label>
                <input
                  type="datetime-local"
                  value={opensAtLocal}
                  onChange={(e) => setOpensAtLocal(e.target.value)}
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                  Closing Date &amp; Time (SLST · Asia/Colombo)
                </label>
                <input
                  type="datetime-local"
                  value={closesAtLocal}
                  onChange={(e) => setClosesAtLocal(e.target.value)}
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                  Eligibility Verification Mode
                </label>
                <select
                  value={eligibilityMode}
                  onChange={(e) => setEligibilityMode(e.target.value as EligibilityMode)}
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                >
                  <option value="invited_school">
                    Invited Schools + Email OTP (Gmail, Outlook &amp; School Emails)
                  </option>
                  <option value="both">
                    Approved Voter List OR School Invitation Code
                  </option>
                  <option value="approved_list">Approved Voter List Only</option>
                  <option value="invitation_code">School Invitation Codes Only</option>
                </select>
                {eligibilityMode === 'approved_list' && overview.voters.length === 0 && (
                  <p className="mt-1.5 text-[11px] text-amber-300">
                    Warning: Approved Voter List is currently empty. Add approved emails below or
                    switch to Invited Schools + Email OTP so voters do not receive 403 errors.
                  </p>
                )}
              </div>

              <div className="flex flex-col justify-end gap-2 pb-1">
                <label className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-white">
                  <input
                    type="checkbox"
                    checked={manualPaused}
                    onChange={(e) => setManualPaused(e.target.checked)}
                    className="h-4 w-4 accent-[#AEDD00]"
                  />
                  <span>Pause Voting Manually (Override Schedule)</span>
                </label>

                {!hasScheduleConfigured && !manualPaused && (
                  <label className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">
                    <input
                      type="checkbox"
                      checked={isOpen}
                      onChange={(e) => setIsOpen(e.target.checked)}
                      className="h-4 w-4 accent-[#AEDD00]"
                    />
                    <span>Manual Open (When No Schedule Set)</span>
                  </label>
                )}

                {hasScheduleConfigured && !manualPaused && (
                  <p className="text-[11px] text-[#A0A0A0]">
                    Schedule active: public voting opens and closes automatically at the
                    configured SLST timestamps.
                  </p>
                )}
              </div>
            </div>

            {/* Public Voting Theme Section */}
            <div className="space-y-4 border-t border-white/10 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-[#AEDD00]" />
                  <h3 className="font-display text-base font-bold uppercase tracking-tight text-white">
                    Public Voting Theme
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleResetThemeDefaults}
                  className="text-[11px] font-semibold uppercase tracking-wider text-[#A0A0A0] underline hover:text-white"
                >
                  Reset Theme Defaults
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                    Voting Header Eyebrow Label
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={themeLabel}
                    onChange={(e) => setThemeLabel(e.target.value)}
                    placeholder="INFRAX SHORT FILM COMPETITION"
                    className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                    Voting Theme Subtitle / Tagline
                  </label>
                  <input
                    type="text"
                    maxLength={140}
                    value={themeTitle}
                    onChange={(e) => setThemeTitle(e.target.value)}
                    placeholder="Your choice. Your voice."
                    className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                    Accent Color
                  </label>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <input
                      type="color"
                      value={sanitizeVotingHex(themeAccent, DEFAULT_VOTING_THEME.accentColor)}
                      onChange={(e) => setThemeAccent(e.target.value.toUpperCase())}
                      aria-label="Pick voting accent color"
                      className="h-9 w-12 cursor-pointer border border-white/20 bg-[#050505] p-0.5"
                    />
                    <input
                      type="text"
                      value={themeAccent}
                      onChange={(e) => setThemeAccent(e.target.value.toUpperCase())}
                      placeholder="#AEDD00"
                      className="w-28 border border-white/15 bg-[#050505] px-3 py-2 font-mono text-xs uppercase text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {ACCENT_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          title={preset.label}
                          onClick={() => setThemeAccent(preset.value)}
                          style={{ backgroundColor: preset.value }}
                          className={`h-6 w-6 border ${
                            themeAccent.toUpperCase() === preset.value
                              ? 'border-white ring-1 ring-white'
                              : 'border-white/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                    Page Surface Color
                  </label>
                  <select
                    value={sanitizeVotingHex(themeSurface, DEFAULT_VOTING_THEME.surfaceColor)}
                    onChange={(e) => setThemeSurface(e.target.value)}
                    className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                  >
                    {SURFACE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Public Theme Preview */}
              <div
                style={{
                  backgroundColor: sanitizeVotingHex(
                    themeSurface,
                    DEFAULT_VOTING_THEME.surfaceColor
                  ),
                }}
                className="flex flex-wrap items-center justify-between gap-4 border border-white/15 p-4"
              >
                <div>
                  <p
                    style={{
                      color: sanitizeVotingHex(themeAccent, DEFAULT_VOTING_THEME.accentColor),
                    }}
                    className="font-mono text-[10px] uppercase tracking-[0.2em]"
                  >
                    {themeLabel.trim() || DEFAULT_VOTING_THEME.label}
                  </p>
                  <p className="mt-1 font-display text-base font-bold text-white">
                    {themeTitle.trim() || DEFAULT_VOTING_THEME.title}
                  </p>
                </div>
                <span
                  style={{
                    backgroundColor: sanitizeVotingHex(
                      themeAccent,
                      DEFAULT_VOTING_THEME.accentColor
                    ),
                    color: getContrastTextColor(
                      sanitizeVotingHex(themeAccent, DEFAULT_VOTING_THEME.accentColor)
                    ),
                  }}
                  className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider"
                >
                  Vote CTA Preview
                </span>
              </div>
            </div>

            <div className="flex justify-end border-t border-white/10 pt-4">
              <button
                type="submit"
                disabled={busyKey === 'save-settings'}
                className="bg-[#AEDD00] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216] disabled:opacity-50"
              >
                {busyKey === 'save-settings' ? 'Saving...' : 'Save Schedule & Theme'}
              </button>
            </div>
          </form>

          {/* Invited Schools */}
          <div className="space-y-4 border border-white/10 bg-[#111111] p-6">
            <div>
              <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                Invited Schools &amp; Invitation Codes
              </h2>
              <p className="mt-1 text-xs text-[#A0A0A0]">
                Only invited schools listed below are eligible. Bandaranayaka College (organizing
                school) is automatically excluded from public voting.
              </p>
            </div>

            <form onSubmit={handleAddSchool} className="grid gap-3 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  value={inviteSchoolName}
                  onChange={(e) => setInviteSchoolName(e.target.value)}
                  placeholder="Invited school name (e.g. Kegalu Vidyalaya)"
                  className="w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-4">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Invitation code (auto if blank)"
                  className="w-full border border-white/15 bg-[#050505] px-3 py-2 font-mono text-xs uppercase text-white focus:border-[#AEDD00] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={busyKey === 'add-school'}
                  className="w-full bg-[#AEDD00] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216]"
                >
                  Add
                </button>
              </div>
            </form>

            {overview.schools.length === 0 ? (
              <p className="text-xs text-[#A0A0A0]">No invited schools added yet.</p>
            ) : (
              <div className="divide-y divide-white/10 border border-white/10 bg-[#050505]">
                {overview.schools.map((sch) => (
                  <div
                    key={sch.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">{sch.schoolName}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-[#AEDD00]">
                        Code: {sch.invitationCode}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleToggleSchoolEligibility(sch.id, !sch.isEligible)
                        }
                        className={`border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
                          sch.isEligible
                            ? 'border-[#AEDD00]/40 text-[#AEDD00]'
                            : 'border-white/20 text-[#A0A0A0]'
                        }`}
                      >
                        {sch.isEligible ? 'Eligible' : 'Disabled'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onConfirm({
                            title: 'Remove Invited School',
                            message: `Remove "${sch.schoolName}" from invited schools?`,
                            confirmLabel: 'Remove School',
                            onConfirm: async () => {
                              await deleteAdminInvitedSchool(sch.id);
                              await loadOverview();
                              onNotify('success', 'School removed.');
                            },
                          })
                        }
                        className="border border-red-500/30 px-2.5 py-1.5 text-[11px] font-semibold uppercase text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approved Voter Emails */}
          <div className="space-y-4 border border-white/10 bg-[#111111] p-6">
            <div>
              <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                Approved Voter List ({overview.voters.length})
              </h2>
              <p className="mt-1 text-xs text-[#A0A0A0]">
                Paste approved student email addresses (one per line or comma-separated) assigned
                to an invited school.
              </p>
            </div>

            <form onSubmit={handleAddVoters} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={voterSchoolId}
                  onChange={(e) => setVoterSchoolId(e.target.value)}
                  className="w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                >
                  {overview.schools.length === 0 ? (
                    <option value="">Add an invited school above first</option>
                  ) : (
                    overview.schools.map((sch) => (
                      <option key={sch.id} value={sch.id}>
                        {sch.schoolName}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <textarea
                rows={3}
                value={voterEmailsText}
                onChange={(e) => setVoterEmailsText(e.target.value)}
                placeholder={'student1@gmail.com\nstudent2@school.lk'}
                className="w-full border border-white/15 bg-[#050505] px-3 py-2 font-mono text-xs text-white focus:border-[#AEDD00] focus:outline-none"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busyKey === 'add-voters' || overview.schools.length === 0}
                  className="bg-[#AEDD00] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216] disabled:opacity-50"
                >
                  Add Approved Voters
                </button>
              </div>
            </form>

            {overview.voters.length > 0 && (
              <div className="max-h-64 overflow-y-auto divide-y divide-white/10 border border-white/10 bg-[#050505]">
                {overview.voters.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-white">{v.email}</span>
                      <span className="ml-2 text-[#A0A0A0]">· {v.schoolName}</span>
                      {v.hasVoted && (
                        <span className="ml-2 font-mono text-[10px] uppercase text-[#AEDD00]">
                          Voted
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void (async () => {
                          await deleteAdminApprovedVoter(v.id);
                          await loadOverview();
                        })()
                      }
                      className="text-red-300 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: RESULTS & JUDGES SCORES (PERCENTAGES ONLY — NO RAW VOTE COUNTS) */}
      {subTab === 'results' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#A0A0A0]">
              Final Score = Judges&apos; Score (70%) + Public Voting Share Score (30%).
              Percentages only; accessible after voting closes.
            </p>
            <button
              type="button"
              onClick={() => void downloadAdminResultsCsv()}
              className="inline-flex items-center gap-2 border border-white/20 bg-[#111111] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:border-[#AEDD00] hover:text-[#AEDD00]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Final Results (CSV)</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-white/10 bg-[#111111]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-[#050505] font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">School &amp; Film</th>
                  <th className="px-4 py-3">Public Vote %</th>
                  <th className="px-4 py-3">Public (/30)</th>
                  <th className="px-4 py-3">Judges (/70)</th>
                  <th className="px-4 py-3">Final (/100)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rankedResults.map((sub, index) => (
                  <tr key={sub.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5 font-mono font-bold text-[#AEDD00] tabular-nums">
                      #{index + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-white">{sub.title}</p>
                      <p className="text-[#A0A0A0]">
                        {sub.schoolName} {!sub.enabled && '· Disabled'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-white tabular-nums">
                      {sub.votePercentage.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3.5 font-mono text-white tabular-nums">
                      {sub.publicScore.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={70}
                          step={0.5}
                          value={judgeDrafts[sub.id] ?? '0'}
                          onChange={(e) =>
                            setJudgeDrafts((prev) => ({
                              ...prev,
                              [sub.id]: e.target.value,
                            }))
                          }
                          className="w-20 border border-white/15 bg-[#050505] px-2.5 py-1.5 font-mono text-xs text-white focus:border-[#AEDD00] focus:outline-none tabular-nums"
                        />
                        <button
                          type="button"
                          disabled={busyKey === `judge-${sub.id}`}
                          onClick={() => void handleSaveJudgeScore(sub.id)}
                          className="bg-[#AEDD00] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216]"
                        >
                          Save
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-sm font-bold text-[#AEDD00] tabular-nums">
                      {sub.finalScore.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

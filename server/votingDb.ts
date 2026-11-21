import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type EligibilityMode = 'invited_school' | 'both' | 'approved_list' | 'invitation_code';
export type VotingWindowStatus = 'open' | 'upcoming' | 'closed' | 'disabled';

export interface VotingThemeConfig {
  label: string;
  title: string;
  accentColor: string;
  surfaceColor: string;
}

export interface VotingSettingsRow {
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  eligibilityMode: EligibilityMode;
  manualPaused: boolean;
  theme: VotingThemeConfig;
  updatedAt: string;
}

export interface PublicSubmission {
  id: string;
  schoolName: string;
  schoolLogoUrl: string | null;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  displayOrder: number;
}

export interface AdminSubmission extends PublicSubmission {
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

export interface VoterSessionState {
  verified: boolean;
  maskedEmail: string | null;
  schoolName: string | null;
  hasVoted: boolean;
  votedFilmTitle: string | null;
  votedSchoolName: string | null;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'infrax-voting.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS server_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS voting_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    is_open INTEGER NOT NULL DEFAULT 0,
    opens_at TEXT,
    closes_at TEXT,
    eligibility_mode TEXT NOT NULL DEFAULT 'both',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS film_submissions (
    id TEXT PRIMARY KEY,
    school_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    video_url TEXT NOT NULL DEFAULT '',
    thumbnail_url TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    judges_score REAL NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS submission_thumbnails (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invited_schools (
    id TEXT PRIMARY KEY,
    school_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL UNIQUE,
    invitation_code TEXT NOT NULL,
    is_eligible INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS approved_voters (
    id TEXT PRIMARY KEY,
    email_normalized TEXT NOT NULL,
    email_hash TEXT NOT NULL UNIQUE,
    masked_email TEXT NOT NULL,
    school_id TEXT NOT NULL,
    school_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS otp_challenges (
    id TEXT PRIMARY KEY,
    email_hash TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    school_id TEXT NOT NULL,
    school_name TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    resend_available_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS voter_sessions (
    id TEXT PRIMARY KEY,
    email_hash TEXT NOT NULL,
    masked_email TEXT NOT NULL,
    school_id TEXT NOT NULL,
    school_name TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    voted INTEGER NOT NULL DEFAULT 0,
    voted_film_id TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    film_id TEXT NOT NULL,
    email_hash TEXT NOT NULL UNIQUE,
    school_id TEXT NOT NULL,
    school_name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_otp_email_hash ON otp_challenges(email_hash, created_at);
  CREATE INDEX IF NOT EXISTS idx_votes_film_id ON votes(film_id);
`);

function getOrCreateSecret(): string {
  const envSecret = process.env.VOTING_SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }

  const row = db
    .prepare('SELECT value FROM server_meta WHERE key = ?')
    .get('session_secret') as { value: string } | undefined;

  if (row?.value) {
    return row.value;
  }

  const generated = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO server_meta (key, value) VALUES (?, ?)').run(
    'session_secret',
    generated
  );
  return generated;
}

const SERVER_SECRET = getOrCreateSecret();

const submissionCols = db
  .prepare('PRAGMA table_info(film_submissions)')
  .all() as { name: string }[];
if (!submissionCols.some((col) => col.name === 'school_logo_url')) {
  db.exec(`ALTER TABLE film_submissions ADD COLUMN school_logo_url TEXT NOT NULL DEFAULT '';`);
}

const settingsCols = db
  .prepare('PRAGMA table_info(voting_settings)')
  .all() as { name: string }[];
if (!settingsCols.some((col) => col.name === 'manual_paused')) {
  db.exec(`ALTER TABLE voting_settings ADD COLUMN manual_paused INTEGER NOT NULL DEFAULT 0;`);
}
if (!settingsCols.some((col) => col.name === 'theme_label')) {
  db.exec(
    `ALTER TABLE voting_settings ADD COLUMN theme_label TEXT NOT NULL DEFAULT 'INFRAX SHORT FILM COMPETITION';`
  );
}
if (!settingsCols.some((col) => col.name === 'theme_title')) {
  db.exec(
    `ALTER TABLE voting_settings ADD COLUMN theme_title TEXT NOT NULL DEFAULT 'Your choice. Your voice.';`
  );
}
if (!settingsCols.some((col) => col.name === 'theme_accent')) {
  db.exec(
    `ALTER TABLE voting_settings ADD COLUMN theme_accent TEXT NOT NULL DEFAULT '#AEDD00';`
  );
}
if (!settingsCols.some((col) => col.name === 'theme_surface')) {
  db.exec(
    `ALTER TABLE voting_settings ADD COLUMN theme_surface TEXT NOT NULL DEFAULT '#050505';`
  );
}

// Initialize default voting settings row once
const existingSettings = db
  .prepare('SELECT id FROM voting_settings WHERE id = 1')
  .get() as { id: number } | undefined;

if (!existingSettings) {
  db.prepare(
    `INSERT INTO voting_settings (id, is_open, opens_at, closes_at, eligibility_mode, manual_paused, theme_label, theme_title, theme_accent, theme_surface, updated_at)
     VALUES (1, 0, NULL, NULL, 'invited_school', 0, 'INFRAX SHORT FILM COMPETITION', 'Your choice. Your voice.', '#AEDD00', '#050505', ?)`
  ).run(new Date().toISOString());
}

// Remove any untouched placeholder rows so only real approved submissions are displayed
db.prepare(
  `DELETE FROM film_submissions
   WHERE id IN ('school-a', 'school-b', 'school-c')
     AND school_name LIKE 'Participating School %Pending Confirmation%'`
).run();

db.prepare('INSERT OR REPLACE INTO server_meta (key, value) VALUES (?, ?)').run(
  'seeded_v1',
  'true'
);

export function normalizeSchoolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isOrganizingSchoolName(name: string): boolean {
  const norm = normalizeSchoolName(name);
  if (!norm) return false;
  if (norm.includes('bandaranayak')) return true;
  if (norm.includes('organizing school') || norm.includes('host school')) return true;
  return false;
}

export function isOrganizingSchoolEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  const atIdx = normalized.lastIndexOf('@');
  if (atIdx < 0) return false;
  const domain = normalized.slice(atIdx + 1);
  if (domain.includes('bandaranayak')) return true;
  return false;
}

export function ensureSubmissionSchoolInInvitedSchools(schoolName: string): void {
  const cleanName = schoolName.trim().slice(0, 140);
  if (!cleanName || isOrganizingSchoolName(cleanName)) return;
  const normalizedName = normalizeSchoolName(cleanName);
  if (!normalizedName) return;

  const existing = db
    .prepare('SELECT id FROM invited_schools WHERE normalized_name = ?')
    .get(normalizedName) as { id: string } | undefined;
  if (existing) return;

  const id = `sch_${crypto.randomUUID().slice(0, 8)}`;
  const code = `INFRAX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  db.prepare(
    `INSERT INTO invited_schools (id, school_name, normalized_name, invitation_code, is_eligible, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`
  ).run(id, cleanName, normalizedName, code, new Date().toISOString());
}

// One-time backfill: ensure enabled non-organizing submission schools exist in invited_schools
const enabledSubmissionSchools = db
  .prepare('SELECT school_name FROM film_submissions WHERE enabled = 1')
  .all() as { school_name: string }[];
for (const subRow of enabledSubmissionSchools) {
  ensureSubmissionSchoolInInvitedSchools(subRow.school_name);
}

// One-time migration: unblock installations stuck in 'approved_list' with 0 approved voters
const migratedV2 = db
  .prepare('SELECT value FROM server_meta WHERE key = ?')
  .get('migrated_invited_school_v1') as { value: string } | undefined;
if (!migratedV2) {
  const settingsModeRow = db
    .prepare('SELECT eligibility_mode FROM voting_settings WHERE id = 1')
    .get() as { eligibility_mode: string } | undefined;
  const voterCountRow = db
    .prepare('SELECT COUNT(*) as cnt FROM approved_voters')
    .get() as { cnt: number };
  if (settingsModeRow?.eligibility_mode === 'approved_list' && voterCountRow.cnt === 0) {
    db.prepare(
      `UPDATE voting_settings SET eligibility_mode = 'invited_school', updated_at = ? WHERE id = 1`
    ).run(new Date().toISOString());
  }
  db.prepare('INSERT OR REPLACE INTO server_meta (key, value) VALUES (?, ?)').run(
    'migrated_invited_school_v1',
    'true'
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailFormat(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (normalized.length < 5 || normalized.length > 160) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function maskEmail(email: string): string {
  const parts = normalizeEmail(email).split('@');
  if (parts.length !== 2) return '***';
  const [local, domain] = parts;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

export function hmacHash(scope: string, value: string): string {
  return crypto.createHmac('sha256', SERVER_SECRET).update(`${scope}:${value}`).digest('hex');
}

export function signSessionCookieValue(sessionId: string): string {
  const sig = hmacHash('cookie', sessionId);
  return `${sessionId}.${sig}`;
}

export function verifySessionCookieValue(rawCookie: string | undefined): string | null {
  if (!rawCookie) return null;
  const dotIdx = rawCookie.indexOf('.');
  if (dotIdx <= 0) return null;
  const sessionId = rawCookie.slice(0, dotIdx);
  const sig = rawCookie.slice(dotIdx + 1);
  if (!/^[a-f0-9-]+$/i.test(sessionId) || !/^[a-f0-9]{64}$/i.test(sig)) {
    return null;
  }
  const expected = hmacHash('cookie', sessionId);
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  return sessionId;
}

const DEFAULT_THEME: VotingThemeConfig = {
  label: 'INFRAX SHORT FILM COMPETITION',
  title: 'Your choice. Your voice.',
  accentColor: '#AEDD00',
  surfaceColor: '#050505',
};

function sanitizeHexColor(raw: string | null | undefined, fallback: string): string {
  const val = (raw ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(val) ? val.toUpperCase() : fallback;
}

function parseTimestampSafe(iso: string | null | undefined): number | null {
  if (!iso || !iso.trim()) return null;
  const ms = Date.parse(iso.trim());
  return Number.isNaN(ms) ? null : ms;
}

export function getVotingSettings(): VotingSettingsRow {
  const row = db
    .prepare(
      `SELECT is_open, opens_at, closes_at, eligibility_mode, manual_paused,
              theme_label, theme_title, theme_accent, theme_surface, updated_at
       FROM voting_settings WHERE id = 1`
    )
    .get() as {
    is_open: number;
    opens_at: string | null;
    closes_at: string | null;
    eligibility_mode: string;
    manual_paused: number;
    theme_label: string;
    theme_title: string;
    theme_accent: string;
    theme_surface: string;
    updated_at: string;
  };

  const mode: EligibilityMode =
    row.eligibility_mode === 'invited_school' ||
    row.eligibility_mode === 'approved_list' ||
    row.eligibility_mode === 'invitation_code' ||
    row.eligibility_mode === 'both'
      ? row.eligibility_mode
      : 'invited_school';

  const theme: VotingThemeConfig = {
    label: (row.theme_label ?? '').trim() || DEFAULT_THEME.label,
    title: (row.theme_title ?? '').trim() || DEFAULT_THEME.title,
    accentColor: sanitizeHexColor(row.theme_accent, DEFAULT_THEME.accentColor),
    surfaceColor: sanitizeHexColor(row.theme_surface, DEFAULT_THEME.surfaceColor),
  };

  return {
    isOpen: row.is_open === 1,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    eligibilityMode: mode,
    manualPaused: row.manual_paused === 1,
    theme,
    updatedAt: row.updated_at,
  };
}

export function computeVotingStatus(
  settings: VotingSettingsRow,
  nowMs: number = Date.now()
): VotingWindowStatus {
  if (settings.manualPaused) {
    return 'disabled';
  }

  const opensMs = parseTimestampSafe(settings.opensAt);
  const closesMs = parseTimestampSafe(settings.closesAt);
  const hasSchedule = opensMs !== null || closesMs !== null;

  if (hasSchedule) {
    if (opensMs !== null && closesMs !== null && closesMs <= opensMs) {
      return 'closed';
    }
    if (opensMs !== null && nowMs < opensMs) {
      return 'upcoming';
    }
    if (closesMs !== null && nowMs > closesMs) {
      return 'closed';
    }
    return 'open';
  }

  // No schedule timestamps configured — rely on manual open/close toggle
  return settings.isOpen ? 'open' : 'disabled';
}

export function updateVotingSettings(input: {
  isOpen?: boolean;
  opensAt: string | null;
  closesAt: string | null;
  eligibilityMode: EligibilityMode;
  manualPaused?: boolean;
  theme?: Partial<VotingThemeConfig>;
}): VotingSettingsRow {
  const current = getVotingSettings();
  const cleanOpens = input.opensAt && input.opensAt.trim() ? input.opensAt.trim() : null;
  const cleanCloses = input.closesAt && input.closesAt.trim() ? input.closesAt.trim() : null;

  const opensMs = cleanOpens ? Date.parse(cleanOpens) : null;
  const closesMs = cleanCloses ? Date.parse(cleanCloses) : null;

  if (cleanOpens && (opensMs === null || Number.isNaN(opensMs))) {
    throw new Error('Invalid voting opening date format.');
  }
  if (cleanCloses && (closesMs === null || Number.isNaN(closesMs))) {
    throw new Error('Invalid voting closing date format.');
  }
  if (opensMs !== null && closesMs !== null && closesMs <= opensMs) {
    throw new Error('Closing date must be after the opening date.');
  }

  const normalizedOpens = opensMs !== null ? new Date(opensMs).toISOString() : null;
  const normalizedCloses = closesMs !== null ? new Date(closesMs).toISOString() : null;

  const nextManualPaused = Boolean(input.manualPaused);
  const hasSchedule = normalizedOpens !== null || normalizedCloses !== null;

  // Keep is_open synchronized with schedule state when schedule timestamps exist
  const candidateSettings: VotingSettingsRow = {
    ...current,
    opensAt: normalizedOpens,
    closesAt: normalizedCloses,
    eligibilityMode: input.eligibilityMode,
    manualPaused: nextManualPaused,
    isOpen: hasSchedule ? !nextManualPaused : Boolean(input.isOpen),
  };
  const nextStatus = computeVotingStatus(candidateSettings);
  const effectiveIsOpen = hasSchedule ? nextStatus === 'open' : Boolean(input.isOpen);

  const nextTheme: VotingThemeConfig = {
    label:
      input.theme?.label !== undefined
        ? input.theme.label.trim().slice(0, 100) || DEFAULT_THEME.label
        : current.theme.label,
    title:
      input.theme?.title !== undefined
        ? input.theme.title.trim().slice(0, 140) || DEFAULT_THEME.title
        : current.theme.title,
    accentColor:
      input.theme?.accentColor !== undefined
        ? sanitizeHexColor(input.theme.accentColor, DEFAULT_THEME.accentColor)
        : current.theme.accentColor,
    surfaceColor:
      input.theme?.surfaceColor !== undefined
        ? sanitizeHexColor(input.theme.surfaceColor, DEFAULT_THEME.surfaceColor)
        : current.theme.surfaceColor,
  };

  const nowIso = new Date().toISOString();
  db.prepare(
    `UPDATE voting_settings
     SET is_open = ?, opens_at = ?, closes_at = ?, eligibility_mode = ?, manual_paused = ?,
         theme_label = ?, theme_title = ?, theme_accent = ?, theme_surface = ?, updated_at = ?
     WHERE id = 1`
  ).run(
    effectiveIsOpen ? 1 : 0,
    normalizedOpens,
    normalizedCloses,
    input.eligibilityMode,
    nextManualPaused ? 1 : 0,
    nextTheme.label,
    nextTheme.title,
    nextTheme.accentColor,
    nextTheme.surfaceColor,
    nowIso
  );

  return getVotingSettings();
}

export function getPublicSubmissions(): PublicSubmission[] {
  const rows = db
    .prepare(
      `SELECT id, school_name, school_logo_url, title, description, thumbnail_url, video_url, display_order
       FROM film_submissions
       WHERE enabled = 1
       ORDER BY display_order ASC, created_at ASC`
    )
    .all() as {
    id: string;
    school_name: string;
    school_logo_url: string;
    title: string;
    description: string;
    thumbnail_url: string;
    video_url: string;
    display_order: number;
  }[];

  return rows
    .filter((r) => Boolean((r.school_name ?? '').trim()) && Boolean((r.title ?? '').trim()))
    .map((r) => ({
      id: r.id,
      schoolName: r.school_name,
      schoolLogoUrl: r.school_logo_url || null,
      title: r.title,
      description: r.description ?? '',
      thumbnailUrl: r.thumbnail_url || null,
      videoUrl: r.video_url || null,
      displayOrder: r.display_order,
    }));
}

export function getAdminSubmissionsWithScores(): AdminSubmission[] {
  const subs = db
    .prepare(
      `SELECT id, school_name, school_logo_url, title, description, thumbnail_url, video_url, enabled, judges_score, display_order, created_at, updated_at
       FROM film_submissions
       ORDER BY display_order ASC, created_at ASC`
    )
    .all() as {
    id: string;
    school_name: string;
    school_logo_url: string;
    title: string;
    description: string;
    thumbnail_url: string;
    video_url: string;
    enabled: number;
    judges_score: number;
    display_order: number;
    created_at: string;
    updated_at: string;
  }[];

  // Count valid votes only for enabled submissions
  const voteCounts = db
    .prepare(
      `SELECT v.film_id, COUNT(*) as vote_count
       FROM votes v
       INNER JOIN film_submissions f ON f.id = v.film_id
       WHERE f.enabled = 1
       GROUP BY v.film_id`
    )
    .all() as { film_id: string; vote_count: number }[];

  const countMap = new Map<string, number>();
  let totalValidVotes = 0;
  for (const row of voteCounts) {
    countMap.set(row.film_id, row.vote_count);
    totalValidVotes += row.vote_count;
  }

  return subs.map((s) => {
    const isEnabled = s.enabled === 1;
    const rawCount = isEnabled ? countMap.get(s.id) ?? 0 : 0;
    const votePercentage =
      totalValidVotes > 0 && isEnabled
        ? Number(((rawCount / totalValidVotes) * 100).toFixed(2))
        : 0;
    const publicScore = Number(((votePercentage / 100) * 30).toFixed(2));
    const judgesScore = Number(Math.max(0, Math.min(70, s.judges_score || 0)).toFixed(2));
    const finalScore = Number((publicScore + judgesScore).toFixed(2));

    return {
      id: s.id,
      schoolName: s.school_name,
      schoolLogoUrl: s.school_logo_url || null,
      title: s.title,
      description: s.description,
      thumbnailUrl: s.thumbnail_url || null,
      videoUrl: s.video_url || null,
      enabled: isEnabled,
      judgesScore,
      votePercentage,
      publicScore,
      finalScore,
      displayOrder: s.display_order,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    };
  });
}

export function createSubmission(input: {
  schoolName: string;
  schoolLogoUrl?: string | null;
  title: string;
  description?: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  enabled?: boolean;
  judgesScore?: number;
}): AdminSubmission {
  const schoolName = input.schoolName.trim().slice(0, 140);
  const title = input.title.trim().slice(0, 140);
  if (!schoolName || !title) {
    throw new Error('School name and film title are required.');
  }

  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(display_order), 0) as max_order FROM film_submissions')
    .get() as { max_order: number };

  const id = `film_${crypto.randomUUID().slice(0, 8)}`;
  const nowIso = new Date().toISOString();
  const judgesScore = Math.max(0, Math.min(70, Number(input.judgesScore || 0)));

  db.prepare(
    `INSERT INTO film_submissions
     (id, school_name, school_logo_url, title, description, video_url, thumbnail_url, enabled, judges_score, display_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    schoolName,
    (input.schoolLogoUrl ?? '').trim().slice(0, 500),
    title,
    (input.description ?? '').trim().slice(0, 500),
    (input.videoUrl ?? '').trim().slice(0, 500),
    (input.thumbnailUrl ?? '').trim().slice(0, 500),
    input.enabled === false ? 0 : 1,
    judgesScore,
    maxOrderRow.max_order + 1,
    nowIso,
    nowIso
  );

  if (input.enabled !== false) {
    ensureSubmissionSchoolInInvitedSchools(schoolName);
  }

  if (enabled === 1) {
    ensureSubmissionSchoolInInvitedSchools(schoolName);
  }

  return getAdminSubmissionsWithScores().find((s) => s.id === id)!;
}

export function updateSubmission(
  id: string,
  input: {
    schoolName?: string;
    schoolLogoUrl?: string | null;
    title?: string;
    description?: string;
    videoUrl?: string | null;
    thumbnailUrl?: string | null;
    enabled?: boolean;
    judgesScore?: number;
    displayOrder?: number;
  }
): AdminSubmission {
  const existing = db
    .prepare('SELECT * FROM film_submissions WHERE id = ?')
    .get(id) as
    | {
        id: string;
        school_name: string;
        school_logo_url: string;
        title: string;
        description: string;
        video_url: string;
        thumbnail_url: string;
        enabled: number;
        judges_score: number;
        display_order: number;
      }
    | undefined;

  if (!existing) {
    throw new Error('Short film submission not found.');
  }

  const schoolName =
    input.schoolName !== undefined ? input.schoolName.trim().slice(0, 140) : existing.school_name;
  const title = input.title !== undefined ? input.title.trim().slice(0, 140) : existing.title;
  if (!schoolName || !title) {
    throw new Error('School name and film title cannot be empty.');
  }

  const schoolLogoUrl =
    input.schoolLogoUrl !== undefined
      ? (input.schoolLogoUrl ?? '').trim().slice(0, 500)
      : existing.school_logo_url ?? '';
  const description =
    input.description !== undefined
      ? input.description.trim().slice(0, 500)
      : existing.description;
  const videoUrl =
    input.videoUrl !== undefined ? (input.videoUrl ?? '').trim().slice(0, 500) : existing.video_url;
  const thumbnailUrl =
    input.thumbnailUrl !== undefined
      ? (input.thumbnailUrl ?? '').trim().slice(0, 500)
      : existing.thumbnail_url;
  const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled;
  const rawScore =
    input.judgesScore !== undefined ? Number(input.judgesScore) : existing.judges_score;
  if (Number.isNaN(rawScore) || rawScore < 0 || rawScore > 70) {
    throw new Error('Judges score must be between 0 and 70.');
  }
  const judgesScore = Number(rawScore.toFixed(2));
  const displayOrder =
    input.displayOrder !== undefined ? Number(input.displayOrder) : existing.display_order;

  db.prepare(
    `UPDATE film_submissions
     SET school_name = ?, school_logo_url = ?, title = ?, description = ?, video_url = ?, thumbnail_url = ?, enabled = ?, judges_score = ?, display_order = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    schoolName,
    schoolLogoUrl,
    title,
    description,
    videoUrl,
    thumbnailUrl,
    enabled,
    judgesScore,
    displayOrder,
    new Date().toISOString(),
    id
  );

  return getAdminSubmissionsWithScores().find((s) => s.id === id)!;
}

export function deleteSubmission(id: string): void {
  const existing = db
    .prepare('SELECT id FROM film_submissions WHERE id = ?')
    .get(id) as { id: string } | undefined;
  if (!existing) {
    throw new Error('Short film submission not found.');
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM submission_thumbnails WHERE submission_id = ?').run(id);
    db.prepare('DELETE FROM votes WHERE film_id = ?').run(id);
    db.prepare('DELETE FROM film_submissions WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function saveSubmissionThumbnail(
  submissionId: string,
  dataUrlOrBase64: string
): string {
  const existing = db
    .prepare('SELECT id FROM film_submissions WHERE id = ?')
    .get(submissionId) as { id: string } | undefined;
  if (!existing) {
    throw new Error('Short film submission not found.');
  }

  let mimeType = 'image/jpeg';
  let base64Body = dataUrlOrBase64.trim();

  const dataUrlMatch = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(
    base64Body
  );
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase();
    base64Body = dataUrlMatch[2];
  } else {
    throw new Error('Unsupported image format. Upload a JPEG, PNG, or WebP image.');
  }

  const buffer = Buffer.from(base64Body, 'base64');
  if (buffer.length <= 0 || buffer.length > 2 * 1024 * 1024) {
    throw new Error('Thumbnail image must be smaller than 2 MB.');
  }

  // Magic-byte validation
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (
    (mimeType === 'image/jpeg' && !isJpeg) ||
    (mimeType === 'image/png' && !isPng) ||
    (mimeType === 'image/webp' && !isWebp)
  ) {
    throw new Error('Invalid image file signature.');
  }

  const thumbId = `thumb_${crypto.randomUUID().slice(0, 12)}`;
  const nowIso = new Date().toISOString();
  const publicUrl = `/api/voting/thumbnails/${thumbId}`;

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM submission_thumbnails WHERE submission_id = ?').run(submissionId);
    db.prepare(
      `INSERT INTO submission_thumbnails (id, submission_id, mime_type, data, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(thumbId, submissionId, mimeType, buffer, nowIso);
    db.prepare(
      'UPDATE film_submissions SET thumbnail_url = ?, updated_at = ? WHERE id = ?'
    ).run(publicUrl, nowIso, submissionId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return publicUrl;
}

export function getSubmissionThumbnail(
  thumbId: string
): { mimeType: string; data: Uint8Array } | null {
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(thumbId)) return null;
  const row = db
    .prepare('SELECT mime_type, data FROM submission_thumbnails WHERE id = ?')
    .get(thumbId) as { mime_type: string; data: Uint8Array } | undefined;
  if (!row) return null;
  return { mimeType: row.mime_type, data: row.data };
}

export function listInvitedSchools(onlyEligible = false): InvitedSchoolRecord[] {
  const query = onlyEligible
    ? `SELECT id, school_name, invitation_code, is_eligible, created_at
       FROM invited_schools WHERE is_eligible = 1 ORDER BY school_name ASC`
    : `SELECT id, school_name, invitation_code, is_eligible, created_at
       FROM invited_schools ORDER BY school_name ASC`;

  const rows = db.prepare(query).all() as {
    id: string;
    school_name: string;
    invitation_code: string;
    is_eligible: number;
    created_at: string;
  }[];

  return rows
    .filter((r) => !isOrganizingSchoolName(r.school_name))
    .map((r) => ({
      id: r.id,
      schoolName: r.school_name,
      invitationCode: r.invitation_code,
      isEligible: r.is_eligible === 1,
      createdAt: r.created_at,
    }));
}

export function addInvitedSchool(input: {
  schoolName: string;
  invitationCode?: string;
  isEligible?: boolean;
}): InvitedSchoolRecord {
  const schoolName = input.schoolName.trim().slice(0, 140);
  if (!schoolName) {
    throw new Error('School name is required.');
  }
  if (isOrganizingSchoolName(schoolName)) {
    throw new Error(
      'Students from the organizing school (Bandaranayaka College) are excluded from public voting and cannot be added as an eligible voting school.'
    );
  }

  const normalizedName = normalizeSchoolName(schoolName);
  const dup = db
    .prepare('SELECT id FROM invited_schools WHERE normalized_name = ?')
    .get(normalizedName) as { id: string } | undefined;
  if (dup) {
    throw new Error('This school is already listed in invited schools.');
  }

  const code =
    input.invitationCode && input.invitationCode.trim()
      ? input.invitationCode.trim().toUpperCase().slice(0, 40)
      : `INFRAX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const id = `sch_${crypto.randomUUID().slice(0, 8)}`;
  const nowIso = new Date().toISOString();

  db.prepare(
    `INSERT INTO invited_schools (id, school_name, normalized_name, invitation_code, is_eligible, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, schoolName, normalizedName, code, input.isEligible === false ? 0 : 1, nowIso);

  return listInvitedSchools().find((s) => s.id === id)!;
}

export function updateInvitedSchool(
  id: string,
  input: {
    schoolName?: string;
    invitationCode?: string;
    isEligible?: boolean;
  }
): InvitedSchoolRecord {
  const existing = db
    .prepare('SELECT * FROM invited_schools WHERE id = ?')
    .get(id) as
    | {
        id: string;
        school_name: string;
        normalized_name: string;
        invitation_code: string;
        is_eligible: number;
      }
    | undefined;

  if (!existing) {
    throw new Error('Invited school record not found.');
  }

  const schoolName =
    input.schoolName !== undefined ? input.schoolName.trim().slice(0, 140) : existing.school_name;
  if (!schoolName) throw new Error('School name cannot be empty.');
  if (isOrganizingSchoolName(schoolName)) {
    throw new Error(
      'Bandaranayaka College (organizing school) cannot be configured as an eligible voting school.'
    );
  }

  const normalizedName = normalizeSchoolName(schoolName);
  const code =
    input.invitationCode !== undefined
      ? input.invitationCode.trim().toUpperCase().slice(0, 40)
      : existing.invitation_code;
  if (!code) throw new Error('Invitation code cannot be empty.');

  const isEligible =
    input.isEligible !== undefined ? (input.isEligible ? 1 : 0) : existing.is_eligible;

  db.prepare(
    `UPDATE invited_schools
     SET school_name = ?, normalized_name = ?, invitation_code = ?, is_eligible = ?
     WHERE id = ?`
  ).run(schoolName, normalizedName, code, isEligible, id);

  return listInvitedSchools().find((s) => s.id === id)!;
}

export function deleteInvitedSchool(id: string): void {
  db.prepare('DELETE FROM invited_schools WHERE id = ?').run(id);
}

export function listApprovedVoters(): ApprovedVoterRecord[] {
  const rows = db
    .prepare(
      `SELECT a.id, a.email_normalized, a.email_hash, a.school_id, a.school_name, a.created_at,
              CASE WHEN v.id IS NOT NULL THEN 1 ELSE 0 END AS has_voted
       FROM approved_voters a
       LEFT JOIN votes v ON v.email_hash = a.email_hash
       ORDER BY a.school_name ASC, a.email_normalized ASC`
    )
    .all() as {
    id: string;
    email_normalized: string;
    email_hash: string;
    school_id: string;
    school_name: string;
    created_at: string;
    has_voted: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    email: r.email_normalized,
    schoolId: r.school_id,
    schoolName: r.school_name,
    hasVoted: r.has_voted === 1,
    createdAt: r.created_at,
  }));
}

export function addApprovedVoters(input: {
  emails: string[];
  schoolId: string;
}): { added: number; skipped: number } {
  const school = db
    .prepare('SELECT id, school_name, is_eligible FROM invited_schools WHERE id = ?')
    .get(input.schoolId) as
    | { id: string; school_name: string; is_eligible: number }
    | undefined;

  if (!school) {
    throw new Error('Please select a valid invited school.');
  }
  if (isOrganizingSchoolName(school.school_name)) {
    throw new Error('Organizing school voters cannot be added.');
  }

  let added = 0;
  let skipped = 0;
  const nowIso = new Date().toISOString();
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO approved_voters
     (id, email_normalized, email_hash, masked_email, school_id, school_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const raw of input.emails) {
    const email = normalizeEmail(raw);
    if (!isValidEmailFormat(email)) {
      skipped++;
      continue;
    }
    const emailHash = hmacHash('email', email);
    const result = insertStmt.run(
      `vtr_${crypto.randomUUID().slice(0, 10)}`,
      email,
      emailHash,
      maskEmail(email),
      school.id,
      school.school_name,
      nowIso
    );
    if (result.changes > 0) {
      added++;
    } else {
      skipped++;
    }
  }

  return { added, skipped };
}

export function deleteApprovedVoter(id: string): void {
  db.prepare('DELETE FROM approved_voters WHERE id = ?').run(id);
}

export function checkVoterEligibility(params: {
  email: string;
  schoolId?: string;
  schoolName?: string;
  invitationCode?: string;
}):
  | { ok: true; schoolId: string; schoolName: string }
  | { ok: false; status?: number; reason: string } {
  const normalized = normalizeEmail(params.email);
  if (!isValidEmailFormat(normalized)) {
    return { ok: false, status: 400, reason: 'Please enter a valid email address.' };
  }

  if (isOrganizingSchoolEmail(normalized)) {
    return {
      ok: false,
      status: 403,
      reason: 'Students from the organizing school (Bandaranayaka College) are excluded from public voting.',
    };
  }

  if (params.schoolName && isOrganizingSchoolName(params.schoolName)) {
    return {
      ok: false,
      status: 403,
      reason: 'Students from the organizing school (Bandaranayaka College) are excluded from public voting.',
    };
  }

  const settings = getVotingSettings();
  const emailHash = hmacHash('email', normalized);

  // Check if already voted first (one vote per verified email address)
  const existingVote = db
    .prepare('SELECT id FROM votes WHERE email_hash = ?')
    .get(emailHash) as { id: string } | undefined;
  if (existingVote) {
    return {
      ok: false,
      status: 409,
      reason: 'A vote has already been recorded for this email address.',
    };
  }

  // 1. Check approved voter list if email is pre-approved (supported in invited_school, approved_list, and both)
  if (
    settings.eligibilityMode === 'invited_school' ||
    settings.eligibilityMode === 'approved_list' ||
    settings.eligibilityMode === 'both'
  ) {
    const approved = db
      .prepare(
        `SELECT a.school_id, a.school_name, s.is_eligible
         FROM approved_voters a
         LEFT JOIN invited_schools s ON s.id = a.school_id
         WHERE a.email_hash = ?`
      )
      .get(emailHash) as
      | { school_id: string; school_name: string; is_eligible: number | null }
      | undefined;

    if (approved) {
      if (isOrganizingSchoolName(approved.school_name)) {
        return {
          ok: false,
          status: 403,
          reason: 'Students from the organizing school are excluded from public voting.',
        };
      }
      if (approved.is_eligible === 0) {
        return {
          ok: false,
          status: 403,
          reason: 'Your school’s voting eligibility is currently disabled.',
        };
      }
      return {
        ok: true,
        schoolId: approved.school_id,
        schoolName: approved.school_name,
      };
    }

    if (settings.eligibilityMode === 'approved_list') {
      const voterCount = db.prepare('SELECT COUNT(*) as cnt FROM approved_voters').get() as {
        cnt: number;
      };
      return {
        ok: false,
        status: 403,
        reason:
          voterCount.cnt === 0
            ? 'Public voting is currently restricted to an empty approved voter list. Contact the InfraX organizers or switch verification mode to Invited Schools.'
            : 'This email address is not on the approved voter list for invited schools.',
      };
    }
  }

  // 2. Invited School Selection + Email OTP (personal Gmail/Outlook/Yahoo & school emails supported)
  if (settings.eligibilityMode === 'invited_school') {
    const cleanSchoolId = (params.schoolId || '').trim();
    const cleanSchoolName = (params.schoolName || '').trim();

    type SchoolRow = {
      id: string;
      school_name: string;
      invitation_code: string;
      is_eligible: number;
    };

    let school: SchoolRow | undefined;
    if (cleanSchoolId) {
      school = db
        .prepare(
          'SELECT id, school_name, invitation_code, is_eligible FROM invited_schools WHERE id = ?'
        )
        .get(cleanSchoolId) as SchoolRow | undefined;
    } else if (cleanSchoolName) {
      school = db
        .prepare(
          'SELECT id, school_name, invitation_code, is_eligible FROM invited_schools WHERE normalized_name = ?'
        )
        .get(normalizeSchoolName(cleanSchoolName)) as SchoolRow | undefined;
    }

    if (!school) {
      return {
        ok: false,
        status: 403,
        reason:
          cleanSchoolId || cleanSchoolName
            ? 'Selected school is not on the eligible invited schools list.'
            : 'Please select your eligible invited school to continue email verification.',
      };
    }

    if (isOrganizingSchoolName(school.school_name)) {
      return {
        ok: false,
        status: 403,
        reason: 'Students from the organizing school (Bandaranayaka College) are excluded from public voting.',
      };
    }

    if (school.is_eligible !== 1) {
      return {
        ok: false,
        status: 403,
        reason: 'Voting for the selected school is currently disabled.',
      };
    }

    return {
      ok: true,
      schoolId: school.id,
      schoolName: school.school_name,
    };
  }

  // 3. Check school invitation code if mode requires it
  if (settings.eligibilityMode === 'invitation_code' || settings.eligibilityMode === 'both') {
    const cleanSchoolId = (params.schoolId || '').trim();
    const cleanCode = (params.invitationCode || '').trim().toUpperCase();

    if (!cleanSchoolId || !cleanCode) {
      return {
        ok: false,
        status: 403,
        reason:
          settings.eligibilityMode === 'both'
            ? 'Your email was not found on the pre-approved list. Select your invited school and enter your school invitation code.'
            : 'Please select your invited school and enter your school invitation code.',
      };
    }

    const school = db
      .prepare(
        'SELECT id, school_name, invitation_code, is_eligible FROM invited_schools WHERE id = ?'
      )
      .get(cleanSchoolId) as
      | {
          id: string;
          school_name: string;
          invitation_code: string;
          is_eligible: number;
        }
      | undefined;

    if (!school || isOrganizingSchoolName(school.school_name)) {
      return {
        ok: false,
        status: 403,
        reason: 'Selected school is not eligible for public voting.',
      };
    }

    if (school.is_eligible !== 1) {
      return {
        ok: false,
        status: 403,
        reason: 'Voting for the selected school is currently disabled.',
      };
    }

    const expectedBuf = Buffer.from(school.invitation_code.toUpperCase());
    const providedBuf = Buffer.from(cleanCode);
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      return {
        ok: false,
        status: 403,
        reason: 'Invalid school invitation code. Please check with your school coordinator.',
      };
    }

    return {
      ok: true,
      schoolId: school.id,
      schoolName: school.school_name,
    };
  }

  return {
    ok: false,
    status: 403,
    reason: 'This email address is not eligible to vote in the InfraX Short Film Competition.',
  };
}

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_MAX_REQUESTS_PER_HOUR = 6;
const OTP_MAX_ATTEMPTS = 5;

export function createOtpChallenge(params: {
  email: string;
  schoolId: string;
  schoolName: string;
}):
  | {
      ok: true;
      challengeId: string;
      otpCode: string;
      expiresInSeconds: number;
      cooldownSeconds: number;
    }
  | { ok: false; status: number; reason: string; retryAfterSeconds?: number } {
  const emailHash = hmacHash('email', normalizeEmail(params.email));
  const now = Date.now();

  const latest = db
    .prepare(
      `SELECT resend_available_at FROM otp_challenges
       WHERE email_hash = ? AND consumed = 0
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(emailHash) as { resend_available_at: number } | undefined;

  if (latest && now < latest.resend_available_at) {
    const waitSec = Math.ceil((latest.resend_available_at - now) / 1000);
    return {
      ok: false,
      status: 429,
      reason: `Please wait ${waitSec} seconds before requesting another verification code.`,
      retryAfterSeconds: waitSec,
    };
  }

  const oneHourAgo = now - 60 * 60 * 1000;
  const recentCountRow = db
    .prepare(
      'SELECT COUNT(*) as cnt FROM otp_challenges WHERE email_hash = ? AND created_at >= ?'
    )
    .get(emailHash, oneHourAgo) as { cnt: number };

  if (recentCountRow.cnt >= OTP_MAX_REQUESTS_PER_HOUR) {
    return {
      ok: false,
      status: 429,
      reason: 'Too many verification code requests for this email. Please try again later.',
    };
  }

  const challengeId = crypto.randomUUID();
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hmacHash('otp', `${challengeId}:${otpCode}`);

  // Invalidate prior unconsumed challenges for this email
  db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE email_hash = ? AND consumed = 0').run(
    emailHash
  );

  db.prepare(
    `INSERT INTO otp_challenges
     (id, email_hash, code_hash, school_id, school_name, expires_at, resend_available_at, attempts, consumed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
  ).run(
    challengeId,
    emailHash,
    codeHash,
    params.schoolId,
    params.schoolName,
    now + OTP_EXPIRY_MS,
    now + OTP_RESEND_COOLDOWN_MS,
    now
  );

  return {
    ok: true,
    challengeId,
    otpCode,
    expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
    cooldownSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
  };
}

export function rollbackOtpChallenge(challengeId: string): void {
  db.prepare('DELETE FROM otp_challenges WHERE id = ?').run(challengeId);
}

export function verifyOtpAndCreateSession(params: {
  email: string;
  code: string;
}):
  | {
      ok: true;
      sessionId: string;
      cookieValue: string;
      sessionState: VoterSessionState;
    }
  | { ok: false; status: number; reason: string } {
  const normalizedEmail = normalizeEmail(params.email);
  const cleanCode = params.code.trim();
  if (!isValidEmailFormat(normalizedEmail) || !/^\d{6}$/.test(cleanCode)) {
    return {
      ok: false,
      status: 400,
      reason: 'Enter a valid email address and the 6-digit verification code.',
    };
  }

  const emailHash = hmacHash('email', normalizedEmail);
  const now = Date.now();

  const challenge = db
    .prepare(
      `SELECT id, code_hash, school_id, school_name, expires_at, attempts
       FROM otp_challenges
       WHERE email_hash = ? AND consumed = 0
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(emailHash) as
    | {
        id: string;
        code_hash: string;
        school_id: string;
        school_name: string;
        expires_at: number;
        attempts: number;
      }
    | undefined;

  if (!challenge) {
    return {
      ok: false,
      status: 400,
      reason: 'No active verification code found. Please request a new code.',
    };
  }

  if (now > challenge.expires_at) {
    db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE id = ?').run(challenge.id);
    return {
      ok: false,
      status: 400,
      reason: 'This verification code has expired. Please request a new code.',
    };
  }

  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE id = ?').run(challenge.id);
    return {
      ok: false,
      status: 429,
      reason: 'Maximum verification attempts exceeded. Please request a new code.',
    };
  }

  const candidateHash = hmacHash('otp', `${challenge.id}:${cleanCode}`);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(challenge.code_hash, 'hex');
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!matches) {
    const nextAttempts = challenge.attempts + 1;
    if (nextAttempts >= OTP_MAX_ATTEMPTS) {
      db.prepare('UPDATE otp_challenges SET attempts = ?, consumed = 1 WHERE id = ?').run(
        nextAttempts,
        challenge.id
      );
      return {
        ok: false,
        status: 429,
        reason: 'Too many invalid attempts. Please request a new verification code.',
      };
    }
    db.prepare('UPDATE otp_challenges SET attempts = ? WHERE id = ?').run(
      nextAttempts,
      challenge.id
    );
    return {
      ok: false,
      status: 400,
      reason: `Invalid verification code. ${OTP_MAX_ATTEMPTS - nextAttempts} attempt(s) remaining.`,
    };
  }

  // Re-check duplicate vote before minting session
  const existingVote = db
    .prepare('SELECT id FROM votes WHERE email_hash = ?')
    .get(emailHash) as { id: string } | undefined;
  if (existingVote) {
    db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE id = ?').run(challenge.id);
    return {
      ok: false,
      status: 409,
      reason: 'A vote has already been recorded for this email address.',
    };
  }

  const sessionId = crypto.randomUUID();
  const masked = maskEmail(normalizedEmail);
  const sessionExpiresAt = now + 30 * 60 * 1000; // 30 minutes to confirm vote

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE id = ?').run(challenge.id);
    db.prepare(
      `INSERT INTO voter_sessions
       (id, email_hash, masked_email, school_id, school_name, expires_at, voted, voted_film_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)`
    ).run(
      sessionId,
      emailHash,
      masked,
      challenge.school_id,
      challenge.school_name,
      sessionExpiresAt,
      now
    );
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return {
    ok: true,
    sessionId,
    cookieValue: signSessionCookieValue(sessionId),
    sessionState: {
      verified: true,
      maskedEmail: masked,
      schoolName: challenge.school_name,
      hasVoted: false,
      votedFilmTitle: null,
      votedSchoolName: null,
    },
  };
}

export function getVoterSessionState(sessionId: string | null): VoterSessionState {
  if (!sessionId) {
    return {
      verified: false,
      maskedEmail: null,
      schoolName: null,
      hasVoted: false,
      votedFilmTitle: null,
      votedSchoolName: null,
    };
  }

  const row = db
    .prepare(
      `SELECT vs.email_hash, vs.masked_email, vs.school_name, vs.expires_at, vs.voted, vs.voted_film_id,
              fs.title as film_title, fs.school_name as film_school_name
       FROM voter_sessions vs
       LEFT JOIN film_submissions fs ON fs.id = vs.voted_film_id
       WHERE vs.id = ?`
    )
    .get(sessionId) as
    | {
        email_hash: string;
        masked_email: string;
        school_name: string;
        expires_at: number;
        voted: number;
        voted_film_id: string | null;
        film_title: string | null;
        film_school_name: string | null;
      }
    | undefined;

  if (!row) {
    return {
      verified: false,
      maskedEmail: null,
      schoolName: null,
      hasVoted: false,
      votedFilmTitle: null,
      votedSchoolName: null,
    };
  }

  const now = Date.now();
  if (row.voted === 1) {
    return {
      verified: true,
      maskedEmail: row.masked_email,
      schoolName: row.school_name,
      hasVoted: true,
      votedFilmTitle: row.film_title,
      votedSchoolName: row.film_school_name,
    };
  }

  if (now > row.expires_at) {
    return {
      verified: false,
      maskedEmail: null,
      schoolName: null,
      hasVoted: false,
      votedFilmTitle: null,
      votedSchoolName: null,
    };
  }

  const existingVote = db
    .prepare('SELECT id FROM votes WHERE email_hash = ?')
    .get(row.email_hash) as { id: string } | undefined;

  return {
    verified: true,
    maskedEmail: row.masked_email,
    schoolName: row.school_name,
    hasVoted: Boolean(existingVote),
    votedFilmTitle: null,
    votedSchoolName: null,
  };
}

export function castVerifiedVote(params: {
  sessionId: string;
  filmId: string;
}):
  | { ok: true; sessionState: VoterSessionState }
  | { ok: false; status: number; reason: string } {
  const settings = getVotingSettings();
  const windowStatus = computeVotingStatus(settings);
  if (windowStatus !== 'open') {
    return {
      ok: false,
      status: 403,
      reason:
        windowStatus === 'upcoming'
          ? 'Public voting has not opened yet.'
          : 'Public voting is currently closed.',
    };
  }

  const session = db
    .prepare(
      'SELECT id, email_hash, masked_email, school_id, school_name, expires_at, voted FROM voter_sessions WHERE id = ?'
    )
    .get(params.sessionId) as
    | {
        id: string;
        email_hash: string;
        masked_email: string;
        school_id: string;
        school_name: string;
        expires_at: number;
        voted: number;
      }
    | undefined;

  const now = Date.now();
  if (!session || now > session.expires_at) {
    return {
      ok: false,
      status: 401,
      reason: 'Your email verification session has expired. Please verify your email again.',
    };
  }

  if (isOrganizingSchoolName(session.school_name)) {
    return {
      ok: false,
      status: 403,
      reason: 'Students from the organizing school are excluded from public voting.',
    };
  }

  if (session.voted === 1) {
    return {
      ok: false,
      status: 409,
      reason: 'Your vote has already been recorded.',
    };
  }

  const film = db
    .prepare('SELECT id, school_name, title, enabled FROM film_submissions WHERE id = ?')
    .get(params.filmId) as
    | { id: string; school_name: string; title: string; enabled: number }
    | undefined;

  if (!film || film.enabled !== 1) {
    return {
      ok: false,
      status: 404,
      reason: 'Selected short film submission is not available for voting.',
    };
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const duplicate = db
      .prepare('SELECT id FROM votes WHERE email_hash = ?')
      .get(session.email_hash) as { id: string } | undefined;

    if (duplicate) {
      db.prepare('UPDATE voter_sessions SET voted = 1 WHERE id = ?').run(session.id);
      db.exec('COMMIT');
      return {
        ok: false,
        status: 409,
        reason: 'A vote has already been recorded for this verified email address.',
      };
    }

    db.prepare(
      `INSERT INTO votes (id, film_id, email_hash, school_id, school_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      film.id,
      session.email_hash,
      session.school_id,
      session.school_name,
      now
    );

    db.prepare('UPDATE voter_sessions SET voted = 1, voted_film_id = ? WHERE id = ?').run(
      film.id,
      session.id
    );

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return {
    ok: true,
    sessionState: {
      verified: true,
      maskedEmail: session.masked_email,
      schoolName: session.school_name,
      hasVoted: true,
      votedFilmTitle: film.title,
      votedSchoolName: film.school_name,
    },
  };
}

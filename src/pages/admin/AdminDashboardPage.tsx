import { signOut, type User } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Film,
  FileText,
  Globe,
  LayoutGrid,
  Link2,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  Trash2,
  Trophy,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { AdminVotingPanel } from './AdminVotingPanel';
import { useSiteData } from '../../context/SiteDataContext';
import {
  addAdminUid,
  removeAdminUid,
  saveCompetitionToFirestore,
  saveSiteContentToFirestore,
  seedBaselineToFirestore,
} from '../../lib/adminFirestore';
import { auth, db } from '../../lib/firebase';
import {
  deletePdfDocument,
  downloadStoredPdf,
  updatePdfMetadata,
  uploadPdfDocument,
} from '../../lib/pdfStorage';
import type {
  Competition,
  CompetitionScope,
  CompetitionStatus,
  DocumentRecord,
  ParticipationType,
  RegistrationProvider,
  SiteContentData,
} from '../../types/infrax';

type AdminTab =
  | 'dashboard'
  | 'competitions'
  | 'documents'
  | 'registrations'
  | 'voting'
  | 'content'
  | 'settings';

interface AdminDashboardPageProps {
  currentUser: User;
}

interface AdminUserEntry {
  uid: string;
  email: string;
}

interface ConfirmActionState {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

const NAV_ITEMS: { id: AdminTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'competitions', label: 'Competitions', icon: Trophy },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'registrations', label: 'Registration Links', icon: Link2 },
  { id: 'voting', label: 'Short Film Voting', icon: Film },
  { id: 'content', label: 'Website Content', icon: Globe },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function parseErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message) as { error?: string };
      if (parsed?.error) return parsed.error;
    } catch {
      // plain string message
    }
    return err.message;
  }
  return 'Operation failed. Please check your permissions and inputs.';
}

export function AdminDashboardPage({ currentUser }: AdminDashboardPageProps) {
  const { siteContent, competitions, documents, isLoadedFromCloud } = useSiteData();

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(null);

  // Competitions editor state
  const [selectedCompId, setSelectedCompId] = useState<string>(competitions[0]?.id ?? '');
  const [compDraft, setCompDraft] = useState<Competition | null>(competitions[0] ?? null);
  const [rulesText, setRulesText] = useState<string>(
    competitions[0]?.rules.join('\n') ?? ''
  );
  const [evalNotesText, setEvalNotesText] = useState<string>(
    competitions[0]?.evaluationNotes.join('\n') ?? ''
  );

  // Documents manager state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadScope, setUploadScope] = useState<'competition' | 'general'>('competition');
  const [uploadCompId, setUploadCompId] = useState<string>(competitions[0]?.id ?? '');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentRecord | null>(null);
  const [editDocTitle, setEditDocTitle] = useState('');
  const [editDocDesc, setEditDocDesc] = useState('');
  const [editDocScope, setEditDocScope] = useState<'competition' | 'general'>('competition');
  const [editDocCompId, setEditDocCompId] = useState('');
  const [replaceFile, setReplaceFile] = useState<File | null>(null);

  // Registration links local edits
  const [regEdits, setRegEdits] = useState<
    Record<
      string,
      {
        provider: RegistrationProvider;
        url: string;
        status: CompetitionStatus;
      }
    >
  >({});

  // Website Content draft state
  const [contentDraft, setContentDraft] = useState<SiteContentData>(siteContent);

  // Settings / Admin registry state
  const [adminEntries, setAdminEntries] = useState<AdminUserEntry[]>([]);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  useEffect(() => {
    document.title = 'Admin Dashboard | InfraX';
  }, []);

  // Keep competition draft synced when selected competition changes
  useEffect(() => {
    const found = competitions.find((c) => c.id === selectedCompId) ?? competitions[0];
    if (found) {
      setSelectedCompId(found.id);
      setCompDraft({ ...found });
      setRulesText(found.rules.join('\n'));
      setEvalNotesText(found.evaluationNotes.join('\n'));
    }
  }, [selectedCompId, competitions]);

  // Sync registration inline edits map when cloud competitions update
  useEffect(() => {
    const next: Record<
      string,
      { provider: RegistrationProvider; url: string; status: CompetitionStatus }
    > = {};
    competitions.forEach((c) => {
      next[c.id] = {
        provider: c.registrationProvider ?? 'Tally',
        url: c.registrationFormUrl ?? '',
        status: c.status ?? (c.registrationFormUrl ? 'Open' : 'Coming Soon'),
      };
    });
    setRegEdits(next);
  }, [competitions]);

  // Sync website content draft when cloud siteContent updates
  useEffect(() => {
    setContentDraft(siteContent);
  }, [siteContent]);

  // Subscribe to authorized admins collection
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'admins'),
      (snap) => {
        const list: AdminUserEntry[] = [];
        snap.forEach((d) => {
          const data = d.data() as { email?: string };
          list.push({ uid: d.id, email: data.email || '' });
        });
        setAdminEntries(list);
      },
      (err) => {
        console.warn('Admins list read notice:', err.message);
      }
    );
    return () => unsub();
  }, []);

  const notify = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSeedBaseline = async () => {
    setBusyKey('seed');
    setBanner(null);
    try {
      await seedBaselineToFirestore(competitions, siteContent);
      notify('success', 'All competition records and site content have been synced to Firestore.');
    } catch (err) {
      notify('error', parseErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveCompetition = async (e: FormEvent) => {
    e.preventDefault();
    if (!compDraft) return;
    if (!compDraft.title.trim()) {
      notify('error', 'Competition title cannot be empty.');
      return;
    }
    if (!compDraft.shortDescription.trim() || !compDraft.fullDescription.trim()) {
      notify('error', 'Short description and full overview are required.');
      return;
    }

    setBusyKey('save-comp');
    setBanner(null);
    try {
      const updated: Competition = {
        ...compDraft,
        rules: rulesText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        evaluationNotes: evalNotesText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      };
      await saveCompetitionToFirestore(updated);
      notify('success', `Saved changes to ${updated.title}.`);
    } catch (err) {
      notify('error', parseErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  const handleUploadNewPdf = async (e: FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      notify('error', 'Please provide a document title.');
      return;
    }
    if (!uploadFile) {
      notify('error', 'Please select a PDF file to upload (max 3 MB).');
      return;
    }

    setBusyKey('upload-pdf');
    setBanner(null);
    try {
      const targetCompId = uploadScope === 'competition' ? uploadCompId : '';
      const newDocId = await uploadPdfDocument({
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        scope: uploadScope,
        competitionId: targetCompId,
        file: uploadFile,
      });

      if (uploadScope === 'competition' && targetCompId) {
        const targetComp = competitions.find((c) => c.id === targetCompId);
        if (targetComp) {
          await saveCompetitionToFirestore({
            ...targetComp,
            guidelinesDocId: newDocId,
          });
        }
      }

      setUploadTitle('');
      setUploadDesc('');
      setUploadFile(null);
      const fileInput = document.getElementById('new-pdf-file-input') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      notify('success', 'PDF document uploaded and published.');
    } catch (err) {
      notify('error', parseErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  const openEditDocModal = (docRec: DocumentRecord) => {
    setEditingDoc(docRec);
    setEditDocTitle(docRec.title);
    setEditDocDesc(docRec.description);
    setEditDocScope(docRec.scope);
    setEditDocCompId(docRec.competitionId || competitions[0]?.id || '');
    setReplaceFile(null);
  };

  const handleSaveDocEdits = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;
    if (!editDocTitle.trim()) {
      notify('error', 'Document title is required.');
      return;
    }

    setBusyKey(`edit-doc-${editingDoc.id}`);
    setBanner(null);
    try {
      const targetCompId = editDocScope === 'competition' ? editDocCompId : '';

      if (replaceFile) {
        await uploadPdfDocument({
          id: editingDoc.id,
          title: editDocTitle.trim(),
          description: editDocDesc.trim(),
          scope: editDocScope,
          competitionId: targetCompId,
          file: replaceFile,
          existingChunkCount: editingDoc.chunkCount,
        });
      } else {
        await updatePdfMetadata({
          id: editingDoc.id,
          title: editDocTitle.trim(),
          description: editDocDesc.trim(),
          scope: editDocScope,
          competitionId: targetCompId,
          existing: editingDoc,
        });
      }

      // Clear old competition reference if reassigned away
      if (
        editingDoc.scope === 'competition' &&
        editingDoc.competitionId &&
        editingDoc.competitionId !== targetCompId
      ) {
        const oldComp = competitions.find((c) => c.id === editingDoc.competitionId);
        if (oldComp && oldComp.guidelinesDocId === editingDoc.id) {
          await saveCompetitionToFirestore({ ...oldComp, guidelinesDocId: null });
        }
      }

      // Assign to new competition if applicable
      if (editDocScope === 'competition' && targetCompId) {
        const newComp = competitions.find((c) => c.id === targetCompId);
        if (newComp && newComp.guidelinesDocId !== editingDoc.id) {
          await saveCompetitionToFirestore({ ...newComp, guidelinesDocId: editingDoc.id });
        }
      }

      setEditingDoc(null);
      notify('success', 'Document updated successfully.');
    } catch (err) {
      notify('error', parseErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  const requestDeleteDocument = (docRec: DocumentRecord) => {
    setConfirmAction({
      title: 'Delete PDF Document',
      message: `Are you sure you want to permanently delete "${docRec.title}" (${docRec.fileName})? Any competition using this PDF will revert to no uploaded PDF until a new one is assigned.`,
      confirmLabel: 'Delete Document',
      onConfirm: async () => {
        setBusyKey(`del-doc-${docRec.id}`);
        setBanner(null);
        try {
          await deletePdfDocument(docRec);
          const linkedComps = competitions.filter((c) => c.guidelinesDocId === docRec.id);
          for (const comp of linkedComps) {
            await saveCompetitionToFirestore({ ...comp, guidelinesDocId: null });
          }
          notify('success', `Deleted "${docRec.title}".`);
        } catch (err) {
          notify('error', parseErrorMessage(err));
        } finally {
          setBusyKey(null);
        }
      },
    });
  };

  const handleSaveRegistrationRow = async (
    comp: Competition,
    overrideStatus?: CompetitionStatus
  ) => {
    const edit = regEdits[comp.id];
    if (!edit) return;
    const targetStatus = overrideStatus ?? edit.status;

    setBusyKey(`reg-${comp.id}`);
    setBanner(null);
    try {
      await saveCompetitionToFirestore({
        ...comp,
        registrationProvider: edit.provider,
        registrationFormUrl: edit.url.trim() || null,
        status: targetStatus,
      });
      notify(
        'success',
        overrideStatus === 'Closed'
          ? `Disabled registration for ${comp.title}.`
          : `Updated registration link for ${comp.title}.`
      );
    } catch (err) {
      notify('error', parseErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveSiteContent = async (e: FormEvent) => {
    e.preventDefault();
    if (!contentDraft.venue.trim()) {
      notify('error', 'Venue field cannot be empty.');
      return;
    }

    setBusyKey('save-content');
    setBanner(null);
    try {
      await saveSiteContentToFirestore(contentDraft);
      notify('success', 'Website content updated across the live site.');
    } catch (err) {
      notify('error', parseErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setBusyKey('add-admin');
    setBanner(null);
    try {
      await addAdminUid(newAdminUid, newAdminEmail);
      setNewAdminUid('');
      setNewAdminEmail('');
      notify('success', 'Administrator UID added to allowlist.');
    } catch (err) {
      notify('error', parseErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  const requestRemoveAdmin = (entry: AdminUserEntry) => {
    setConfirmAction({
      title: 'Remove Administrator',
      message: `Remove ${entry.email || entry.uid} from the authorized administrators registry?`,
      confirmLabel: 'Remove Admin',
      onConfirm: async () => {
        setBusyKey(`rem-admin-${entry.uid}`);
        setBanner(null);
        try {
          await removeAdminUid(entry.uid);
          notify('success', 'Administrator removed from allowlist.');
        } catch (err) {
          notify('error', parseErrorMessage(err));
        } finally {
          setBusyKey(null);
        }
      },
    });
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white lg:flex">
      {/* Mobile Header */}
      <header className="flex items-center justify-between border-b border-white/10 bg-[#111111] px-4 py-3.5 lg:hidden">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/InfraX_Logo_c4d52eba.jpg"
            alt="InfraX"
            className="h-7 w-20 object-cover object-center mix-blend-lighten"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#AEDD00]">
            Admin
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen((prev) => !prev)}
          className="flex h-10 w-10 items-center justify-center border border-white/15 bg-[#050505] text-white"
          aria-label="Toggle admin menu"
        >
          {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`${
          mobileNavOpen ? 'block' : 'hidden'
        } w-full shrink-0 border-b border-white/10 bg-[#111111] lg:flex lg:w-64 lg:flex-col lg:justify-between lg:border-b-0 lg:border-r`}
      >
        <div>
          <div className="hidden items-center justify-between border-b border-white/10 px-6 py-5 lg:flex">
            <img
              src="/assets/aistudio/InfraX_Logo_c4d52eba.jpg"
              alt="InfraX"
              className="h-7 w-20 object-cover object-center mix-blend-lighten"
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#AEDD00]">
              Admin
            </span>
          </div>

          <nav className="p-3 space-y-1" aria-label="Admin sections">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider transition-colors ${
                    isActive
                      ? 'bg-[#AEDD00] text-[#050505]'
                      : 'text-[#A0A0A0] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 p-4 space-y-3">
          <div className="px-1">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
              Signed In
            </p>
            <p className="mt-0.5 truncate text-xs text-white">{currentUser.email}</p>
          </div>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-between border border-white/15 bg-[#050505] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#A0A0A0] hover:border-[#AEDD00] hover:text-[#AEDD00]"
          >
            <span>View Public Site</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 border border-white/15 bg-[#050505] px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:border-red-400 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-4 py-7 sm:px-8 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-5xl">
          {banner && (
            <div
              role="status"
              className={`mb-6 flex items-start justify-between gap-3 border p-4 text-xs leading-relaxed ${
                banner.type === 'success'
                  ? 'border-[#AEDD00]/50 bg-[#AEDD00]/10 text-[#AEDD00]'
                  : 'border-red-500/40 bg-red-950/30 text-red-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {banner.type === 'success' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{banner.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="text-current opacity-70 hover:opacity-100"
                aria-label="Dismiss message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#AEDD00]">
                    Operations Overview
                  </p>
                  <h1 className="mt-1.5 font-display text-3xl font-bold uppercase tracking-tight text-white">
                    InfraX Admin Panel
                  </h1>
                </div>
                <button
                  type="button"
                  disabled={busyKey === 'seed'}
                  onClick={handleSeedBaseline}
                  className="inline-flex items-center gap-2 border border-white/20 bg-[#111111] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:border-[#AEDD00] hover:text-[#AEDD00] disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${busyKey === 'seed' ? 'animate-spin' : ''}`} />
                  <span>
                    {busyKey === 'seed' ? 'Syncing...' : 'Sync Baseline Content to Cloud'}
                  </span>
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="border border-white/10 bg-[#111111] p-5">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                    Competitions
                  </p>
                  <p className="mt-2 font-display text-3xl font-bold text-white">
                    {competitions.length}
                  </p>
                  <p className="mt-1 text-xs text-[#A0A0A0]">
                    {competitions.filter((c) => c.status === 'Open').length} Open ·{' '}
                    {competitions.filter((c) => c.status === 'Coming Soon').length} Coming Soon
                  </p>
                </div>

                <div className="border border-white/10 bg-[#111111] p-5">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                    Uploaded PDFs
                  </p>
                  <p className="mt-2 font-display text-3xl font-bold text-white">
                    {documents.length}
                  </p>
                  <p className="mt-1 text-xs text-[#A0A0A0]">
                    {documents.filter((d) => d.scope === 'competition').length} Competition ·{' '}
                    {documents.filter((d) => d.scope === 'general').length} General
                  </p>
                </div>

                <div className="border border-white/10 bg-[#111111] p-5">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                    Event Date
                  </p>
                  <p className="mt-2 font-display text-xl font-bold text-[#AEDD00]">
                    {siteContent.eventDateDisplay || 'TBA'}
                  </p>
                  <p className="mt-1 truncate text-xs text-[#A0A0A0]">
                    {siteContent.venue} {!isLoadedFromCloud && '· Local Defaults'}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                    Competitions Status
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('competitions')}
                    className="font-mono text-[11px] uppercase tracking-wider text-[#AEDD00] hover:underline"
                  >
                    Edit Competitions →
                  </button>
                </div>

                <div className="overflow-x-auto border border-white/10 bg-[#111111]">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-[#050505] font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                        <th className="px-4 py-3">Competition</th>
                        <th className="px-4 py-3">Scope</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Registration</th>
                        <th className="px-4 py-3">Guidelines PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {competitions.map((comp) => {
                        const docObj = documents.find((d) => d.id === comp.guidelinesDocId);
                        return (
                          <tr key={comp.id} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3.5 font-semibold text-white">
                              {comp.title}
                            </td>
                            <td className="px-4 py-3.5 text-[#A0A0A0]">{comp.category}</td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`font-mono text-[11px] uppercase tracking-wider ${
                                  comp.status === 'Open'
                                    ? 'text-[#AEDD00]'
                                    : comp.status === 'Closed'
                                      ? 'text-red-400'
                                      : 'text-[#A0A0A0]'
                                }`}
                              >
                                {comp.status || 'Coming Soon'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-[#A0A0A0]">
                              {comp.registrationFormUrl ? (
                                <span className="text-white">
                                  {comp.registrationProvider || 'Tally'} Linked
                                </span>
                              ) : (
                                'Not Set'
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-[#A0A0A0]">
                              {docObj
                                ? docObj.fileName
                                : comp.guidelinesPdfUrl
                                  ? 'External URL'
                                  : 'Not Uploaded'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMPETITIONS */}
          {activeTab === 'competitions' && compDraft && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#AEDD00]">
                  Competition Management
                </p>
                <h1 className="mt-1.5 font-display text-3xl font-bold uppercase tracking-tight text-white">
                  Edit Competitions
                </h1>
              </div>

              <div className="flex flex-wrap gap-2">
                {competitions.map((comp) => (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => setSelectedCompId(comp.id)}
                    className={`border px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      selectedCompId === comp.id
                        ? 'border-[#AEDD00] bg-[#AEDD00] text-[#050505]'
                        : 'border-white/15 bg-[#111111] text-[#A0A0A0] hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {comp.index} · {comp.title}
                  </button>
                ))}
              </div>

              <form
                onSubmit={handleSaveCompetition}
                className="space-y-6 border border-white/10 bg-[#111111] p-6 sm:p-8"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Competition Title
                    </label>
                    <input
                      type="text"
                      value={compDraft.title}
                      onChange={(e) =>
                        setCompDraft({ ...compDraft, title: e.target.value })
                      }
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Registration Status
                    </label>
                    <select
                      value={compDraft.status || 'Coming Soon'}
                      onChange={(e) =>
                        setCompDraft({
                          ...compDraft,
                          status: e.target.value as CompetitionStatus,
                        })
                      }
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    >
                      <option value="Coming Soon">Coming Soon</option>
                      <option value="Open">Open</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Scope / Category
                    </label>
                    <select
                      value={compDraft.category}
                      onChange={(e) =>
                        setCompDraft({
                          ...compDraft,
                          category: e.target.value as CompetitionScope,
                        })
                      }
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    >
                      <option value="Intra-School">Intra-School</option>
                      <option value="Inter-School">Inter-School</option>
                      <option value="Intra-School & Inter-School">
                        Intra-School &amp; Inter-School
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Participation Format
                    </label>
                    <select
                      value={compDraft.participationType}
                      onChange={(e) =>
                        setCompDraft({
                          ...compDraft,
                          participationType: e.target.value as ParticipationType,
                        })
                      }
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    >
                      <option value="Individual">Individual</option>
                      <option value="Team">Team</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Eligible Grades
                    </label>
                    <input
                      type="text"
                      value={compDraft.eligibleGrades ?? ''}
                      onChange={(e) =>
                        setCompDraft({ ...compDraft, eligibleGrades: e.target.value })
                      }
                      placeholder="e.g. Grades 8–13"
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Team Size
                    </label>
                    <input
                      type="text"
                      value={compDraft.teamSize ?? ''}
                      onChange={(e) =>
                        setCompDraft({ ...compDraft, teamSize: e.target.value })
                      }
                      placeholder="e.g. 1 Participant or Up to 3 Members"
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      School Entry Limit
                    </label>
                    <input
                      type="text"
                      value={compDraft.schoolLimit ?? ''}
                      onChange={(e) =>
                        setCompDraft({ ...compDraft, schoolLimit: e.target.value })
                      }
                      placeholder="e.g. Maximum 2 teams per school"
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Max Duration / Time Limit
                    </label>
                    <input
                      type="text"
                      value={compDraft.maxDuration ?? ''}
                      onChange={(e) =>
                        setCompDraft({ ...compDraft, maxDuration: e.target.value })
                      }
                      placeholder="Optional (e.g. 15 Minutes)"
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                    Short Card Description
                  </label>
                  <textarea
                    rows={2}
                    value={compDraft.shortDescription}
                    onChange={(e) =>
                      setCompDraft({ ...compDraft, shortDescription: e.target.value })
                    }
                    className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                    Full Competition Overview
                  </label>
                  <textarea
                    rows={4}
                    value={compDraft.fullDescription}
                    onChange={(e) =>
                      setCompDraft({ ...compDraft, fullDescription: e.target.value })
                    }
                    className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Registration Provider
                    </label>
                    <select
                      value={compDraft.registrationProvider || 'Tally'}
                      onChange={(e) =>
                        setCompDraft({
                          ...compDraft,
                          registrationProvider: e.target.value as RegistrationProvider,
                        })
                      }
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    >
                      <option value="Tally">Tally</option>
                      <option value="Google Forms">Google Forms</option>
                      <option value="External">External</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Registration Form URL
                    </label>
                    <input
                      type="url"
                      value={compDraft.registrationFormUrl ?? ''}
                      onChange={(e) =>
                        setCompDraft({
                          ...compDraft,
                          registrationFormUrl: e.target.value || null,
                        })
                      }
                      placeholder="https://tally.so/r/..."
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Assigned Uploaded Guidelines PDF
                    </label>
                    <select
                      value={compDraft.guidelinesDocId ?? ''}
                      onChange={(e) =>
                        setCompDraft({
                          ...compDraft,
                          guidelinesDocId: e.target.value || null,
                        })
                      }
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    >
                      <option value="">None (Use External URL or Coming Soon)</option>
                      {documents.map((docRec) => (
                        <option key={docRec.id} value={docRec.id}>
                          {docRec.title} ({docRec.fileName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      External Guidelines PDF URL (Fallback)
                    </label>
                    <input
                      type="url"
                      value={compDraft.guidelinesPdfUrl ?? ''}
                      onChange={(e) =>
                        setCompDraft({
                          ...compDraft,
                          guidelinesPdfUrl: e.target.value || null,
                        })
                      }
                      placeholder="Optional https://..."
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                    Rules &amp; Guidelines (One per line)
                  </label>
                  <textarea
                    rows={5}
                    value={rulesText}
                    onChange={(e) => setRulesText(e.target.value)}
                    className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                    Judging &amp; Evaluation Criteria (One per line)
                  </label>
                  <textarea
                    rows={4}
                    value={evalNotesText}
                    onChange={(e) => setEvalNotesText(e.target.value)}
                    className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Submission Notice
                    </label>
                    <textarea
                      rows={2}
                      value={compDraft.submissionNotice}
                      onChange={(e) =>
                        setCompDraft({ ...compDraft, submissionNotice: e.target.value })
                      }
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Deadline Notice
                    </label>
                    <textarea
                      rows={2}
                      value={compDraft.deadlineNotice}
                      onChange={(e) =>
                        setCompDraft({ ...compDraft, deadlineNotice: e.target.value })
                      }
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end border-t border-white/10 pt-5">
                  <button
                    type="submit"
                    disabled={busyKey === 'save-comp'}
                    className="bg-[#AEDD00] px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216] disabled:opacity-50"
                  >
                    {busyKey === 'save-comp' ? 'Saving Changes...' : 'Save Competition'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: DOCUMENTS (PDF UPLOAD & MANAGEMENT) */}
          {activeTab === 'documents' && (
            <div className="space-y-8">
              <div className="border-b border-white/10 pb-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#AEDD00]">
                  PDF Repository
                </p>
                <h1 className="mt-1.5 font-display text-3xl font-bold uppercase tracking-tight text-white">
                  Documents &amp; Guidelines PDFs
                </h1>
              </div>

              {/* Upload New PDF Form */}
              <form
                onSubmit={handleUploadNewPdf}
                className="space-y-5 border border-white/10 bg-[#111111] p-6"
              >
                <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                  Upload New PDF
                </h2>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Document Title
                    </label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="e.g. Graphic Design Official Guidelines"
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Document Scope
                    </label>
                    <select
                      value={uploadScope}
                      onChange={(e) =>
                        setUploadScope(e.target.value as 'competition' | 'general')
                      }
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    >
                      <option value="competition">Competition Guidelines PDF</option>
                      <option value="general">General Event Information PDF</option>
                    </select>
                  </div>

                  {uploadScope === 'competition' && (
                    <div>
                      <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                        Assign to Competition
                      </label>
                      <select
                        value={uploadCompId}
                        onChange={(e) => setUploadCompId(e.target.value)}
                        className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                      >
                        {competitions.map((comp) => (
                          <option key={comp.id} value={comp.id}>
                            {comp.title} ({comp.category})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Select PDF File (Max 3 MB)
                    </label>
                    <input
                      id="new-pdf-file-input"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      className="mt-1.5 block w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-[#A0A0A0] file:mr-3 file:border-0 file:bg-[#AEDD00] file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:text-[#050505]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                    Short Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                    placeholder="Brief description shown for general documents"
                    className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busyKey === 'upload-pdf'}
                    className="inline-flex items-center gap-2 bg-[#AEDD00] px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216] disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    <span>
                      {busyKey === 'upload-pdf' ? 'Uploading PDF...' : 'Upload & Publish PDF'}
                    </span>
                  </button>
                </div>
              </form>

              {/* Uploaded Documents List */}
              <div className="space-y-3">
                <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                  Published PDFs ({documents.length})
                </h2>

                {documents.length === 0 ? (
                  <div className="border border-white/10 bg-[#111111] p-8 text-center text-sm text-[#A0A0A0]">
                    No PDF documents uploaded yet. Upload your first guidelines or event PDF above.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((docRec) => {
                      const assignedComp = competitions.find(
                        (c) => c.id === docRec.competitionId
                      );
                      return (
                        <div
                          key={docRec.id}
                          className="flex flex-col justify-between gap-4 border border-white/10 bg-[#111111] p-5 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <h3 className="font-display text-base font-bold text-white">
                                {docRec.title}
                              </h3>
                              <span className="font-mono text-[10px] uppercase tracking-wider text-[#AEDD00]">
                                {docRec.scope === 'general'
                                  ? 'General Event PDF'
                                  : assignedComp
                                    ? `Competition: ${assignedComp.title}`
                                    : 'Competition PDF'}
                              </span>
                            </div>
                            <p className="font-mono text-xs text-[#A0A0A0]">
                              {docRec.fileName} · {formatBytes(docRec.fileSize)}
                            </p>
                            {docRec.description && (
                              <p className="text-xs text-[#A0A0A0]">{docRec.description}</p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => downloadStoredPdf(docRec.id, docRec.fileName)}
                              className="inline-flex items-center gap-1.5 border border-white/20 bg-[#050505] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:border-[#AEDD00] hover:text-[#AEDD00]"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Download</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditDocModal(docRec)}
                              className="border border-white/20 bg-[#050505] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:border-[#AEDD00] hover:text-[#AEDD00]"
                            >
                              Edit / Replace
                            </button>

                            <button
                              type="button"
                              disabled={busyKey === `del-doc-${docRec.id}`}
                              onClick={() => requestDeleteDocument(docRec)}
                              className="inline-flex items-center gap-1.5 border border-red-500/30 bg-[#050505] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-red-300 hover:border-red-400 hover:bg-red-950/30"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: REGISTRATION LINKS */}
          {activeTab === 'registrations' && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#AEDD00]">
                  External Forms Control
                </p>
                <h1 className="mt-1.5 font-display text-3xl font-bold uppercase tracking-tight text-white">
                  Registration Links
                </h1>
              </div>

              <div className="space-y-4">
                {competitions.map((comp) => {
                  const edit = regEdits[comp.id] ?? {
                    provider: comp.registrationProvider ?? 'Tally',
                    url: comp.registrationFormUrl ?? '',
                    status: comp.status ?? 'Coming Soon',
                  };
                  return (
                    <div
                      key={comp.id}
                      className="border border-white/10 bg-[#111111] p-5 sm:p-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3.5">
                        <div>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#AEDD00]">
                            {comp.index} · {comp.category}
                          </span>
                          <h2 className="font-display text-lg font-bold text-white">
                            {comp.title}
                          </h2>
                        </div>
                        <span
                          className={`font-mono text-[11px] uppercase tracking-wider ${
                            edit.status === 'Open'
                              ? 'text-[#AEDD00]'
                              : edit.status === 'Closed'
                                ? 'text-red-400'
                                : 'text-[#A0A0A0]'
                          }`}
                        >
                          {edit.status}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-12">
                        <div className="sm:col-span-3">
                          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                            Provider
                          </label>
                          <select
                            value={edit.provider}
                            onChange={(e) =>
                              setRegEdits((prev) => ({
                                ...prev,
                                [comp.id]: {
                                  ...edit,
                                  provider: e.target.value as RegistrationProvider,
                                },
                              }))
                            }
                            className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                          >
                            <option value="Tally">Tally</option>
                            <option value="Google Forms">Google Forms</option>
                            <option value="External">External</option>
                          </select>
                        </div>

                        <div className="sm:col-span-6">
                          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                            Registration URL
                          </label>
                          <input
                            type="url"
                            value={edit.url}
                            onChange={(e) =>
                              setRegEdits((prev) => ({
                                ...prev,
                                [comp.id]: { ...edit, url: e.target.value },
                              }))
                            }
                            placeholder="https://tally.so/r/... or Google Form URL"
                            className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                            Status
                          </label>
                          <select
                            value={edit.status}
                            onChange={(e) =>
                              setRegEdits((prev) => ({
                                ...prev,
                                [comp.id]: {
                                  ...edit,
                                  status: e.target.value as CompetitionStatus,
                                },
                              }))
                            }
                            className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                          >
                            <option value="Coming Soon">Coming Soon</option>
                            <option value="Open">Open</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap justify-end gap-2.5">
                        <button
                          type="button"
                          disabled={busyKey === `reg-${comp.id}`}
                          onClick={() => handleSaveRegistrationRow(comp, 'Closed')}
                          className="border border-white/20 bg-[#050505] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#A0A0A0] hover:border-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          Disable Registration
                        </button>

                        <button
                          type="button"
                          disabled={busyKey === `reg-${comp.id}`}
                          onClick={() => handleSaveRegistrationRow(comp)}
                          className="bg-[#AEDD00] px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216] disabled:opacity-50"
                        >
                          {busyKey === `reg-${comp.id}` ? 'Saving...' : 'Save Link'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: WEBSITE CONTENT */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#AEDD00]">
                  Global Content &amp; Timeline
                </p>
                <h1 className="mt-1.5 font-display text-3xl font-bold uppercase tracking-tight text-white">
                  Website Content
                </h1>
              </div>

              <form
                onSubmit={handleSaveSiteContent}
                className="space-y-6 border border-white/10 bg-[#111111] p-6 sm:p-8"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Countdown Target (ISO SLST)
                    </label>
                    <input
                      type="text"
                      value={contentDraft.eventDate ?? ''}
                      onChange={(e) =>
                        setContentDraft({
                          ...contentDraft,
                          eventDate: e.target.value || null,
                        })
                      }
                      placeholder="2027-01-25T08:30:00+05:30"
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Displayed Event Date
                    </label>
                    <input
                      type="text"
                      value={contentDraft.eventDateDisplay}
                      onChange={(e) =>
                        setContentDraft({
                          ...contentDraft,
                          eventDateDisplay: e.target.value,
                        })
                      }
                      placeholder="January 25, 2027"
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Venue
                    </label>
                    <input
                      type="text"
                      value={contentDraft.venue}
                      onChange={(e) =>
                        setContentDraft({ ...contentDraft, venue: e.target.value })
                      }
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Registration Deadline Notice
                    </label>
                    <input
                      type="text"
                      value={contentDraft.registrationDeadlineText}
                      onChange={(e) =>
                        setContentDraft({
                          ...contentDraft,
                          registrationDeadlineText: e.target.value,
                        })
                      }
                      placeholder="Optional notice displayed on registration section"
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Official Contact Email
                    </label>
                    <input
                      type="email"
                      value={contentDraft.contactEmail ?? ''}
                      onChange={(e) =>
                        setContentDraft({
                          ...contentDraft,
                          contactEmail: e.target.value || null,
                        })
                      }
                      placeholder="Optional official email"
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Official Contact Phone
                    </label>
                    <input
                      type="text"
                      value={contentDraft.contactPhone ?? ''}
                      onChange={(e) =>
                        setContentDraft({
                          ...contentDraft,
                          contactPhone: e.target.value || null,
                        })
                      }
                      placeholder="Optional phone number"
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Short Film Voting Tally URL
                    </label>
                    <input
                      type="url"
                      value={contentDraft.shortFilmVotingFormUrl ?? ''}
                      onChange={(e) =>
                        setContentDraft({
                          ...contentDraft,
                          shortFilmVotingFormUrl: e.target.value || null,
                        })
                      }
                      placeholder="https://tally.so/r/..."
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                      Short Film Voting Deadline (ISO)
                    </label>
                    <input
                      type="text"
                      value={contentDraft.shortFilmVotingDeadline ?? ''}
                      onChange={(e) =>
                        setContentDraft({
                          ...contentDraft,
                          shortFilmVotingDeadline: e.target.value || null,
                        })
                      }
                      placeholder="Optional ISO date string"
                      className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                    Event Announcement Banner (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={contentDraft.announcement}
                    onChange={(e) =>
                      setContentDraft({ ...contentDraft, announcement: e.target.value })
                    }
                    placeholder="Leave blank to keep banner hidden"
                    className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                    Sponsor / Partner Information (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={contentDraft.sponsorInfo}
                    onChange={(e) =>
                      setContentDraft({ ...contentDraft, sponsorInfo: e.target.value })
                    }
                    placeholder="Leave blank if no sponsor line is needed"
                    className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                  />
                </div>

                {/* Timeline Milestones Editor */}
                <div className="border-t border-white/10 pt-6">
                  <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                    Event Timeline Milestones
                  </h2>
                  <p className="mt-1 text-xs text-[#A0A0A0]">
                    Update milestone dates, phases, and descriptions displayed on the homepage and
                    /timeline.
                  </p>

                  <div className="mt-4 space-y-3">
                    {contentDraft.timelineMilestones.map((m, idx) => (
                      <div
                        key={m.id}
                        className="grid gap-3 border border-white/10 bg-[#050505] p-4 sm:grid-cols-12"
                      >
                        <div className="sm:col-span-4">
                          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                            Step {m.step} Title
                          </label>
                          <input
                            type="text"
                            value={m.title}
                            onChange={(e) => {
                              const next = [...contentDraft.timelineMilestones];
                              next[idx] = { ...m, title: e.target.value };
                              setContentDraft({ ...contentDraft, timelineMilestones: next });
                            }}
                            className="mt-1 w-full border border-white/15 bg-[#111111] px-2.5 py-1.5 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                            Phase
                          </label>
                          <input
                            type="text"
                            value={m.phase}
                            onChange={(e) => {
                              const next = [...contentDraft.timelineMilestones];
                              next[idx] = { ...m, phase: e.target.value };
                              setContentDraft({ ...contentDraft, timelineMilestones: next });
                            }}
                            className="mt-1 w-full border border-white/15 bg-[#111111] px-2.5 py-1.5 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                            Date (Blank = TBA)
                          </label>
                          <input
                            type="text"
                            value={m.date ?? ''}
                            onChange={(e) => {
                              const next = [...contentDraft.timelineMilestones];
                              next[idx] = { ...m, date: e.target.value || null };
                              setContentDraft({ ...contentDraft, timelineMilestones: next });
                            }}
                            placeholder="TBA"
                            className="mt-1 w-full border border-white/15 bg-[#111111] px-2.5 py-1.5 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-12">
                          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#A0A0A0]">
                            Description
                          </label>
                          <input
                            type="text"
                            value={m.description}
                            onChange={(e) => {
                              const next = [...contentDraft.timelineMilestones];
                              next[idx] = { ...m, description: e.target.value };
                              setContentDraft({ ...contentDraft, timelineMilestones: next });
                            }}
                            className="mt-1 w-full border border-white/15 bg-[#111111] px-2.5 py-1.5 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end border-t border-white/10 pt-5">
                  <button
                    type="submit"
                    disabled={busyKey === 'save-content'}
                    className="bg-[#AEDD00] px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216] disabled:opacity-50"
                  >
                    {busyKey === 'save-content' ? 'Publishing...' : 'Save Website Content'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB: SHORT FILM VOTING */}
          {activeTab === 'voting' && (
            <AdminVotingPanel onNotify={notify} onConfirm={setConfirmAction} />
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-8">
              <div className="border-b border-white/10 pb-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#AEDD00]">
                  Access &amp; Cloud Sync
                </p>
                <h1 className="mt-1.5 font-display text-3xl font-bold uppercase tracking-tight text-white">
                  Settings
                </h1>
              </div>

              <div className="border border-white/10 bg-[#111111] p-6 space-y-2">
                <p className="font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                  Active Administrator Session
                </p>
                <p className="text-sm font-semibold text-white">{currentUser.email}</p>
                <p className="font-mono text-xs text-[#A0A0A0]">UID: {currentUser.uid}</p>
              </div>

              <div className="border border-white/10 bg-[#111111] p-6 space-y-5">
                <div>
                  <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                    Authorized Administrators
                  </h2>
                  <p className="mt-1 text-xs text-[#A0A0A0]">
                    Add additional verified Firebase Auth User UIDs allowed to access this admin
                    panel.
                  </p>
                </div>

                <form onSubmit={handleAddAdmin} className="grid gap-4 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={newAdminUid}
                      onChange={(e) => setNewAdminUid(e.target.value)}
                      placeholder="Firebase User UID"
                      className="w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="Verified Email Address"
                      className="w-full border border-white/15 bg-[#050505] px-3.5 py-2.5 text-xs text-white focus:border-[#AEDD00] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={busyKey === 'add-admin'}
                      className="w-full bg-[#AEDD00] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216] disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </form>

                <div className="divide-y divide-white/10 border border-white/10 bg-[#050505]">
                  <div className="flex items-center justify-between px-4 py-3 text-xs">
                    <div>
                      <span className="font-semibold text-white">wijnelum@gmail.com</span>
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-[#AEDD00]">
                        Primary Owner
                      </span>
                    </div>
                  </div>
                  {adminEntries.map((entry) => (
                    <div
                      key={entry.uid}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{entry.email}</p>
                        <p className="truncate font-mono text-[11px] text-[#A0A0A0]">
                          {entry.uid}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => requestRemoveAdmin(entry)}
                        className="border border-red-500/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-300 hover:border-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Edit / Replace PDF Modal */}
      {editingDoc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-lg border border-white/15 bg-[#111111] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                Edit / Replace PDF
              </h2>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="text-[#A0A0A0] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDocEdits} className="mt-5 space-y-4">
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                  Document Title
                </label>
                <input
                  type="text"
                  value={editDocTitle}
                  onChange={(e) => setEditDocTitle(e.target.value)}
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                  Scope
                </label>
                <select
                  value={editDocScope}
                  onChange={(e) =>
                    setEditDocScope(e.target.value as 'competition' | 'general')
                  }
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                >
                  <option value="competition">Competition Guidelines PDF</option>
                  <option value="general">General Event Information PDF</option>
                </select>
              </div>

              {editDocScope === 'competition' && (
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                    Assigned Competition
                  </label>
                  <select
                    value={editDocCompId}
                    onChange={(e) => setEditDocCompId(e.target.value)}
                    className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                  >
                    {competitions.map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                  Description
                </label>
                <input
                  type="text"
                  value={editDocDesc}
                  onChange={(e) => setEditDocDesc(e.target.value)}
                  className="mt-1.5 w-full border border-white/15 bg-[#050505] px-3.5 py-2 text-sm text-white focus:border-[#AEDD00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                  Replace PDF File (Optional, Max 3 MB)
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
                  className="mt-1.5 block w-full border border-white/15 bg-[#050505] px-3 py-2 text-xs text-[#A0A0A0] file:mr-3 file:border-0 file:bg-[#AEDD00] file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:text-[#050505]"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="border border-white/20 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyKey === `edit-doc-${editingDoc.id}`}
                  className="bg-[#AEDD00] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216] disabled:opacity-50"
                >
                  {busyKey === `edit-doc-${editingDoc.id}` ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-md border border-white/15 bg-[#111111] p-6">
            <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white">
              {confirmAction.title}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-[#A0A0A0]">
              {confirmAction.message}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = confirmAction.onConfirm;
                  setConfirmAction(null);
                  await fn();
                }}
                className="bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-600"
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

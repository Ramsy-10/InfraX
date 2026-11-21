import { ArrowLeft, ArrowRight, CheckCircle2, Info, Vote } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RegistrationSection } from '../components/RegistrationSection';
import { useSiteData } from '../context/SiteDataContext';
import { fetchPublicVotingState, type PublicVotingState } from '../lib/votingApi';

export function CompetitionDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { competitions } = useSiteData();

  const currentIndex = competitions.findIndex((c) => c.slug === slug);
  const competition = currentIndex >= 0 ? competitions[currentIndex] : null;

  const [votingState, setVotingState] = useState<PublicVotingState | null>(null);
  const [votingLoaded, setVotingLoaded] = useState(false);

  const isShortFilm = competition?.slug === 'short-film';

  useEffect(() => {
    window.scrollTo(0, 0);
    if (competition) {
      document.title = `${competition.title} | InfraX Competitions`;
    } else {
      document.title = 'Competition Not Found | InfraX';
    }
  }, [competition]);

  useEffect(() => {
    if (!isShortFilm) return;
    let cancelled = false;
    fetchPublicVotingState()
      .then((data) => {
        if (!cancelled) {
          setVotingState(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVotingState(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setVotingLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isShortFilm]);

  if (!competition) {
    return (
      <main className="flex min-h-[75vh] items-center justify-center bg-[#050505] px-4 pt-24">
        <div className="max-w-md border border-white/15 bg-[#111111] p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]">
            Not Found
          </p>
          <h1 className="mt-3 font-display text-2xl font-bold text-white">
            Competition Not Found
          </h1>
          <p className="mt-3 text-sm text-[#A0A0A0]">
            The requested competition page could not be located. Return to the full competitions
            directory to browse all six InfraX tracks.
          </p>
          <Link
            to="/competitions"
            className="mt-6 inline-flex min-h-[44px] items-center gap-2 bg-[#AEDD00] px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Competitions</span>
          </Link>
        </div>
      </main>
    );
  }

  const prevComp = currentIndex > 0 ? competitions[currentIndex - 1] : null;
  const nextComp =
    currentIndex < competitions.length - 1 ? competitions[currentIndex + 1] : null;

  const statusLabel =
    competition.status === 'Closed'
      ? 'Closed'
      : competition.status === 'Open' && competition.registrationFormUrl
        ? `Open via ${competition.registrationProvider ?? 'Tally'}`
        : competition.status === 'Open'
          ? 'Open (Form Pending)'
          : 'Opening Soon';

  // Section 2: Only display fields relevant to the selected competition
  const infoItems: { label: string; value: string }[] = [
    ...(competition.eligibleGrades
      ? [{ label: 'Eligible Grades', value: competition.eligibleGrades }]
      : []),
    {
      label: 'Participation Format',
      value:
        competition.participationType === 'Team' ? 'Team Competition' : 'Individual Entry',
    },
    ...(competition.teamSize ? [{ label: 'Team Size', value: competition.teamSize }] : []),
    ...(competition.schoolLimit
      ? [{ label: 'Maximum Teams Per School', value: competition.schoolLimit }]
      : []),
    ...(competition.maxDuration
      ? [{ label: 'Maximum Video Duration', value: competition.maxDuration }]
      : []),
    {
      label: 'Registration Status',
      value: statusLabel,
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] pt-24 pb-20 sm:pt-28">
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link
          to="/competitions"
          className="inline-flex min-h-[40px] items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A0A0A0] transition-colors hover:text-[#AEDD00]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>All Competitions</span>
        </Link>

        {/* SECTION 1 — HEADER */}
        <header className="mt-6 border-b border-white/10 pb-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <span className="font-mono font-semibold text-[#AEDD00] tabular-nums">
              {competition.index}
            </span>
            <span aria-hidden="true" className="text-white/25">
              /
            </span>
            <span className="border border-white/15 bg-[#111111] px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-white">
              {competition.category}
            </span>
            <span aria-hidden="true" className="text-white/25">
              ·
            </span>
            <span className="text-[#A0A0A0]">{competition.participationType}</span>
          </div>

          <h1 className="mt-5 font-display text-4xl font-extrabold uppercase tracking-tight text-white sm:text-5xl lg:text-6xl text-balance">
            {competition.title}
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#A0A0A0]">
            {competition.shortDescription}
          </p>
        </header>

        {isShortFilm && (
          <section
            aria-label="Short Film Public Voting"
            className="mt-8 flex flex-col gap-5 border border-[#AEDD00]/40 bg-[#111111] p-6 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]">
                Short Film Public Voting · People&apos;s Choice
              </p>
              {!votingLoaded ? (
                <p className="mt-1.5 text-sm text-[#A0A0A0]">
                  Checking public voting status...
                </p>
              ) : votingState?.votingStatus === 'open' ? (
                <p className="mt-1.5 text-sm text-[#A0A0A0]">
                  Public voting is open for eligible invited schools (30% public score + 70%
                  judges evaluation).
                </p>
              ) : votingState?.votingStatus === 'upcoming' ? (
                <p className="mt-1.5 text-sm text-[#A0A0A0]">
                  Voting Opens Soon
                  {votingState.opensAt
                    ? ` · Scheduled for ${new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Asia/Colombo',
                      }).format(new Date(votingState.opensAt))} (SLST)`
                    : ''}
                  .
                </p>
              ) : votingState?.votingStatus === 'closed' ? (
                <p className="mt-1.5 text-sm text-[#A0A0A0]">
                  Voting Closed. Public voting for the InfraX Short Film Competition has ended.
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-[#A0A0A0]">
                  Public voting is not open yet. Eligible submissions and voting will appear here
                  once opened.
                </p>
              )}
            </div>

            {votingLoaded && votingState?.votingStatus === 'open' ? (
              <Link
                to="/vote"
                className="inline-flex min-h-[46px] shrink-0 items-center justify-center gap-2 bg-[#AEDD00] px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#050505] transition-colors hover:bg-[#c2f216] whitespace-nowrap"
              >
                <Vote className="h-4 w-4" />
                <span>CAST YOUR VOTE</span>
              </Link>
            ) : (
              <Link
                to="/vote"
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 border border-white/20 bg-[#050505] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:border-[#AEDD00] hover:text-[#AEDD00] whitespace-nowrap"
              >
                <Vote className="h-4 w-4" />
                <span>
                  {votingState?.votingStatus === 'closed'
                    ? 'Voting Closed'
                    : 'Voting Opens Soon'}
                </span>
              </Link>
            )}
          </section>
        )}

        {/* SECTION 2 — COMPETITION INFORMATION */}
        <section aria-labelledby="section-info-heading" className="mt-10">
          <h2
            id="section-info-heading"
            className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]"
          >
            Competition Information
          </h2>

          <dl className="grid grid-cols-1 gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {infoItems.map((item) => (
              <div key={item.label} className="bg-[#111111] p-6">
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#A0A0A0]">
                  {item.label}
                </dt>
                <dd
                  className={`mt-2 font-display text-lg font-semibold ${
                    item.label === 'Registration Status' && competition.registrationOpen
                      ? 'text-[#AEDD00]'
                      : 'text-white'
                  }`}
                >
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* SECTION 3 — ABOUT THE COMPETITION */}
        <section
          aria-labelledby="section-about-heading"
          className="mt-12 border-t border-white/10 pt-10"
        >
          <h2
            id="section-about-heading"
            className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]"
          >
            About the Competition
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/90 sm:text-lg">
            {competition.fullDescription}
          </p>
        </section>

        {/* SECTION 4 — RULES & REQUIREMENTS */}
        <section
          aria-labelledby="section-rules-heading"
          className="mt-12 border-t border-white/10 pt-10"
        >
          <h2
            id="section-rules-heading"
            className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]"
          >
            Rules &amp; Requirements
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {competition.rules.map((rule) => (
              <li
                key={rule}
                className="flex items-start gap-3 border border-white/10 bg-[#111111] p-5 text-sm leading-relaxed text-[#A0A0A0]"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#AEDD00]" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* SECTION 5 — REGISTRATION & GUIDELINES */}
        <section aria-label="Registration and Guidelines" className="mt-12">
          <RegistrationSection competition={competition} />
        </section>

        {/* SECTION 6 — IMPORTANT INFORMATION */}
        <section
          aria-labelledby="section-important-heading"
          className="mt-12 border-t border-white/10 pt-10"
        >
          <h2
            id="section-important-heading"
            className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]"
          >
            Important Information
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="border border-white/10 bg-[#111111] p-6">
              <h3 className="font-display text-lg font-bold text-white">
                Evaluation &amp; Judging
              </h3>
              <ul className="mt-3 space-y-2.5">
                {competition.evaluationNotes.map((note) => (
                  <li key={note} className="text-sm leading-relaxed text-[#A0A0A0]">
                    {note}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-white/10 bg-[#111111] p-6">
              <h3 className="font-display text-lg font-bold text-white">
                Submissions &amp; Deadlines
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#A0A0A0]">
                {competition.submissionNotice}
              </p>
              <div className="mt-4 flex items-start gap-2.5 border-t border-white/10 pt-3 text-sm text-white">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#AEDD00]" />
                <span>{competition.deadlineNotice}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Previous / Next Competition Navigation */}
        <nav
          aria-label="Browse other competitions"
          className="mt-14 flex flex-col justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row"
        >
          {prevComp ? (
            <Link
              to={`/competitions/${prevComp.slug}`}
              className="group flex items-center gap-3 border border-white/10 bg-[#111111] px-5 py-4 transition-colors hover:border-[#AEDD00]"
            >
              <ArrowLeft className="h-4 w-4 text-[#A0A0A0] group-hover:text-[#AEDD00]" />
              <div>
                <span className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                  Previous · {prevComp.index}
                </span>
                <span className="font-display text-base font-bold text-white group-hover:text-[#AEDD00]">
                  {prevComp.title}
                </span>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextComp && (
            <Link
              to={`/competitions/${nextComp.slug}`}
              className="group flex items-center justify-between gap-3 border border-white/10 bg-[#111111] px-5 py-4 text-right transition-colors hover:border-[#AEDD00] sm:justify-end"
            >
              <div>
                <span className="block font-mono text-[11px] uppercase tracking-wider text-[#A0A0A0]">
                  Next · {nextComp.index}
                </span>
                <span className="font-display text-base font-bold text-white group-hover:text-[#AEDD00]">
                  {nextComp.title}
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-[#A0A0A0] group-hover:text-[#AEDD00]" />
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}

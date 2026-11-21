import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TimelineSection } from '../components/TimelineSection';
import { useSiteData } from '../context/SiteDataContext';

export function TimelinePage() {
  const { siteContent } = useSiteData();

  useEffect(() => {
    document.title = 'Event Timeline | InfraX — Bandaranayaka College ICT Day';
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen bg-[#050505] pt-24 pb-16 sm:pt-28">
      <section className="mx-auto max-w-[1280px] px-4 pb-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]">
              Schedule &amp; Milestones
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold uppercase tracking-tight text-white sm:text-5xl text-balance">
              Event Timeline
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#A0A0A0]">
              Follow every stage of InfraX from initial announcement and competition registration to
              Short Film public voting and the final ICT Day at {siteContent.venue}.
            </p>
          </div>

          <div className="border border-white/15 bg-[#111111] px-5 py-4 shrink-0">
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-[#A0A0A0]">
              Main Event Date
            </span>
            <span className="mt-1 block font-mono text-sm font-semibold uppercase tracking-wider text-[#AEDD00]">
              {siteContent.eventDate ? siteContent.eventDateDisplay : 'DATE TO BE ANNOUNCED'}
            </span>
          </div>
        </div>
      </section>

      <div className="-mt-12">
        <TimelineSection />
      </div>

      <section className="mx-auto max-w-[1280px] px-4 pt-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 border border-white/10 bg-[#111111] p-7 sm:flex-row sm:items-center sm:p-9">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              Prepare Your Submission Early
            </h2>
            <p className="mt-1.5 text-sm text-[#A0A0A0]">
              Review competition eligibility and guidelines while official milestone dates are
              finalized.
            </p>
          </div>
          <Link
            to="/competitions"
            className="inline-flex min-h-[44px] items-center gap-2 bg-[#AEDD00] px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#050505] transition-colors hover:bg-[#c2f216] whitespace-nowrap shrink-0"
          >
            <span>Explore Competitions</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

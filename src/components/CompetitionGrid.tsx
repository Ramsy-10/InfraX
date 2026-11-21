import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSiteData } from '../context/SiteDataContext';
import type { Competition } from '../types/infrax';
import { CompetitionCard } from './CompetitionCard';

interface CompetitionGridProps {
  competitions?: Competition[];
  isHomePreview?: boolean;
}

export function CompetitionGrid({
  competitions,
  isHomePreview = false,
}: CompetitionGridProps) {
  const { competitions: liveCompetitions } = useSiteData();
  const list = competitions ?? liveCompetitions;

  return (
    <section className="border-t border-white/10 bg-[#050505] py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {isHomePreview && (
          <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]">
                Competitions
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl text-balance">
                Six Disciplines. One Arena.
              </h2>
              <p className="mt-3 max-w-2xl text-base text-[#A0A0A0]">
                Explore Intra-School and Inter-School competitions crafted for students across
                Grades 8–13. Select any track to view eligibility, guidelines, and registration.
              </p>
            </div>

            <Link
              to="/competitions"
              className="inline-flex min-h-[44px] items-center gap-2 border border-white/20 bg-[#111111] px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors duration-150 hover:border-[#AEDD00] hover:text-[#AEDD00] whitespace-nowrap shrink-0 self-start md:self-auto"
            >
              <span>VIEW ALL COMPETITIONS</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map((competition) => (
            <CompetitionCard key={competition.id} competition={competition} />
          ))}
        </div>
      </div>
    </section>
  );
}

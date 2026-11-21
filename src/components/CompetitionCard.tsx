import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Competition } from '../types/infrax';

interface CompetitionCardProps {
  competition: Competition;
}

export function CompetitionCard({ competition }: CompetitionCardProps) {
  const scopeDetail = competition.eligibleGrades
    ? competition.eligibleGrades
    : competition.teamSize
      ? competition.teamSize
      : null;

  return (
    <Link
      to={`/competitions/${competition.slug}`}
      className="group flex h-full flex-col justify-between border border-white/10 bg-[#111111] p-6 transition-colors duration-150 hover:border-[#AEDD00]/75 hover:bg-[#141414] sm:p-7"
    >
      <div>
        {/* Top Row: Competition Number + Category Label */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <span className="font-mono text-xs font-semibold tracking-wider text-[#AEDD00] tabular-nums">
            {competition.index}
          </span>
          <span className="border border-white/12 bg-[#0A0A0A] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-white/90 whitespace-nowrap shrink-0">
            {competition.category}
          </span>
        </div>

        {/* Competition Name */}
        <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-white transition-colors duration-150 group-hover:text-[#AEDD00]">
          {competition.title}
        </h3>

        {/* Participation Type & Eligibility */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#A0A0A0]">
          <span className="text-white/85">{competition.participationType}</span>
          {scopeDetail && (
            <>
              <span aria-hidden="true">·</span>
              <span>{scopeDetail}</span>
            </>
          )}
        </div>

        {/* Short Description */}
        <p className="mt-4 text-sm leading-relaxed text-[#A0A0A0]">
          {competition.shortDescription}
        </p>
      </div>

      {/* View Competition Action */}
      <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-4">
        <span className="text-xs font-bold uppercase tracking-wider text-white transition-colors duration-150 group-hover:text-[#AEDD00]">
          View Competition
        </span>
        <ArrowUpRight className="h-4 w-4 text-[#A0A0A0] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#AEDD00]" />
      </div>
    </Link>
  );
}

import { ExternalLink, Play } from 'lucide-react';
import { useState } from 'react';
import type { FilmSubmission } from '../types/infrax';

interface FilmCardProps {
  film: FilmSubmission;
  votingOpen: boolean;
  isSelected?: boolean;
  onVoteClick: (film: FilmSubmission) => void;
}

export function FilmCard({
  film,
  votingOpen,
  isSelected = false,
  onVoteClick,
}: FilmCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <article
      className={`group flex flex-col justify-between bg-[#0B0B0B] transition-colors duration-200 ${
        isSelected ? 'ring-1 ring-[#AEDD00]' : 'ring-1 ring-white/10 hover:ring-white/25'
      }`}
    >
      <div>
        {/* Minimal 16:9 Cinema Preview */}
        <div className="relative aspect-video w-full overflow-hidden bg-[#111111]">
          {film.thumbnailUrl && !imageError ? (
            <img
              src={film.thumbnailUrl}
              alt={`${film.title} — ${film.schoolName}`}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => setImageError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-mono text-xs uppercase tracking-[0.22em] text-white/25 tabular-nums">
                {film.slotNumber}
              </span>
            </div>
          )}
        </div>

        <div className="p-6 pb-5">
          <h2 className="font-display text-lg font-bold tracking-tight text-white">
            {film.title}
          </h2>
          <p className="mt-1.5 text-xs uppercase tracking-wider text-[#A0A0A0]">
            {film.schoolName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 px-6 pb-6">
        {film.videoUrl ? (
          <a
            href={film.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:border-white/40 whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Watch Film</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex min-h-[42px] flex-1 cursor-not-allowed items-center justify-center gap-2 border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/35 whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Watch Film</span>
          </button>
        )}

        <button
          type="button"
          disabled={!votingOpen}
          onClick={() => onVoteClick(film)}
          className={`inline-flex min-h-[42px] flex-1 items-center justify-center px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
            votingOpen
              ? 'bg-[#AEDD00] text-[#050505] hover:bg-[#c2f216]'
              : 'cursor-not-allowed bg-white/5 text-white/35'
          }`}
        >
          <span>Vote</span>
        </button>
      </div>
    </article>
  );
}

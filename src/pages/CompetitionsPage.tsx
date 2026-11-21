import { Download, FileText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CompetitionCard } from '../components/CompetitionCard';
import { EVENT_CONFIG } from '../config/infraxConfig';
import { useSiteData } from '../context/SiteDataContext';
import { downloadStoredPdf } from '../lib/pdfStorage';
import type { CompetitionFilter } from '../types/infrax';

const FILTER_OPTIONS: { label: string; value: CompetitionFilter }[] = [
  { label: 'All Competitions', value: 'All' },
  { label: 'Intra-School', value: 'Intra-School' },
  { label: 'Inter-School', value: 'Inter-School' },
];

export function CompetitionsPage() {
  const { competitions, generalDocuments, siteContent } = useSiteData();
  const [activeFilter, setActiveFilter] = useState<CompetitionFilter>('All');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Competitions | InfraX — Bandaranayaka College ICT Day';
    window.scrollTo(0, 0);
  }, []);

  const filteredCompetitions = useMemo(() => {
    if (activeFilter === 'All') return competitions;
    return competitions.filter((comp) => comp.category.includes(activeFilter));
  }, [activeFilter, competitions]);

  const handleDownloadGeneral = async (docId: string, fileName: string) => {
    setDownloadingId(docId);
    try {
      await downloadStoredPdf(docId, fileName);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] pt-24 pb-20 sm:pt-28 sm:pb-28">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* Directory Header & Filters */}
        <header className="flex flex-col gap-8 border-b border-white/10 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]">
              {EVENT_CONFIG.organizerShort}
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold uppercase tracking-tight text-white sm:text-5xl text-balance">
              Competitions
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[#A0A0A0]">
              Browse all six official InfraX competition tracks for Grades 8–13. Filter by category
              or select any competition to view eligibility, guidelines, and registration.
            </p>
            {siteContent.registrationDeadlineText.trim() && (
              <p className="mt-3 font-mono text-xs uppercase tracking-wider text-[#AEDD00]">
                {siteContent.registrationDeadlineText}
              </p>
            )}
          </div>

          <div
            role="group"
            aria-label="Filter competitions by category"
            className="inline-flex flex-wrap gap-1 border border-white/15 bg-[#111111] p-1 self-start lg:self-auto"
          >
            {FILTER_OPTIONS.map((option) => {
              const isSelected = activeFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setActiveFilter(option.value)}
                  aria-pressed={isSelected}
                  className={`min-h-[40px] px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-[#AEDD00] text-[#050505]'
                      : 'text-[#A0A0A0] hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* Directory Count */}
        <div className="mt-6 mb-8 flex items-center justify-between text-xs text-[#A0A0A0]">
          <span>
            Showing <strong className="text-white tabular-nums">{filteredCompetitions.length}</strong>{' '}
            of <strong className="text-white tabular-nums">{competitions.length}</strong>{' '}
            competitions
          </span>
          <span className="font-mono uppercase tracking-wider text-white/70">
            {activeFilter === 'All' ? 'All Categories' : activeFilter}
          </span>
        </div>

        {/* Clean Organized Competition Grid */}
        <section aria-label="Competition directory">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCompetitions.map((competition) => (
              <CompetitionCard key={competition.id} competition={competition} />
            ))}
          </div>
        </section>

        {/* General Event Documents (visible only when admin uploads general event PDFs) */}
        {generalDocuments.length > 0 && (
          <section
            aria-label="General event documents"
            className="mt-16 border-t border-white/10 pt-12"
          >
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]">
              Event Downloads
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-white">
              General Event Documents
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {generalDocuments.map((docItem) => (
                <div
                  key={docItem.id}
                  className="flex flex-col justify-between gap-4 border border-white/10 bg-[#111111] p-6 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-white">
                      <FileText className="h-4 w-4 shrink-0 text-[#AEDD00]" />
                      <h3 className="truncate font-display text-base font-bold">
                        {docItem.title}
                      </h3>
                    </div>
                    {docItem.description && (
                      <p className="mt-1.5 text-xs leading-relaxed text-[#A0A0A0]">
                        {docItem.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={downloadingId === docItem.id}
                    onClick={() => handleDownloadGeneral(docItem.id, docItem.fileName)}
                    className="inline-flex min-h-[40px] items-center gap-2 border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#AEDD00] hover:text-[#AEDD00] whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{downloadingId === docItem.id ? 'Preparing...' : 'Download PDF'}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

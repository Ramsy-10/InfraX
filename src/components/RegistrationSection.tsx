import { ArrowUpRight, ClipboardList, Info, Lock } from 'lucide-react';
import { useState } from 'react';
import type { Competition } from '../types/infrax';
import { GuidelinesButton } from './GuidelinesButton';

interface RegistrationSectionProps {
  competition: Competition;
}

export function RegistrationSection({ competition }: RegistrationSectionProps) {
  const [showEmbed, setShowEmbed] = useState(false);
  const [showPendingNotice, setShowPendingNotice] = useState(false);

  const status = competition.status ?? (competition.registrationFormUrl ? 'Open' : 'Coming Soon');
  const provider = competition.registrationProvider ?? 'Tally';
  const hasFormUrl = Boolean(competition.registrationFormUrl);
  const isClosed = status === 'Closed';
  const isOpen = status === 'Open' && hasFormUrl;

  const handleRegisterClick = () => {
    if (isClosed) return;
    if (isOpen) {
      setShowEmbed((prev) => !prev);
    } else {
      setShowPendingNotice((prev) => !prev);
    }
  };

  return (
    <div className="border border-white/10 bg-[#111111] p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#AEDD00]">
            Registration &amp; Guidelines
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-white">
            {isClosed
              ? 'Registration Closed'
              : isOpen
                ? `Official ${provider} Registration Open`
                : 'Registration Opening Soon'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#A0A0A0]">
            {isClosed
              ? `Registrations for ${competition.title} have closed. You can still review competition rules and guidelines below.`
              : isOpen
                ? `Complete the official ${competition.title} registration form hosted via ${provider} and review the competition guidelines PDF before submitting.`
                : `All ${competition.title} registrations are managed externally through ${provider}. The official form link and downloadable guidelines PDF will be activated here once published.`}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start shrink-0">
          <button
            type="button"
            disabled={isClosed}
            onClick={handleRegisterClick}
            className={`inline-flex min-h-[48px] items-center justify-center gap-2.5 px-7 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors duration-150 whitespace-nowrap shrink-0 ${
              isClosed
                ? 'cursor-not-allowed border border-white/15 bg-[#0A0A0A] text-white/40'
                : 'bg-[#AEDD00] text-[#050505] hover:bg-[#c2f216]'
            }`}
          >
            {isClosed ? (
              <>
                <Lock className="h-4 w-4" />
                <span>REGISTRATION CLOSED</span>
              </>
            ) : (
              <>
                <ClipboardList className="h-4 w-4" />
                <span>{showEmbed ? 'HIDE REGISTRATION FORM' : 'REGISTER NOW'}</span>
              </>
            )}
          </button>

          <GuidelinesButton
            competitionTitle={competition.title}
            pdfUrl={competition.guidelinesPdfUrl}
            docId={competition.guidelinesDocId}
          />
        </div>
      </div>

      {/* Honest Pending Registration Notice when Form URL is not yet configured */}
      {!isClosed && !isOpen && showPendingNotice && (
        <div
          role="status"
          className="mt-6 flex flex-col gap-3 border border-[#AEDD00]/35 bg-[#050505] p-5 sm:flex-row sm:items-start"
        >
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#AEDD00]" />
          <div className="space-y-1.5 text-sm">
            <p className="font-semibold text-white">
              Registration Form Pending Publication
            </p>
            <p className="text-[#A0A0A0] leading-relaxed">
              The official <strong className="text-white">{competition.title}</strong>{' '}
              registration form has not been published yet. Once registration opens, clicking
              Register Now will display the form directly.
            </p>
          </div>
        </div>
      )}

      {/* Embedded Tally / Google Form + Direct External Link */}
      {isOpen && showEmbed && competition.registrationFormUrl && (
        <div className="mt-6 border-t border-white/10 pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs uppercase tracking-wider text-[#A0A0A0]">
              {provider} Registration Portal · {competition.title}
            </span>
            <a
              href={competition.registrationFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#AEDD00] hover:underline"
            >
              <span>Open Form in New Tab</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="overflow-hidden border border-white/10 bg-[#050505]">
            <iframe
              src={competition.registrationFormUrl}
              title={`${competition.title} Registration Form`}
              className="h-[640px] w-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
}

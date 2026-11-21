import { Download, ExternalLink, FileWarning, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { downloadStoredPdf } from '../lib/pdfStorage';

interface GuidelinesButtonProps {
  competitionTitle: string;
  pdfUrl: string | null;
  docId?: string | null;
  variant?: 'secondary' | 'compact';
}

export function GuidelinesButton({
  competitionTitle,
  pdfUrl,
  docId = null,
  variant = 'secondary',
}: GuidelinesButtonProps) {
  const [showUnavailableMessage, setShowUnavailableMessage] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasDocument = Boolean(docId || pdfUrl);

  const handleClick = async () => {
    setErrorMsg(null);
    if (!hasDocument) {
      setShowUnavailableMessage((prev) => !prev);
      return;
    }

    if (docId) {
      setDownloading(true);
      try {
        await downloadStoredPdf(
          docId,
          `${competitionTitle.toLowerCase().replace(/\s+/g, '-')}-guidelines.pdf`
        );
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to download guidelines PDF right now.'
        );
      } finally {
        setDownloading(false);
      }
      return;
    }

    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = `${competitionTitle.toLowerCase().replace(/\s+/g, '-')}-guidelines.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={downloading}
        onClick={handleClick}
        className={`inline-flex min-h-[48px] items-center justify-center gap-2.5 border px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors duration-150 whitespace-nowrap shrink-0 ${
          hasDocument
            ? 'border-white/25 bg-[#111111] text-white hover:border-[#AEDD00] hover:text-[#AEDD00]'
            : 'border-white/15 bg-[#111111] text-[#A0A0A0] hover:border-white/30 hover:text-white'
        } ${variant === 'compact' ? 'px-5 py-3' : ''}`}
      >
        {downloading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>PREPARING PDF...</span>
          </>
        ) : hasDocument ? (
          <>
            <Download className="h-4 w-4" />
            <span>DOWNLOAD GUIDELINES</span>
            {!docId && <ExternalLink className="h-3.5 w-3.5 opacity-60" />}
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            <span>DOWNLOAD GUIDELINES</span>
          </>
        )}
      </button>

      {showUnavailableMessage && !hasDocument && (
        <div
          role="status"
          className="mt-3 flex items-start gap-2.5 border border-white/15 bg-[#111111] p-3.5 text-xs leading-relaxed text-[#A0A0A0]"
        >
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-[#AEDD00]" />
          <span>
            The official <strong className="text-white">{competitionTitle}</strong> guidelines PDF
            has not yet been uploaded. Please check back once competition briefs are released.
          </span>
        </div>
      )}

      {errorMsg && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AboutSection } from '../components/AboutSection';
import { CompetitionGrid } from '../components/CompetitionGrid';
import { FAQSection } from '../components/FAQSection';
import { HeroSection } from '../components/HeroSection';
import { TimelineSection } from '../components/TimelineSection';
import { EVENT_CONFIG } from '../config/infraxConfig';

export function HomePage() {
  useEffect(() => {
    document.title = 'InfraX — Beyond Infrastructure, Into The Future | Bandaranayaka College ICT Day';
  }, []);

  return (
    <main>
      <HeroSection />
      <AboutSection />
      <CompetitionGrid isHomePreview />

      {/* Registration CTA Band */}
      <section className="border-t border-white/10 bg-[#111111] py-16 sm:py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-8 border border-white/10 bg-[#050505] p-8 sm:p-12 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]">
                Competition Registration
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl text-balance">
                Ready to Compete at InfraX?
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#A0A0A0]">
                Select your competition track to review eligibility criteria, download the official
                guidelines PDF, and register via Tally. {EVENT_CONFIG.targetGrades} across
                Intra-School and Inter-School categories.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <Link
                to="/competitions"
                className="inline-flex min-h-[48px] items-center gap-2.5 bg-[#AEDD00] px-7 py-3.5 text-xs font-bold uppercase tracking-wider text-[#050505] transition-colors hover:bg-[#c2f216] whitespace-nowrap shrink-0"
              >
                <span>Select Competition</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/vote"
                className="inline-flex min-h-[48px] items-center gap-2 border border-white/20 bg-[#111111] px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:border-[#AEDD00] hover:text-[#AEDD00] whitespace-nowrap shrink-0"
              >
                <span>Short Film Voting</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <TimelineSection isHomePreview />
      <FAQSection />
    </main>
  );
}

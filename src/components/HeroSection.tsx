import { ArrowRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { EVENT_CONFIG } from '../config/infraxConfig';
import { useSiteData } from '../context/SiteDataContext';
import { CountdownTimer } from './CountdownTimer';
import { InfrastructureCanvas } from './InfrastructureCanvas';

export function HeroSection() {
  const { siteContent, competitions } = useSiteData();

  const scrollToAbout = () => {
    const el = document.getElementById('about');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-[#050505] pt-24 pb-12 sm:pt-28 lg:pb-16">
      <InfrastructureCanvas />

      {/* Vignette Scrim for Typography Contrast */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#050505]/70 via-transparent to-[#050505]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-1 flex-col justify-center px-4 sm:px-6 lg:px-8">
        {siteContent.announcement.trim() && (
          <div className="mb-8 border border-[#AEDD00]/35 bg-[#111111]/90 px-4 py-3 text-xs sm:text-sm">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#AEDD00] mr-3">
              Announcement
            </span>
            <span className="text-white/90">{siteContent.announcement}</span>
          </div>
        )}

        <div className="grid grid-cols-1 items-end gap-12 lg:grid-cols-12">
          {/* Primary Editorial Column */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6"
          >
            <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-[#AEDD00]">
              {EVENT_CONFIG.heroLabel}
            </p>

            <h1 className="mt-5 font-display text-6xl font-extrabold uppercase tracking-tight text-white sm:text-7xl lg:text-[5.75rem] lg:leading-[0.94]">
              INFRA<span className="text-[#AEDD00]">X</span>
            </h1>

            <p className="mt-4 font-display text-2xl font-bold uppercase tracking-tight text-white/95 sm:text-3xl text-balance">
              THE FUTURE IS IN OUR HANDS.
            </p>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#A0A0A0] sm:text-lg">
              {EVENT_CONFIG.heroDescription}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/competitions"
                className="inline-flex min-h-[48px] items-center gap-2.5 bg-[#AEDD00] px-7 py-3.5 text-xs font-bold uppercase tracking-wider text-[#050505] transition-colors duration-150 hover:bg-[#c2f216] whitespace-nowrap shrink-0"
              >
                <span>EXPLORE COMPETITIONS</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <button
                type="button"
                onClick={scrollToAbout}
                className="inline-flex min-h-[48px] items-center gap-2 border border-white/20 bg-[#111111]/80 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white transition-colors duration-150 hover:border-[#AEDD00] hover:text-[#AEDD00] whitespace-nowrap shrink-0"
              >
                <span>DISCOVER INFRAX</span>
                <ArrowDownRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>

          {/* Right Column: Visually Dominant Countdown */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6"
          >
            <CountdownTimer />
          </motion.div>
        </div>
      </div>

      {/* Bottom Metadata Bar */}
      <div className="relative z-10 mx-auto mt-12 w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5 text-xs text-[#A0A0A0]">
          <span>{EVENT_CONFIG.organizer}</span>
          <div className="flex items-center gap-3">
            <span>Intra-School &amp; Inter-School Competitions</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#AEDD00]">{competitions.length} Tracks</span>
          </div>
        </div>
      </div>
    </section>
  );
}

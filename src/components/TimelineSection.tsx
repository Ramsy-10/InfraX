import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useSiteData } from '../context/SiteDataContext';

interface TimelineSectionProps {
  isHomePreview?: boolean;
}

export function TimelineSection({ isHomePreview = false }: TimelineSectionProps) {
  const { siteContent } = useSiteData();

  return (
    <section className="border-t border-white/10 bg-[#050505] py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mb-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]">
              Event Schedule
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl text-balance">
              Road to InfraX
            </h2>
            <p className="mt-3 max-w-2xl text-base text-[#A0A0A0]">
              Chronological milestones from initial launch through Short Film public voting and
              the main event day at {siteContent.venue}.
            </p>
          </div>

          {isHomePreview && (
            <Link
              to="/timeline"
              className="inline-flex min-h-[44px] items-center gap-2 border border-white/20 bg-[#111111] px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors duration-150 hover:border-[#AEDD00] hover:text-[#AEDD00] whitespace-nowrap shrink-0 self-start md:self-auto"
            >
              <span>Full Timeline</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* Connected Chronological Timeline */}
        <div className="relative pl-8 sm:pl-10">
          {/* Vertical Spine */}
          <div
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-3 w-px bg-white/15 sm:left-4"
          />

          <ol className="space-y-6">
            {siteContent.timelineMilestones.map((milestone, idx) => (
              <motion.li
                key={milestone.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{
                  duration: 0.4,
                  delay: Math.min(idx * 0.04, 0.24),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="relative"
              >
                {/* Lime Square Node Indicator */}
                <div
                  aria-hidden="true"
                  className="absolute -left-[26px] top-6 flex h-3.5 w-3.5 items-center justify-center border border-[#AEDD00] bg-[#050505] sm:-left-[30px]"
                >
                  <div className="h-1.5 w-1.5 bg-[#AEDD00]" />
                </div>

                <div className="grid grid-cols-1 gap-4 border border-white/10 bg-[#111111] p-6 transition-colors duration-150 hover:border-white/25 lg:grid-cols-12 lg:items-center lg:gap-8">
                  <div className="flex items-center gap-4 lg:col-span-3">
                    <span className="font-mono text-sm font-semibold text-[#AEDD00] tabular-nums">
                      {milestone.step}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wider text-[#A0A0A0]">
                      {milestone.phase}
                    </span>
                  </div>

                  <div className="lg:col-span-5">
                    <h3 className="font-display text-lg font-bold text-white sm:text-xl">
                      {milestone.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#A0A0A0]">
                      {milestone.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 lg:col-span-4 lg:justify-end lg:border-t-0 lg:pt-0">
                    <span className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-white">
                      {milestone.date ?? 'DATE TO BE ANNOUNCED'}
                    </span>

                    {!isHomePreview && milestone.actionPath && milestone.actionLabel && (
                      <Link
                        to={milestone.actionPath}
                        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#AEDD00] hover:underline whitespace-nowrap shrink-0"
                      >
                        <span>{milestone.actionLabel}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

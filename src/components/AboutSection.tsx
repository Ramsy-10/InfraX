import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { EVENT_CONFIG } from '../config/infraxConfig';
import { useSiteData } from '../context/SiteDataContext';

const FEATURE_PILLARS = [
  {
    number: '01.',
    title: 'Creative Craft',
    description: 'Graphic design, short film storytelling, and visual presentation challenges.',
  },
  {
    number: '02.',
    title: 'Technical Mastery',
    description: 'Web engineering and rapid ICT problem-solving across modern concepts.',
  },
  {
    number: '03.',
    title: 'Critical Discourse',
    description: 'Inter-school debate encouraging reasoned argumentation and stage confidence.',
  },
];

export function AboutSection() {
  const { siteContent } = useSiteData();

  return (
    <section id="about" className="border-t border-white/10 bg-[#050505] py-20 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-10 md:gap-8 lg:gap-14">
          {/* Left Column (~40%): Event Identity */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-left md:col-span-4"
          >
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[#AEDD00]">
              About InfraX
            </p>

            <h2 className="mt-4 font-display text-[2rem] font-extrabold uppercase leading-[0.96] tracking-[-0.03em] text-white sm:text-[2.5rem] md:text-[1.95rem] lg:text-[2.65rem] xl:text-[3.1rem]">
              <span className="block">BEYOND</span>
              <span className="block">INFRASTRUCTURE,</span>
              <span className="block">INTO THE FUTURE.</span>
            </h2>

            <div className="mt-8 border-t border-white/15 pt-7">
              <dl className="space-y-5">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#AEDD00]">
                    Organizer
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium leading-snug text-white">
                    {EVENT_CONFIG.organizerShort}
                  </dd>
                </div>

                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#AEDD00]">
                    Venue
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium leading-snug text-white">
                    {siteContent.venue}
                  </dd>
                </div>

                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#AEDD00]">
                    Eligibility Scope
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium leading-snug text-white">
                    {EVENT_CONFIG.targetGrades} · Intra-School &amp; Inter-School
                  </dd>
                </div>
              </dl>
            </div>
          </motion.div>

          {/* Right Column (~60%): Description Panel */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-6"
          >
            <div className="border border-white/10 bg-[#111111] p-6 sm:p-8 md:p-8 lg:p-11 xl:p-12">
              <p className="text-lg font-medium leading-[1.55] text-white sm:text-xl lg:text-[1.35rem] lg:leading-[1.5]">
                InfraX is an ICT Day organized by the ICT Club of Bandaranayaka College – Kegalle,
                bringing together students to explore technology, creativity, innovation,
                problem-solving, and digital possibilities.
              </p>

              <p className="mt-5 text-sm leading-relaxed text-[#A0A0A0] sm:text-base sm:leading-[1.65]">
                Through a collection of competitions and creative challenges, InfraX aims to
                encourage students to discover their potential, develop practical skills, and
                engage with the future of technology.
              </p>

              <div className="mt-8 border-t border-white/10 pt-8">
                <div className="grid grid-cols-1 gap-7 sm:grid-cols-3 sm:gap-6 lg:gap-8">
                  {FEATURE_PILLARS.map((pillar) => (
                    <div key={pillar.number} className="min-w-0">
                      <h3 className="font-display text-[15px] font-bold tracking-tight text-white lg:text-base">
                        <span className="mr-1.5 font-mono text-xs font-semibold text-[#AEDD00] tabular-nums">
                          {pillar.number}
                        </span>
                        {pillar.title}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-[#A0A0A0] sm:text-[13px]">
                        {pillar.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-9">
                <Link
                  to="/competitions"
                  className="group inline-flex min-h-[46px] items-center gap-2.5 bg-[#AEDD00] px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[#050505] transition-colors duration-150 hover:bg-[#c2f216] whitespace-nowrap shrink-0"
                >
                  <span>Explore All Competitions</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}


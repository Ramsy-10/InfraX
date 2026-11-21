import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useSiteData } from '../context/SiteDataContext';

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Parses an ISO-8601 timestamp with explicit timezone offset (e.g. +05:30 for Asia/Colombo),
 * returning UTC epoch milliseconds independent of the browser's local timezone.
 */
function getValidTargetTimestamp(dateString: string | null): number | null {
  if (!dateString) return null;
  const parsed = Date.parse(dateString);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function calculateRemaining(targetMs: number): TimeRemaining | null {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds };
}

interface AnimatedDigitProps {
  value: string;
  isAccent?: boolean;
}

function AnimatedDigit({ value, isAccent = false }: AnimatedDigitProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <span
        className={`block font-display text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl xl:text-[3.25rem] xl:leading-none ${
          isAccent ? 'text-[#AEDD00]' : 'text-white'
        }`}
      >
        {value}
      </span>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className={`block font-display text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl xl:text-[3.25rem] xl:leading-none ${
            isAccent ? 'text-[#AEDD00]' : 'text-white'
          }`}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function CountdownTimer() {
  const { siteContent } = useSiteData();
  const targetMs = getValidTargetTimestamp(siteContent.eventDate);
  const [remaining, setRemaining] = useState<TimeRemaining | null>(() =>
    targetMs ? calculateRemaining(targetMs) : null
  );

  useEffect(() => {
    if (!targetMs) {
      setRemaining(null);
      return;
    }

    let intervalId = 0;

    const update = () => {
      const next = calculateRemaining(targetMs);
      setRemaining(next);
      if (!next && intervalId) {
        window.clearInterval(intervalId);
      }
    };

    update();
    if (targetMs > Date.now()) {
      intervalId = window.setInterval(update, 1000);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [targetMs]);

  const isEventReached = Boolean(targetMs) && !remaining;

  const units = remaining
    ? [
        { label: 'DAYS', value: String(remaining.days).padStart(2, '0'), isAccent: false },
        { label: 'HOURS', value: String(remaining.hours).padStart(2, '0'), isAccent: false },
        { label: 'MINUTES', value: String(remaining.minutes).padStart(2, '0'), isAccent: false },
        { label: 'SECONDS', value: String(remaining.seconds).padStart(2, '0'), isAccent: true },
      ]
    : [
        { label: 'DAYS', value: '00', isAccent: false },
        { label: 'HOURS', value: '00', isAccent: false },
        { label: 'MINUTES', value: '00', isAccent: false },
        { label: 'SECONDS', value: '00', isAccent: true },
      ];

  return (
    <div className="border border-white/12 bg-[#050505]/95 p-6 sm:p-8 lg:p-9">
      {/* Subtle Top Label + Dominant Theme Heading */}
      <div className="border-b border-white/10 pb-6">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[#AEDD00]">
          COUNTDOWN TO INFRAX
        </p>
        <h2 className="mt-2.5 font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl text-balance">
          THE FUTURE IS IN OUR HANDS.
        </h2>
      </div>

      {/* Countdown Units or Event Reached State */}
      {isEventReached ? (
        <div className="my-7 border border-[#AEDD00]/45 bg-[#111111] px-6 py-8">
          <p className="font-display text-3xl font-extrabold uppercase tracking-tight text-[#AEDD00] sm:text-4xl">
            INFRAX IS HERE.
          </p>
        </div>
      ) : (
        <div
          aria-live="off"
          aria-label="Countdown to InfraX"
          className="my-7 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5"
        >
          {units.map((unit) => (
            <div
              key={unit.label}
              className="flex flex-col justify-between border border-white/10 bg-[#111111] px-4 py-5 sm:px-4 sm:py-6"
            >
              <AnimatedDigit value={unit.value} isAccent={unit.isAccent} />
              <span className="mt-3 block border-t border-white/10 pt-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A0A0A0]">
                {unit.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Event Date & College Label */}
      <div className="flex flex-col gap-2 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-display text-base font-bold uppercase tracking-[0.12em] text-white sm:text-lg">
          {siteContent.eventDateDisplay || 'DATE TO BE ANNOUNCED'}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#A0A0A0]">
          BANDARANAYAKA COLLEGE · KEGALLE
        </span>
      </div>
    </div>
  );
}

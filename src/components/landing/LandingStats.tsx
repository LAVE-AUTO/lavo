'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const STATS = [
  { key: 'stats_merchants', value: 120, suffix: '+' },
  { key: 'stats_bookings', value: 25000, suffix: '+', format: true },
  { key: 'stats_saved', value: 180000, suffix: '+', format: true },
  { key: 'stats_rating', value: 4.9, suffix: '/5', decimal: true },
] as const;

function AnimatedNumber({ target, suffix, format, decimal }: {
  target: number;
  suffix: string;
  format?: boolean;
  decimal?: boolean;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1800;
          const startTime = performance.now();

          function step(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(decimal ? parseFloat((eased * target).toFixed(1)) : Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          }

          requestAnimationFrame(step);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, decimal]);

  const display = format
    ? count.toLocaleString('fr-FR')
    : decimal
      ? count.toFixed(1)
      : count.toString();

  return (
    <span ref={ref}>
      {display}{suffix}
    </span>
  );
}

export function LandingStats() {
  const t = useTranslations('landing');

  return (
    <section className="relative py-20 bg-[#0A0A14] overflow-hidden">
      {/* Decorative */}
      <div className="absolute top-0 left-1/4 w-80 h-80 bg-gold/6 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-60 h-60 bg-gold/4 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {STATS.map((stat) => (
            <div key={stat.key} className="text-center">
              <p className="text-[36px] sm:text-[48px] font-black text-gold leading-none">
                <AnimatedNumber
                  target={stat.value}
                  suffix={stat.suffix}
                  format={'format' in stat ? stat.format : undefined}
                  decimal={'decimal' in stat ? stat.decimal : undefined}
                />
              </p>
              <p className="mt-3 text-[14px] font-semibold text-white/60 uppercase tracking-wider">
                {t(stat.key)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

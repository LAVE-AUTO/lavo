'use client';

import { useTranslations } from 'next-intl';

const STATS = [
  { key: 'stats_stations', value: '120+' },
  { key: 'stats_bookings', value: '25 000+' },
  { key: 'stats_saved', value: '180 000+' },
  { key: 'stats_rating', value: '4.9' },
] as const;

export function LandingStats() {
  const t = useTranslations('landing');

  return (
    <section className="py-16 bg-white dark:bg-dark-bg transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <div
              key={stat.key}
              className="text-center animate-fade-in-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <p className="text-[36px] sm:text-[44px] font-black text-gold leading-none">
                {stat.value}
              </p>
              <p className="mt-2 text-[15px] font-semibold text-[#666] dark:text-[#C0C0B0] uppercase tracking-wider">
                {t(stat.key)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

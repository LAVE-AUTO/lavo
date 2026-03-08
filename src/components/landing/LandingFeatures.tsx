'use client';

import { useTranslations } from 'next-intl';

const FEATURES = [
  {
    key: 'feat_realtime',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    key: 'feat_payment',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    key: 'feat_notif',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    key: 'feat_rating',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
] as const;

export function LandingFeatures() {
  const t = useTranslations('landing');

  return (
    <section className="py-20 sm:py-28 bg-[#F4F3EE] dark:bg-dark-card/60 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in-up">
          <h2 className="text-[32px] sm:text-[40px] font-black text-[#0A0A14] dark:text-white leading-tight">
            {t('features_title')}
          </h2>
          <p className="mt-3 text-[17px] text-[#666] dark:text-[#C0C0B0] max-w-md mx-auto">
            {t('features_subtitle')}
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feat, i) => (
            <div
              key={feat.key}
              className="group rounded-2xl bg-white dark:bg-dark-card border border-[#E8E8D8] dark:border-tab-inactive p-6 hover:border-gold/40 dark:hover:border-gold/30 transition-all hover:shadow-md animate-fade-in-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-gold mb-5 group-hover:bg-gold/15 transition-colors">
                {feat.icon}
              </div>
              <h3 className="text-[17px] font-bold text-[#0A0A14] dark:text-white mb-2">
                {t(`${feat.key}_title`)}
              </h3>
              <p className="text-[15px] text-[#666] dark:text-[#C0C0B0] leading-relaxed">
                {t(`${feat.key}_desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

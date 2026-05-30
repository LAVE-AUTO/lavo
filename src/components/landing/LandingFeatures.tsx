'use client';

import { useTranslations } from 'next-intl';
import { ScrollReveal } from './ScrollReveal';

const FEATURES = [
  {
    key: 'feat_realtime',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    gradient: 'from-blue-500/15 to-blue-500/5',
    accent: 'bg-blue-500',
  },
  {
    key: 'feat_payment',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    gradient: 'from-gold/15 to-gold/5',
    accent: 'bg-gold',
  },
  {
    key: 'feat_notif',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
    gradient: 'from-purple-500/15 to-purple-500/5',
    accent: 'bg-purple-500',
  },
  {
    key: 'feat_rating',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    gradient: 'from-amber-500/15 to-amber-500/5',
    accent: 'bg-amber-500',
  },
] as const;

export function LandingFeatures() {
  const t = useTranslations('landing');

  return (
    <section className="py-16 sm:py-28 bg-[#F4F3EE] dark:bg-surface/60 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <ScrollReveal className="text-center mb-10 sm:mb-16">
          <h2 className="text-[28px] sm:text-[40px] font-black text-foreground leading-tight">
            {t('features_title')}
          </h2>
          <p className="mt-3 text-[17px] text-foreground/65 dark:text-[#C0C0B0] max-w-lg mx-auto">
            {t('features_subtitle')}
          </p>
        </ScrollReveal>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {FEATURES.map((feat, i) => (
            <ScrollReveal key={feat.key} delay={i * 0.08}>
              <div className="group rounded-2xl bg-white dark:bg-surface border border-[#E8E8D8] dark:border-border p-5 sm:p-7 hover:border-gold/30 dark:hover:border-gold/20 transition-all hover:shadow-lg hover:-translate-y-0.5 h-full">
                <div className="flex items-start gap-5">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center text-gold flex-shrink-0 group-hover:scale-105 transition-transform`}>
                    {feat.icon}
                  </div>
                  <div>
                    <h3 className="text-[17px] font-bold text-foreground mb-2">
                      {t(`${feat.key}_title`)}
                    </h3>
                    <p className="text-[15px] text-foreground/65 dark:text-[#C0C0B0] leading-relaxed">
                      {t(`${feat.key}_desc`)}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

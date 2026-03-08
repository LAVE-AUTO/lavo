'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const MERCHANT_FEATURES = ['merchant_feat_1', 'merchant_feat_2', 'merchant_feat_3'] as const;

export function LandingMerchantCTA() {
  const t = useTranslations('landing');

  return (
    <section className="py-20 sm:py-28 bg-[#F4F3EE] dark:bg-dark-card/60 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="rounded-3xl bg-[#0A0A14] dark:bg-dark-bg border border-[#1E1E2E] dark:border-tab-inactive p-10 sm:p-14 lg:p-20 relative overflow-hidden">
          {/* Decorative gradient */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-gold/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-gold/5 rounded-full blur-3xl" />

          <div className="relative z-10 max-w-2xl">
            <h2 className="text-[30px] sm:text-[40px] font-black text-white leading-tight animate-fade-in-up">
              {t('merchant_title')}
            </h2>
            <p className="mt-4 text-[17px] text-[#A0A0A0] leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              {t('merchant_subtitle')}
            </p>

            {/* Feature list */}
            <ul className="mt-8 space-y-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              {MERCHANT_FEATURES.map((key) => (
                <li key={key} className="flex items-center gap-3 text-[15px] text-white/80">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#af8408" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t(key)}
                </li>
              ))}
            </ul>

            <div className="mt-10 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Link
                href="/merchant"
                className="btn-shine inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gold hover:bg-gold-hover rounded-xl text-[16px] font-bold text-dark-bg transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
                {t('merchant_cta')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

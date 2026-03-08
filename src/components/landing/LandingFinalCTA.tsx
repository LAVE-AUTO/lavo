'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ScrollReveal } from './ScrollReveal';

export function LandingFinalCTA() {
  const t = useTranslations('landing');

  return (
    <section className="py-20 sm:py-28 bg-white dark:bg-dark-bg transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <ScrollReveal>
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-[32px] sm:text-[44px] font-black text-[#0A0A14] dark:text-white leading-tight">
              {t('final_cta_title')}
            </h2>
            <p className="mt-4 text-[17px] text-[#666] dark:text-[#C0C0B0] leading-relaxed">
              {t('final_cta_subtitle')}
            </p>
            <div className="mt-8">
              <Link
                href="/stations"
                className="btn-shine inline-flex items-center gap-2 px-10 py-4 bg-gold hover:bg-gold-hover rounded-xl text-[17px] font-bold text-dark-bg transition-colors shadow-xl shadow-gold/20"
              >
                {t('final_cta_button')}
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

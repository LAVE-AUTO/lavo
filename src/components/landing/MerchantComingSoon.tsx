'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function MerchantComingSoon() {
  const t = useTranslations('merchant');

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center bg-[#F8F7F2] dark:bg-dark-bg transition-colors overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-20 -left-20 w-72 h-72 rounded-full bg-gold/8 blur-3xl animate-float-orb" />
      <div className="absolute bottom-20 -right-20 w-64 h-64 rounded-full bg-gold/6 blur-3xl animate-float-orb" style={{ animationDelay: '3s' }} />

      <div className="relative z-10 text-center px-4 sm:px-6 max-w-lg mx-auto animate-fade-in-up">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-8">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#af8408" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
          </svg>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 border border-gold/20 mb-6">
          <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
          <span className="text-[13px] font-bold text-gold tracking-wide uppercase">{t('badge')}</span>
        </div>

        {/* Title */}
        <h1 className="text-[32px] sm:text-[42px] font-black text-[#0A0A14] dark:text-white leading-tight">
          {t('title')}
        </h1>

        {/* Description */}
        <p className="mt-4 text-[17px] text-[#666] dark:text-[#C0C0B0] leading-relaxed mx-auto max-w-md">
          {t('description')}
        </p>

        {/* Back home */}
        <div className="mt-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-[#D0D0C0] dark:border-tab-inactive text-[15px] font-bold text-[#1A1A1A] dark:text-white hover:border-gold hover:text-gold dark:hover:border-gold dark:hover:text-gold transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            {t('back_home')}
          </Link>
        </div>
      </div>
    </section>
  );
}

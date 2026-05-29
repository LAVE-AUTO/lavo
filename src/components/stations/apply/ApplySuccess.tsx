'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Success screen shown after a station onboarding application is submitted.
 */
export function ApplySuccess() {
  const t = useTranslations('station_apply');

  return (
    <div className="text-center animate-fade-in px-4 py-6">
      <div className="w-20 h-20 rounded-full bg-Hurryline-success/10 border border-Hurryline-success/20 flex items-center justify-center mx-auto mb-6">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>

      <h2 className="text-[22px] font-bold text-dark-bg dark:text-white mb-3">
        {t('success_title')}
      </h2>
      <p className="text-[15px] text-foreground/70 dark:text-Hurryline-muted leading-relaxed mb-8 max-w-sm mx-auto">
        {t('success_message')}
      </p>

      <ol className="text-left max-w-xs mx-auto space-y-3 mb-8">
        {(['success_step_1', 'success_step_2', 'success_step_3'] as const).map((key, idx) => (
          <li key={key} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center text-[13px] font-bold text-gold shrink-0 mt-0.5">
              {idx + 1}
            </span>
            <span className="text-[14px] text-[#333] dark:text-[#C0C0B0] leading-snug">
              {t(key)}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/login"
          className="btn-shine inline-flex items-center justify-center py-3.5 px-6 bg-gold hover:bg-gold-hover rounded-[10px] text-[16px] font-bold text-dark-bg tracking-wide transition-colors duration-150"
        >
          {t('success_cta_login')}
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center py-3.5 px-6 border border-[#CCCCCC] dark:border-border rounded-[10px] text-[16px] font-semibold text-[#001201] dark:text-white hover:border-gold transition-colors duration-150"
        >
          {t('success_cta_home')}
        </Link>
      </div>
    </div>
  );
}

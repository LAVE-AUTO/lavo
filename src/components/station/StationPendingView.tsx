'use client';

import { useTranslations } from 'next-intl';

/**
 * Non-dismissible banner shown at the top of the station dashboard
 * when the station's KYC is still pending admin validation.
 */
export function StationPendingView() {
  const t = useTranslations('station_pending');

  return (
    <div className="shrink-0 border-b border-[#DDAF3B]/20 bg-[#FFFBF0] px-5 py-3 dark:border-[#DDAF3B]/15 dark:bg-[#1A1A08]">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        {/* Animated icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DDAF3B]/12">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1">
          <p className="text-[13px] font-bold text-[#9A7A10] dark:text-[#DDAF3B]">
            {t('title')}
          </p>
          <p className="text-[12px] text-[#B09030] dark:text-[#8A7030]">
            {t('notice')}
          </p>
        </div>

        {/* Status pill */}
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#DDAF3B]/25 bg-[#DDAF3B]/8 px-3 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DDAF3B] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#DDAF3B]" />
          </span>
          <span className="text-[11px] font-black uppercase tracking-wider text-[#DDAF3B]">
            {t('status_label')}
          </span>
        </span>
      </div>
    </div>
  );
}

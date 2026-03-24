'use client';

import { useTranslations } from 'next-intl';

/**
 * Non-dismissible banner shown at the top of the station dashboard
 * when the station's KYC is still pending admin validation.
 */
export function StationPendingView() {
  const t = useTranslations('station_pending');

  return (
    <div className="shrink-0 border-b border-[#C49A1E]/20 bg-[#FFFBF0] px-5 py-3 dark:border-[#C49A1E]/15 dark:bg-[#1A1A08]">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        {/* Animated icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C49A1E]/12">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1">
          <p className="text-[12px] font-bold text-[#9A7A10] dark:text-[#C49A1E]">
            {t('title')}
          </p>
          <p className="text-[11px] text-[#B09030] dark:text-[#8A7030]">
            {t('notice')}
          </p>
        </div>

        {/* Status pill */}
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#C49A1E]/25 bg-[#C49A1E]/8 px-3 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C49A1E] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C49A1E]" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#C49A1E]">
            {t('status_label')}
          </span>
        </span>
      </div>
    </div>
  );
}

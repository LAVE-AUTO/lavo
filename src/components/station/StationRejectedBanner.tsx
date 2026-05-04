'use client';

import { useTranslations } from 'next-intl';

interface StationRejectedBannerProps {
  reason: string | null;
}

/**
 * Non-blocking banner shown when station KYC has been rejected.
 * The station can still use the workspace but stays hidden from public listing.
 */
export function StationRejectedBanner({ reason }: StationRejectedBannerProps) {
  const t = useTranslations('station_rejected');

  return (
    <div className="shrink-0 border-b border-[#EF4444]/20 bg-[#FEF2F2] px-5 py-3 dark:border-[#EF4444]/15 dark:bg-[#200D0D]">
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EF4444]/12">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>

        <div className="flex-1">
          <p className="text-[13px] font-bold text-[#B91C1C] dark:text-[#F87171]">{t('title')}</p>
          <p className="text-[12px] text-[#991B1B] dark:text-[#FCA5A5]">{t('banner_notice')}</p>
          {reason && (
            <p className="mt-1 text-[12px] text-[#7F1D1D] dark:text-[#FECACA]">
              <span className="font-semibold">{t('reason_label')}:</span> {reason}
            </p>
          )}
        </div>

        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#EF4444]/25 bg-[#EF4444]/8 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
          <span className="text-[11px] font-black uppercase tracking-wider text-[#EF4444]">{t('status_label')}</span>
        </span>
      </div>
    </div>
  );
}

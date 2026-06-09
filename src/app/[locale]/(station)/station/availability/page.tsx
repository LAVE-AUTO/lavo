'use client';

/**
 * Disponibilité — per-post availability. Each active wash bay gets its own
 * weekly schedule (Mon→Sun, morning/afternoon), bounded by the station's hours,
 * driving the real per-post booking availability (computeAvailability).
 *
 * Backed by GET /station/posts/hours + PUT /station/posts/:postId/hours.
 */
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { PostAvailabilityView } from '@/components/station/availability/PostAvailabilityView';

export default function StationAvailabilityPage() {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex flex-col gap-3 border-b border-[#DDAF3B]/20 px-4 py-4 dark:border-[#DDAF3B]/10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-[#001201] dark:text-[#FFF9EC]">
            {t('availability_title')}
          </h1>
          <p className="mt-0.5 text-sm text-foreground/65 dark:text-[#B0BFB1]">
            {t('availability_subtitle')}
          </p>
        </div>

        {/* Shortcuts to the related Config tabs (Hours + Capacity) */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={`/${locale}/station/config?tab=hours`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#FFF9EC] bg-white px-3 py-2 text-[12px] font-bold text-[#5A5A4A] transition-colors hover:border-[#DDAF3B]/40 hover:text-[#DDAF3B] dark:border-[#001A05] dark:bg-[#182214] dark:text-[#B0BFB1]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
            {t('availability_link_hours')}
          </Link>
          <Link
            href={`/${locale}/station/config?tab=capacity`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#FFF9EC] bg-white px-3 py-2 text-[12px] font-bold text-[#5A5A4A] transition-colors hover:border-[#DDAF3B]/40 hover:text-[#DDAF3B] dark:border-[#001A05] dark:bg-[#182214] dark:text-[#B0BFB1]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            {t('availability_link_capacity')}
          </Link>
        </div>
      </div>

      <PostAvailabilityView />
    </div>
  );
}

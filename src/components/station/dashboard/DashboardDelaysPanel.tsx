'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';

export interface DashboardDelayItem {
  id: string;
  clientName: string;
  message: string;
  requestedAt: string;
}

interface Props {
  items: DashboardDelayItem[];
  totalPending: number;
}

function timeAgo(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.round((now - then) / 60_000));
  if (diffMin < 1) return 'à l’instant';
  if (diffMin < 60) return locale === 'en' ? `${diffMin} min ago` : `il y a ${diffMin} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return locale === 'en' ? `${h} h ago` : `il y a ${h} h`;
  const d = Math.round(h / 24);
  return locale === 'en' ? `${d} d ago` : `il y a ${d} j`;
}

export function DashboardDelaysPanel({ items, totalPending }: Props) {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();

  return (
    <div className="flex w-full max-h-[35vh] mt-2 shrink-0 flex-col overflow-hidden border-b border-[#FFF9EC] bg-[#F0EDE0] md:mt-0 md:max-h-none md:w-[280px] md:border-b-0 md:border-l dark:border-[#1A2A14] dark:bg-[#182214]">
      {/* Header */}
      <div className="border-b border-[#FFF9EC] px-4 py-3.5 dark:border-[#1A2A14]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-[14px] font-black text-[#001201] dark:text-[#FFF9EC]">
              {t('delays_title')}
            </div>
            {totalPending > 0 && (
              <span className="rounded-full bg-[#EF4444] px-2 py-0.5 text-[10px] font-black leading-tight text-white">
                {totalPending}
              </span>
            )}
          </div>
          <Link
            href={`/${locale}/station/delays`}
            className="text-[11px] font-bold text-[#DDAF3B] transition-colors hover:text-[#DDAF3B]"
          >
            {t('delays_see_all')} →
          </Link>
        </div>
        <div className="mt-0.5 text-[12px] text-foreground/65 dark:text-[#B0BFB1]">
          {totalPending > 0 ? t('delays_pending', { n: totalPending }) : t('delays_empty')}
        </div>
      </div>

      {/* List */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#BBBBAA"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p className="text-[12px] text-foreground/55 dark:text-[#B0BFB1]">{t('delays_empty')}</p>
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={`/${locale}/station/delays`}
              className="group flex flex-col gap-1 rounded-xl border border-[#FFF9EC] bg-white p-3 transition-all duration-150 hover:border-[#DDAF3B]/40 hover:shadow-sm dark:border-[#1A2A14] dark:bg-dark-bg"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] font-bold text-[#001201] dark:text-[#FFF9EC]">
                  {item.clientName}
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-foreground/55 dark:text-[#B0BFB1]">
                  {timeAgo(item.requestedAt, locale)}
                </span>
              </div>
              <p className="line-clamp-2 text-[11px] leading-snug text-foreground/65 dark:text-[#B0BFB1]">
                {item.message || t('delays_no_message')}
              </p>
              <div className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-[#EF4444]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#EF4444]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" aria-hidden="true" />
                {t('delays_status_pending')}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

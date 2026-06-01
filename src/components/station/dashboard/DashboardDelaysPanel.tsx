'use client';

import { useState } from 'react';
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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mt-2 shrink-0 overflow-hidden border-t border-separator dark:border-[#1A2A14]">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? t('delays_expand') : t('delays_collapse')}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-foreground/45 transition-colors hover:text-foreground/75"
            >
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : 'rotate-0'}`}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
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
        {!collapsed && (
          <div className="mt-0.5 text-[12px] text-foreground/65 dark:text-[#B0BFB1]">
            {totalPending > 0 ? t('delays_pending', { n: totalPending }) : t('delays_empty')}
          </div>
        )}
      </div>

      {/* Collapsible list */}
      <div className={`overflow-hidden transition-[max-height] duration-200 ease-in-out ${collapsed ? 'max-h-0' : 'max-h-[600px]'}`}>
      <div className="flex flex-col gap-2 overflow-y-auto px-2.5 pb-3">
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
              className="group flex flex-col gap-1 rounded-xl border border-separator/25 bg-card-surface p-3 transition-all duration-150 hover:border-[#DDAF3B]/40 hover:shadow-sm dark:border-[#1A2A14] dark:bg-dark-bg"
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
    </div>
  );
}

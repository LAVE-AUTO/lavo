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

  /* Collapsed: a compact, clearly-labelled re-open affordance — a full-width bar
   * on mobile, a slim labelled column on desktop. When delays are pending it
   * turns into a red alert (tinted background + count) so it reads as something
   * that needs attention and is obviously tappable to reopen. */
  if (collapsed) {
    const hasPending = totalPending > 0;
    return (
      <div className="mt-2 flex w-full shrink-0 border-b border-[#FFF9EC] bg-[#F0EDE0] md:mt-0 md:h-full md:w-14 md:flex-col md:border-b-0 md:border-l dark:border-[#1A2A14] dark:bg-[#182214]">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title={t('delays_expand')}
          aria-label={t('delays_expand')}
          aria-expanded={false}
          className={`group flex w-full items-center gap-2.5 px-4 py-2.5 cursor-pointer transition-colors md:h-full md:flex-col md:justify-start md:gap-3 md:px-0 md:py-3.5 ${
            hasPending
              ? 'bg-[#EF4444]/10 hover:bg-[#EF4444]/15'
              : 'hover:bg-[#FFF9EC] dark:hover:bg-[#1A2A14]'
          }`}
        >
          {/* Expand chevron — up on mobile (panel sits below), left on desktop (panel sits to the right). */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 transition-transform group-hover:scale-110 ${hasPending ? 'text-[#EF4444]' : 'text-foreground/55 dark:text-[#B0BFB1]'}`}>
            <polyline points="18 15 12 9 6 15" className="md:hidden" />
            <polyline points="15 18 9 12 15 6" className="hidden md:block" />
          </svg>

          {/* Bell icon conveys "notifications to handle". */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${hasPending ? 'text-[#EF4444]' : 'text-[#001201] dark:text-[#FFF9EC]'}`}>
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>

          {hasPending && (
            <span className="rounded-full bg-[#EF4444] px-2 py-0.5 text-[10px] font-black leading-tight text-white">
              {totalPending}
            </span>
          )}

          {/* Label: horizontal on mobile, vertical on the desktop side column. */}
          <span className={`text-[12px] font-black md:[writing-mode:vertical-rl] md:rotate-180 ${hasPending ? 'text-[#EF4444]' : 'text-[#001201] dark:text-[#FFF9EC]'}`}>
            {t('delays_title')}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-h-[35vh] mt-2 shrink-0 flex-col overflow-hidden border-b border-[#FFF9EC] bg-[#F0EDE0] md:mt-0 md:max-h-none md:w-[280px] md:border-b-0 md:border-l dark:border-[#1A2A14] dark:bg-[#182214]">
      {/* Header */}
      <div className="border-b border-[#FFF9EC] px-4 py-3.5 dark:border-[#1A2A14]">
        <div className="flex items-center justify-between gap-2">
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
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/station/delays`}
              className="text-[11px] font-bold text-[#DDAF3B] transition-colors hover:text-[#DDAF3B]"
            >
              {t('delays_see_all')} →
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title={t('delays_collapse')}
              aria-label={t('delays_collapse')}
              aria-expanded
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-foreground/55 transition-colors hover:bg-[#FFF9EC] hover:text-[#001201] cursor-pointer dark:hover:bg-[#1A2A14] dark:hover:text-[#FFF9EC]"
            >
              {/* Collapse chevron: down on mobile, right on desktop. */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" className="md:hidden" />
                <polyline points="9 18 15 12 9 6" className="hidden md:block" />
              </svg>
            </button>
          </div>
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

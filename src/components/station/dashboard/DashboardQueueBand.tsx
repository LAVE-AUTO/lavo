'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import type { QueueEntry } from './QueueCard';
import { ACTIVE_QUEUE_STATUSES } from './StationDashboard';

interface Props {
  entries: QueueEntry[];
  onStartEntry: (id: string) => void;
  onCompleteEntry: (id: string) => void;
  onOpenManualAdd: () => void;
}

export function DashboardQueueBand({ entries, onStartEntry, onCompleteEntry, onOpenManualAdd }: Props) {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();
  const [collapsed, setCollapsed] = useState(false);

  const inProgress = entries.filter((e) => e.status === 'in_progress');
  const waiting = entries.filter(
    (e) => e.status && (ACTIVE_QUEUE_STATUSES as readonly string[]).includes(e.status),
  );
  const canCallNext = waiting.length > 0;
  const totalWaiting = waiting.length;
  const headOfQueueId = waiting[0]?.id ?? null;

  return (
    <section className="flex-shrink-0 border-t border-separator dark:border-[#1A2A14]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
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
            <h2 className="text-[14px] font-black text-[#001201] dark:text-[#FFF9EC]">
              {t('queue_band_title')}
            </h2>
            <span className="rounded-full bg-[#DDAF3B] px-2 py-0.5 text-[10px] font-black leading-tight text-[#001201]">
              {totalWaiting}
            </span>
          </div>
          {!collapsed && (
            <div className="mt-0.5 text-[11px] font-semibold text-foreground/65 dark:text-[#B0BFB1]">
              {totalWaiting === 0 ? t('queue_empty') : t('queue_waiting', { n: totalWaiting })}
            </div>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            href={`/${locale}/station/queue`}
            className="text-[11px] font-bold text-[#DDAF3B] hover:text-[#DDAF3B] transition-colors"
          >
            {t('queue_see_all')} →
          </Link>
          <button
            type="button"
            onClick={onOpenManualAdd}
            className="inline-flex items-center gap-1 rounded-lg border border-[#DDAF3B]/40 bg-[#DDAF3B]/10 px-3 py-1.5 text-[12px] font-bold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/15"
          >
            <PlusIcon />
            {t('queue_manual_add')}
          </button>
        </div>
      </div>

      {/* Collapsible body */}
      <div className={`overflow-hidden transition-[max-height] duration-200 ease-in-out ${collapsed ? 'max-h-0' : 'max-h-56'}`}>
      <div className="flex gap-2.5 overflow-x-auto px-5 pb-4 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#D8D4C4] dark:[&::-webkit-scrollbar-thumb]:bg-[#1A2A14]">
        {/* Call next button as the first card — starts head of queue */}
        <button
          type="button"
          onClick={() => { if (headOfQueueId) onStartEntry(headOfQueueId); }}
          disabled={!canCallNext}
          className="flex h-[140px] w-[130px] flex-shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#DDAF3B] text-[#001201] font-black transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlayIcon />
          <span className="text-center text-[11px] px-2 leading-tight">{t('btn_call_next')}</span>
        </button>

        {/* In-progress entries first */}
        {inProgress.map((entry, idx) => (
          <QueueBandCard
            key={entry.id}
            entry={entry}
            position={null}
            isNext={false}
            onPrimary={() => onCompleteEntry(entry.id)}
            primaryLabel={t('queue_complete_now')}
            primaryColor="#2ECC71"
            delay={idx * 50}
            statusLabelKey="queue_in_progress_badge"
          />
        ))}

        {/* Waiting entries */}
        {waiting.map((entry, idx) => (
          <QueueBandCard
            key={entry.id}
            entry={entry}
            position={entry.position}
            isNext={idx === 0 && inProgress.length === 0}
            onPrimary={() => onStartEntry(entry.id)}
            primaryLabel={t('queue_start_service')}
            primaryColor="#1E40AF"
            delay={(inProgress.length + idx) * 50}
          />
        ))}

        {entries.length === 0 && (
          <div className="flex h-[140px] flex-1 min-w-[160px] items-center justify-center rounded-2xl border border-dashed border-[#D8D4C4] px-4 text-center text-[12px] text-foreground/55 dark:border-[#001A05] dark:text-[#B0BFB1]">
            {t('queue_empty')}
          </div>
        )}
      </div>
      </div>
    </section>
  );
}

interface CardProps {
  entry: QueueEntry;
  position: number | null;
  isNext: boolean;
  onPrimary: () => void;
  primaryLabel: string;
  primaryColor: string;
  delay: number;
  statusLabelKey?: string;
}

function QueueBandCard({ entry, position, isNext, onPrimary, primaryLabel, primaryColor, delay, statusLabelKey }: CardProps) {
  const t = useTranslations('station_dashboard');
  const isReservation = entry.entryType === 'reservation';
  const tagLabel = isReservation ? t('queue_tag_reserved') : t('queue_tag_app');
  const tagBg = isReservation ? '#2ECC71' : '#1E40AF';

  return (
    <div
      className={`group flex h-[140px] w-[170px] animate-fade-in-up flex-shrink-0 flex-col rounded-2xl border border-separator/25 bg-card-surface p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-[#182214] ${
        isNext
          ? 'border-[#DDAF3B] ring-1 ring-[#DDAF3B]/30'
          : 'border-[#FFF9EC] dark:border-[#1A2A14]'
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-1">
        {isNext ? (
          <span className="rounded-md bg-[#DDAF3B] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#001201]">
            {t('queue_next_short')}
          </span>
        ) : position !== null ? (
          <span className="text-[14px] font-black tabular-nums text-[#001201] dark:text-[#FFF9EC]">
            #{position}
          </span>
        ) : (
          <span className="rounded-md bg-[#2ECC71]/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-[#0E8C45] dark:text-[#65E69A]">
            {statusLabelKey ? t(statusLabelKey) : ''}
          </span>
        )}
        <span
          className="rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase text-white"
          style={{ background: tagBg }}
        >
          {tagLabel}
        </span>
      </div>

      <div className="mt-1.5 text-[11px] font-semibold text-foreground/65 dark:text-[#B0BFB1]">
        {entry.serviceLabel ?? '—'}
        {entry.price !== undefined ? ` · ${entry.price}$` : ''}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-black text-[#001201] dark:text-[#FFF9EC]">
        {entry.clientName}
      </div>

      <button
        type="button"
        onClick={onPrimary}
        className="mt-auto inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-black text-white transition-opacity hover:opacity-90"
        style={{ background: primaryColor }}
      >
        {primaryLabel}
      </button>
    </div>
  );
}

const PlayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <line x1="6" y1="2" x2="6" y2="10" />
    <line x1="2" y1="6" x2="10" y2="6" />
  </svg>
);

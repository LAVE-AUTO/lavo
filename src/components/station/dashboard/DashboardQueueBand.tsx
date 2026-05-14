'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import type { QueueEntry } from './QueueCard';
import { ACTIVE_QUEUE_STATUSES } from './StationDashboard';

interface Props {
  entries: QueueEntry[];
  onCallNext: () => void;
  onCallEntry: (id: string) => void;
  onCompleteEntry: (id: string) => void;
  onOpenManualAdd: () => void;
}

export function DashboardQueueBand({ entries, onCallNext, onCallEntry, onCompleteEntry, onOpenManualAdd }: Props) {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();

  const inProgress = entries.filter((e) => e.status === 'in_progress');
  const waiting = entries.filter(
    (e) => e.status && (ACTIVE_QUEUE_STATUSES as readonly string[]).includes(e.status),
  );
  const canCallNext = waiting.length > 0;
  const totalWaiting = waiting.length;

  return (
    <section className="flex-shrink-0 border-t border-[#E0DCD0] bg-[#F7F6F2] dark:border-[#1A2A14] dark:bg-[#111A0E]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-5 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
              {t('queue_band_title')}
            </h2>
            <span className="rounded-full bg-[#C49A1E] px-2 py-0.5 text-[10px] font-black leading-tight text-[#0C1209]">
              {totalWaiting}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-[#666] dark:text-[#A0A090]">
            {totalWaiting === 0 ? t('queue_empty') : t('queue_waiting', { n: totalWaiting })}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            href={`/${locale}/station/queue`}
            className="text-[11px] font-bold text-[#C49A1E] hover:text-[#D4A820] transition-colors"
          >
            {t('queue_see_all')} →
          </Link>
          <button
            type="button"
            onClick={onOpenManualAdd}
            className="inline-flex items-center gap-1 rounded-lg border border-[#C49A1E]/40 bg-[#C49A1E]/10 px-3 py-1.5 text-[12px] font-bold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/15"
          >
            <PlusIcon />
            {t('queue_manual_add')}
          </button>
        </div>
      </div>

      {/* Horizontal scroll */}
      <div className="mt-3 flex gap-2.5 overflow-x-auto px-5 pb-4 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#D8D4C4] dark:[&::-webkit-scrollbar-thumb]:bg-[#1A2A14]">
        {/* Call next button as the first card */}
        <button
          type="button"
          onClick={onCallNext}
          disabled={!canCallNext}
          className="flex h-[140px] w-[130px] flex-shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#C49A1E] text-[#0C1209] font-black transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlayIcon />
          <span className="text-center text-[12px] leading-tight">{t('btn_call_next')}</span>
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
            onPrimary={() => onCallEntry(entry.id)}
            primaryLabel={t('queue_call_now')}
            primaryColor="#C49A1E"
            delay={(inProgress.length + idx) * 50}
          />
        ))}

        {entries.length === 0 && (
          <div className="flex h-[140px] flex-1 min-w-[160px] items-center justify-center rounded-2xl border border-dashed border-[#D8D4C4] px-4 text-center text-[12px] text-[#888] dark:border-[#243020] dark:text-[#A0A090]">
            {t('queue_empty')}
          </div>
        )}
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
  const tagBg = isReservation ? '#2ECC71' : '#3B82F6';

  return (
    <div
      className={`group flex h-[140px] w-[170px] animate-fade-in-up flex-shrink-0 flex-col rounded-2xl border bg-white p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-[#182214] ${
        isNext
          ? 'border-[#C49A1E] ring-1 ring-[#C49A1E]/30'
          : 'border-[#E8E4DC] dark:border-[#1A2A14]'
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-1">
        {isNext ? (
          <span className="rounded-md bg-[#C49A1E] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#0C1209]">
            {t('queue_next_short')}
          </span>
        ) : position !== null ? (
          <span className="text-[14px] font-black tabular-nums text-[#1A1A0A] dark:text-[#F0EDD4]">
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

      <div className="mt-1.5 text-[11px] font-semibold text-[#666] dark:text-[#A0A090]">
        {entry.serviceLabel ?? '—'}
        {entry.price !== undefined ? ` · ${entry.price}$` : ''}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
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

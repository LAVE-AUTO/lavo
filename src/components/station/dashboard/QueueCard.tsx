'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface QueueEntry {
  id: string;
  position: number;
  clientName: string;
  entryType: 'reservation' | 'queue';
  time?: string;
  serviceLabel?: string;
  price?: number;
  postLabel?: string;
  marginMin?: number;
  marginMax?: number;
  isNext: boolean;
}

interface QueueCardProps {
  entry: QueueEntry;
  onCall: (id: string) => void;
}

export function QueueCard({ entry, onCall }: QueueCardProps) {
  const t = useTranslations('station_dashboard');
  const [expanded, setExpanded] = useState(false);

  const isReservation = entry.entryType === 'reservation';
  const tagLabel = isReservation ? t('queue_tag_reserved') : t('queue_tag_app');
  const tagBg = isReservation ? '#2ECC71' : '#3B82F6';

  if (entry.isNext) {
    return (
      <div className="overflow-hidden rounded-xl border-2 border-[#C49A1E] bg-white shadow-md dark:bg-[#182214]">
        <div className="h-1 bg-[#C49A1E]" />

        <div className="px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#EF4444]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#EF4444]" />
              </span>
              {t('queue_next')}
            </div>
            <span className="rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white" style={{ background: tagBg }}>
              {tagLabel}
            </span>
          </div>

          <div className="mb-1 text-[15px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
            {entry.clientName}
          </div>
          {(entry.time || entry.serviceLabel) && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-[#666] dark:text-[#8A8A7A]">
              {entry.time && (
                <span className="flex items-center gap-1 font-mono font-semibold">
                  <ClockMini />
                  {entry.time}
                </span>
              )}
              {entry.serviceLabel && <span>{entry.serviceLabel}</span>}
              {entry.price !== undefined && (
                <span className="font-mono font-bold text-[#C49A1E]">{entry.price}$</span>
              )}
            </div>
          )}

          {entry.marginMin !== undefined && entry.marginMax !== undefined && (
            <div className="mb-3 flex items-center gap-2 text-[10px] text-[#666] dark:text-[#8A8A7A]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#00C851]" />
              <span>{t('queue_margin')}</span>
              <span className="font-bold text-[#00C851]">
                {t('queue_on_time')} ({entry.marginMin}/{entry.marginMax} min)
              </span>
              <div className="flex-1 overflow-hidden rounded-full bg-[#E8E4DC] dark:bg-[#243020]" style={{ height: 4 }}>
                <div className="rounded-full bg-[#00C851]" style={{ height: 4, width: `${(entry.marginMin / entry.marginMax) * 100}%` }} />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onCall(entry.id)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C49A1E] py-2.5 text-[13px] font-black text-[#0C1209] shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <PlayTriangle />
            {t('queue_call_now')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E8E4DC] bg-white transition-all hover:shadow-sm dark:border-[#1A2A14] dark:bg-[#111A0E]">
      {/* Clickable row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 py-2.5 pl-4 pr-3 text-left"
      >
        {/* Position */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F7F6F2] dark:bg-[#0F1A0C]">
          <span className="font-mono text-[13px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
            {entry.position}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
              {entry.clientName}
            </span>
            <span className="shrink-0 rounded-full px-2 py-[2px] text-[8px] font-bold uppercase tracking-wide text-white" style={{ background: tagBg }}>
              {tagLabel}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#888] dark:text-[#6A6A5A]">
            {entry.time && <span className="font-mono font-semibold">{entry.time}</span>}
            {entry.serviceLabel && <span>{entry.serviceLabel}</span>}
            {entry.price !== undefined && (
              <span className="font-mono font-semibold text-[#C49A1E]">{entry.price}$</span>
            )}
          </div>
        </div>

        <ChevronIcon expanded={expanded} />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[#F0EDE4] px-4 pb-3 pt-2.5 dark:border-[#1A2A14]">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            {entry.time && <DetailRow label="Heure" value={entry.time} />}
            {entry.serviceLabel && <DetailRow label="Service" value={entry.serviceLabel} />}
            {entry.price !== undefined && <DetailRow label="Prix" value={`${entry.price}$`} gold />}
            {entry.postLabel && <DetailRow label="Poste" value={entry.postLabel} />}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[#888] dark:text-[#6A6A5A]">{label}</span>
      <span className={`text-right font-semibold ${gold ? 'text-[#C49A1E]' : 'text-[#1A1A0A] dark:text-[#F0EDD4]'}`}>
        {value}
      </span>
    </div>
  );
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className={`shrink-0 text-[#BBB] transition-transform dark:text-[#555] ${expanded ? 'rotate-180' : ''}`}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ClockMini = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const PlayTriangle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

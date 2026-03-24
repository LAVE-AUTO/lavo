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
  onPick?: (id: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** Override CTA button label (default: queue_call_now) */
  callLabel?: string;
  /** Override header badge label (default: queue_next) */
  badgeLabel?: string;
}

export function QueueCard({ entry, onCall, onPick, onMoveUp, onMoveDown, callLabel, badgeLabel }: QueueCardProps) {
  const t = useTranslations('station_dashboard');
  const [expanded, setExpanded] = useState(false);

  const isReservation = entry.entryType === 'reservation';
  const tagLabel = isReservation ? t('queue_tag_reserved') : t('queue_tag_app');
  const tagBg = isReservation ? '#00C851' : '#0044FF';

  if (entry.isNext) {
    return (
      <div className="overflow-hidden rounded-2xl border-2 border-[#C09A18] bg-[#C8C8B4] shadow-md dark:bg-[#1E2A1A]">
        {/* Gold top accent */}
        <div className="h-1 bg-[#C09A18]" />

        <div className="p-5">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#FF2525]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF2525] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FF2525]" />
              </span>
              {badgeLabel ?? t('queue_next')}
            </div>
            <span className="rounded-md px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white" style={{ background: tagBg }}>
              {tagLabel}
            </span>
          </div>

          {/* Client */}
          <div className="mb-1 text-[16px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">
            {entry.clientName}
          </div>
          {(entry.time || entry.serviceLabel) && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-[#000717]/60 dark:text-[#FFFFF0]/60">
              {entry.time && (
                <span className="flex items-center gap-1 font-mono font-semibold text-[#000C1F] dark:text-[#FFF8EC]">
                  <ClockMini />
                  {entry.time}
                </span>
              )}
              {entry.serviceLabel && <span>{entry.serviceLabel}</span>}
              {entry.price !== undefined && (
                <span className="font-mono font-bold text-[#C09A18]">{entry.price}$</span>
              )}
            </div>
          )}

          {/* Margin progress bar */}
          {entry.marginMin !== undefined && entry.marginMax !== undefined && entry.marginMax > 0 && (
            <div className="mb-4 flex items-center gap-2 text-[10px] text-[#000717]/60 dark:text-[#FFFFF0]/60">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#00C851]" />
              <span>{t('queue_margin')}</span>
              <span className="font-bold text-[#00C851]">
                {t('queue_on_time')} ({entry.marginMin}/{entry.marginMax} min)
              </span>
              <div className="flex-1 overflow-hidden rounded-full bg-[#B8B8A4] dark:bg-[#3A4A36]" style={{ height: 4 }}>
                <div className="rounded-full bg-[#00C851]" style={{ height: 4, width: `${(entry.marginMin / entry.marginMax) * 100}%` }} />
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={() => onCall(entry.id)}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#C09A18] py-3 text-[13px] font-bold text-[#1A2116] transition-all hover:bg-[#D4A820] active:scale-[0.98]"
          >
            <PlayTriangle />
            {callLabel ?? t('queue_call_now')}
          </button>
        </div>
      </div>
    );
  }

  /* Regular queue entry */
  return (
    <div className="overflow-hidden rounded-2xl bg-[#C8C8B4] transition-shadow hover:shadow-sm dark:bg-[#1E2A1A]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        {/* Position badge */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/60 dark:bg-[#243020]">
          <span className="font-mono text-[14px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">
            {entry.position}
          </span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-[#000C1F] dark:text-[#FFF8EC]">
              {entry.clientName}
            </span>
            <span className="shrink-0 rounded-md px-2 py-[2px] text-[8px] font-bold uppercase tracking-wide text-white" style={{ background: tagBg }}>
              {tagLabel}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#000717]/50 dark:text-[#FFFFF0]/50">
            {entry.time && <span className="font-mono font-semibold text-[#000C1F] dark:text-[#FFF8EC]">{entry.time}</span>}
            {entry.serviceLabel && <span>{entry.serviceLabel}</span>}
            {entry.price !== undefined && (
              <span className="font-mono font-semibold text-[#C09A18]">{entry.price}$</span>
            )}
          </div>
        </div>

        <ChevronIcon expanded={expanded} />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[#B8B8A4] px-4 pb-3.5 pt-3 dark:border-[#3A4A36]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              {entry.time && <DetailRow label={t('queue_detail_time')} value={entry.time} />}
              {entry.serviceLabel && <DetailRow label={t('queue_detail_service')} value={entry.serviceLabel} />}
              {entry.price !== undefined && <DetailRow label={t('queue_detail_price')} value={`${entry.price}$`} gold />}
              {entry.postLabel && <DetailRow label={t('queue_detail_post')} value={entry.postLabel} />}
            </div>

            {/* Position reorder + pick actions */}
            {(onMoveUp || onMoveDown || onPick) && (
              <div className="mt-3 flex items-center gap-2">
                {(onMoveUp || onMoveDown) && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={!onMoveUp}
                      onClick={onMoveUp}
                      title={t('queue_move_up')}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#B8B8A4] text-[#000717]/50 transition-colors hover:border-[#C09A18] hover:text-[#C09A18] disabled:opacity-30 disabled:cursor-not-allowed dark:border-[#3A4A36] dark:text-[#FFFFF0]/50"
                    >
                      <ArrowUpIcon />
                    </button>
                    <button
                      type="button"
                      disabled={!onMoveDown}
                      onClick={onMoveDown}
                      title={t('queue_move_down')}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#B8B8A4] text-[#000717]/50 transition-colors hover:border-[#C09A18] hover:text-[#C09A18] disabled:opacity-30 disabled:cursor-not-allowed dark:border-[#3A4A36] dark:text-[#FFFFF0]/50"
                    >
                      <ArrowDownIcon />
                    </button>
                  </div>
                )}
                {onPick && (
                  <button
                    type="button"
                    onClick={() => onPick(entry.id)}
                    className="rounded-lg bg-[#C09A18] px-3 py-1.5 text-[11px] font-bold text-[#1A2116] transition-opacity hover:opacity-80"
                  >
                    {t('queue_pick_now')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[#000717]/50 dark:text-[#FFFFF0]/50">{label}</span>
      <span className={`text-right font-semibold ${gold ? 'text-[#C09A18]' : 'text-[#000C1F] dark:text-[#FFF8EC]'}`}>
        {value}
      </span>
    </div>
  );
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className={`shrink-0 text-[#000C1F]/25 transition-transform duration-200 dark:text-[#FFF8EC]/25 ${expanded ? 'rotate-180' : ''}`}
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

const ArrowUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

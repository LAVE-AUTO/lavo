'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReservationEntry, EntryStatus } from './types';

interface Props {
  entry: ReservationEntry;
  onValidate: (id: string) => void;
  onStart: (id: string) => void;
  onCancel: (id: string) => void;
}

interface StatusDef {
  i18nKey: string;
  bg: string;
  text: string;
}

/* Status badges: solid bg + white text per graphic charter section 5.3 */
const STATUS_MAP: Record<string, StatusDef> = {
  pending_payment: { i18nKey: 'status_pending_payment', bg: '#888888', text: '#FFFFFF' },
  pending:         { i18nKey: 'status_pending',         bg: '#FF8800', text: '#FFFFFF' },
  confirmed:       { i18nKey: 'status_confirmed',       bg: '#0044FF', text: '#FFFFFF' },
  in_progress:     { i18nKey: 'status_in_progress',     bg: '#00C851', text: '#FFFFFF' },
  completed:       { i18nKey: 'status_completed',       bg: '#0044FF', text: '#FFFFFF' },
  cancelled:       { i18nKey: 'status_cancelled',       bg: '#FF2525', text: '#FFFFFF' },
  late:            { i18nKey: 'status_late',             bg: '#FF8800', text: '#FFFFFF' },
};

/* Left accent uses same color as badge bg */
const ACCENT_MAP: Record<string, string> = {
  pending_payment: '#888888', pending: '#FF8800', confirmed: '#0044FF',
  in_progress: '#00C851', completed: '#0044FF', cancelled: '#FF2525', late: '#FF8800',
};

function canDoStart(s: EntryStatus) { return s === 'confirmed' || s === 'pending'; }
function canDoValidate(s: EntryStatus) { return s === 'in_progress'; }
function canDoCancel(s: EntryStatus) { return s === 'confirmed' || s === 'pending' || s === 'late'; }

export function ReservationCard({ entry, onValidate, onStart, onCancel }: Props) {
  const t = useTranslations('station_reservations');
  const [expanded, setExpanded] = useState(false);

  const st = STATUS_MAP[entry.status] ?? STATUS_MAP.pending;
  const accent = ACCENT_MAP[entry.status] ?? '#888888';
  const clientLabel = `${t('client_label')} #${entry.user_id.slice(0, 8)}`;
  const time = new Date(entry.created_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  const isReservation = entry.entry_type === 'reservation';
  const hasActions = canDoStart(entry.status) || canDoValidate(entry.status) || canDoCancel(entry.status);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#C8C8B4] transition-shadow hover:shadow-md dark:bg-[#1E2A1A]">
      {/* Left accent bar */}
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />

      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-4 pl-5 text-left"
      >
        {/* Time block */}
        <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-white/60 dark:bg-[#243020]">
          <span className="font-mono text-[13px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{time}</span>
        </div>

        {/* Client + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-[#000C1F] dark:text-[#FFF8EC]">
              {clientLabel}
            </span>
            <span className={`shrink-0 rounded px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide ${
              isReservation
                ? 'bg-[#0044FF]/15 text-[#0044FF] dark:bg-[#0044FF]/25 dark:text-[#7CC4F8]'
                : 'bg-[#FF8800]/15 text-[#FF8800] dark:bg-[#FF8800]/25 dark:text-[#FFB84D]'
            }`}>
              {isReservation ? t('type_reservation') : t('type_queue')}
            </span>
          </div>
          {entry.amount_paid && (
            <span className="mt-0.5 block font-mono text-[12px] font-bold text-[#C09A18]">
              {parseFloat(entry.amount_paid).toFixed(2)}$
            </span>
          )}
        </div>

        {/* Status badge — solid bg, white text */}
        <span
          className="shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold"
          style={{ background: st.bg, color: st.text }}
        >
          {t(st.i18nKey)}
        </span>

        <ChevronIcon expanded={expanded} />
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-[#B8B8A4] px-5 pb-4 pt-3 dark:border-[#3A4A36]">
          <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
            <DetailRow label={t('detail_entry_type')} value={isReservation ? t('type_reservation') : t('type_queue')} />
            <DetailRow label={t('detail_entry_id')} value={`#${entry.id.slice(0, 8)}`} mono />
            <DetailRow label={t('detail_created_at')} value={formatTime(entry.created_at)} />
            <DetailRow label={t('detail_updated_at')} value={formatTime(entry.updated_at)} />
            {entry.time_slot_id && (
              <DetailRow label={t('detail_slot')} value={`#${entry.time_slot_id.slice(0, 8)}`} mono />
            )}
            {!entry.time_slot_id && entry.entry_type === 'queue' && (
              <DetailRow label={t('detail_slot')} value={t('detail_no_slot')} muted />
            )}
            {entry.queue_position && (
              <DetailRow label={t('detail_queue_position')} value={`#${entry.queue_position}`} />
            )}
            {entry.completed_at && (
              <DetailRow label={t('detail_completed_at')} value={formatTime(entry.completed_at)} />
            )}
            {entry.amount_paid && (
              <DetailRow label={t('amount_label')} value={`${parseFloat(entry.amount_paid).toFixed(2)}$`} gold />
            )}
          </div>

          {hasActions && (
            <div className="flex flex-wrap items-center gap-2">
              {canDoValidate(entry.status) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onValidate(entry.id); }}
                  className="flex items-center gap-1.5 rounded-[10px] bg-[#00C851] px-4 py-2 text-[12px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  <CheckIcon />
                  {t('btn_validate')}
                </button>
              )}
              {canDoStart(entry.status) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onStart(entry.id); }}
                  className="flex items-center gap-1.5 rounded-[10px] bg-[#C09A18] px-4 py-2 text-[12px] font-bold text-[#1A2116] transition-all hover:bg-[#D4A820] active:scale-[0.98]"
                >
                  <PlayIcon />
                  {t('btn_start_service')}
                </button>
              )}
              {canDoCancel(entry.status) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onCancel(entry.id); }}
                  className="flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-[#FF2525]/30 px-3 py-2 text-[12px] font-semibold text-[#FF2525] transition-all hover:bg-[#FF2525]/10 active:scale-[0.98]"
                >
                  <CancelIcon />
                  {t('btn_cancel_entry')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
}

function DetailRow({ label, value, mono, gold, muted }: { label: string; value: string; mono?: boolean; gold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[#000717]/60 dark:text-[#FFFFF0]/50">{label}</span>
      <span className={`text-right font-semibold ${
        gold ? 'text-[#C09A18]' :
        muted ? 'text-[#000717]/40 dark:text-[#FFFFF0]/30' :
        'text-[#000C1F] dark:text-[#FFF8EC]'
      } ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className={`shrink-0 text-[#000C1F]/30 transition-transform dark:text-[#FFF8EC]/30 ${expanded ? 'rotate-180' : ''}`}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const CancelIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

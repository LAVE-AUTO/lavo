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
  color: string;
  bg: string;
  accent: string;
}

const STATUS_MAP: Record<string, StatusDef> = {
  pending_payment: { i18nKey: 'status_pending_payment', color: '#888',    bg: 'rgba(136,136,136,0.08)',  accent: '#888' },
  pending:         { i18nKey: 'status_pending',         color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',   accent: '#F59E0B' },
  confirmed:       { i18nKey: 'status_confirmed',       color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',   accent: '#3B82F6' },
  in_progress:     { i18nKey: 'status_in_progress',     color: '#00C851', bg: 'rgba(0,200,81,0.08)',     accent: '#00C851' },
  completed:       { i18nKey: 'status_completed',       color: '#6366F1', bg: 'rgba(99,102,241,0.08)',   accent: '#6366F1' },
  cancelled:       { i18nKey: 'status_cancelled',       color: '#EF4444', bg: 'rgba(239,68,68,0.08)',    accent: '#EF4444' },
  late:            { i18nKey: 'status_late',             color: '#FF8800', bg: 'rgba(255,136,0,0.08)',    accent: '#FF8800' },
};

function canDoStart(s: EntryStatus) { return s === 'confirmed' || s === 'pending'; }
function canDoValidate(s: EntryStatus) { return s === 'in_progress'; }
function canDoCancel(s: EntryStatus) { return s === 'confirmed' || s === 'pending' || s === 'late'; }

export function ReservationCard({ entry, onValidate, onStart, onCancel }: Props) {
  const t = useTranslations('station_reservations');
  const [expanded, setExpanded] = useState(false);

  const st = STATUS_MAP[entry.status] ?? STATUS_MAP.pending;
  const clientLabel = `${t('client_label')} #${entry.user_id.slice(0, 8)}`;
  const time = new Date(entry.created_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  const isReservation = entry.entry_type === 'reservation';
  const hasActions = canDoStart(entry.status) || canDoValidate(entry.status) || canDoCancel(entry.status);

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#E8E4DC] bg-white transition-all hover:shadow-md dark:border-[#1A2A14] dark:bg-[#111A0E]">
      {/* Left accent bar */}
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: st.accent }} />

      {/* Clickable header row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 py-3 pl-5 pr-4 text-left"
      >
        {/* Time pill */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F7F6F2] dark:bg-[#0F1A0C]">
          <span className="font-mono text-[11px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{time}</span>
        </div>

        {/* Client + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
              {clientLabel}
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-[2px] text-[9px] font-bold uppercase tracking-wide"
              style={{ background: isReservation ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)', color: isReservation ? '#3B82F6' : '#F59E0B' }}
            >
              {isReservation ? t('type_reservation') : t('type_queue')}
            </span>
          </div>
          {entry.amount_paid && (
            <span className="mt-0.5 block font-mono text-[11px] font-semibold text-[#C49A1E]">
              {parseFloat(entry.amount_paid).toFixed(2)}$
            </span>
          )}
        </div>

        {/* Status badge */}
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{ background: st.bg, color: st.color }}
        >
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
          {t(st.i18nKey)}
        </span>

        {/* Chevron */}
        <ChevronIcon expanded={expanded} />
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-[#F0EDE4] px-5 pb-3.5 pt-3 dark:border-[#1A2A14]">
          {/* Detail grid */}
          <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
            <DetailRow label={t('detail_entry_type')} value={isReservation ? t('type_reservation') : t('type_queue')} />
            <DetailRow label={t('detail_entry_id')} value={`#${entry.id.slice(0, 8)}`} mono />
            <DetailRow label={t('detail_created_at')} value={formatDateTime(entry.created_at)} />
            <DetailRow label={t('detail_updated_at')} value={formatDateTime(entry.updated_at)} />
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
              <DetailRow label={t('detail_completed_at')} value={formatDateTime(entry.completed_at)} />
            )}
            {entry.amount_paid && (
              <DetailRow label={t('amount_label')} value={`${parseFloat(entry.amount_paid).toFixed(2)}$`} gold />
            )}
          </div>

          {/* Actions */}
          {hasActions && (
            <div className="flex items-center gap-2">
              {canDoValidate(entry.status) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onValidate(entry.id); }}
                  className="flex items-center gap-1.5 rounded-lg bg-[#00C851] px-3.5 py-2 text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#00B347] active:scale-[0.97]"
                >
                  <CheckIcon />
                  {t('btn_validate')}
                </button>
              )}
              {canDoStart(entry.status) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onStart(entry.id); }}
                  className="flex items-center gap-1.5 rounded-lg bg-[#C49A1E] px-3.5 py-2 text-[12px] font-bold text-[#0C1209] shadow-sm transition-all hover:opacity-90 active:scale-[0.97]"
                >
                  <PlayIcon />
                  {t('btn_start_service')}
                </button>
              )}
              {canDoCancel(entry.status) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onCancel(entry.id); }}
                  className="flex items-center gap-1.5 rounded-lg border border-[#EF4444]/20 px-3 py-2 text-[12px] font-semibold text-[#EF4444] transition-all hover:bg-[#EF4444]/5 active:scale-[0.97]"
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

/* Helpers */

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
}

function DetailRow({ label, value, mono, gold, muted }: { label: string; value: string; mono?: boolean; gold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[#888] dark:text-[#6A6A5A]">{label}</span>
      <span className={`text-right font-semibold ${
        gold ? 'text-[#C49A1E]' :
        muted ? 'text-[#BBB] dark:text-[#555]' :
        'text-[#1A1A0A] dark:text-[#F0EDD4]'
      } ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

/* Icons */

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className={`shrink-0 text-[#BBB] transition-transform dark:text-[#555] ${expanded ? 'rotate-180' : ''}`}
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

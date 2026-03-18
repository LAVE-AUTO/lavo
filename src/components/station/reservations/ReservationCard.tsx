'use client';

import { useTranslations } from 'next-intl';
import type { ReservationEntry } from './types';

interface Props {
  entry: ReservationEntry;
  onValidate: (id: string) => void;
  onStart: (id: string) => void;
  onCancel: (id: string) => void;
}

const STATUS_STYLE: Record<string, { i18nKey: string; color: string; bg: string }> = {
  pending_payment: { i18nKey: 'status_pending_payment', color: '#888', bg: 'rgba(136,136,136,0.12)' },
  pending:         { i18nKey: 'status_pending',         color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  confirmed:       { i18nKey: 'status_confirmed',       color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  in_progress:     { i18nKey: 'status_in_progress',     color: '#2ECC71', bg: 'rgba(46,204,113,0.12)' },
  completed:       { i18nKey: 'status_completed',       color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  cancelled:       { i18nKey: 'status_cancelled',       color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  late:            { i18nKey: 'status_late',             color: '#FF8800', bg: 'rgba(255,136,0,0.12)' },
};

export function ReservationCard({ entry, onValidate, onStart, onCancel }: Props) {
  const t = useTranslations('station_reservations');

  const st = STATUS_STYLE[entry.status] ?? STATUS_STYLE.pending;
  const clientLabel = `${t('client_label')} #${entry.user_id.slice(0, 8)}`;
  const time = new Date(entry.created_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  const isReservation = entry.entry_type === 'reservation';

  const canStart = entry.status === 'confirmed' || entry.status === 'pending';
  const canValidate = entry.status === 'in_progress';
  const canCancel = entry.status === 'confirmed' || entry.status === 'pending' || entry.status === 'late';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#E0DCD0] bg-white p-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
      {/* Top row: client + badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
            {clientLabel}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[#888] dark:text-[#6A6A5A]">
            <span className="flex items-center gap-1">
              <ClockIcon />
              {time}
            </span>
            <span className="rounded-full bg-[#F0EDE4] px-2 py-0.5 text-[10px] font-semibold text-[#666] dark:bg-[#1A2A14] dark:text-[#8A8A7A]">
              {isReservation ? t('type_reservation') : t('type_queue')}
            </span>
            {entry.amount_paid && (
              <span className="font-semibold text-[#C49A1E]">
                {parseFloat(entry.amount_paid).toFixed(2)}$
              </span>
            )}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-3 py-1 text-[10px] font-bold"
          style={{ background: st.bg, color: st.color }}
        >
          {t(st.i18nKey)}
        </span>
      </div>

      {/* Action buttons */}
      {(canStart || canValidate || canCancel) && (
        <div className="flex gap-2">
          {canValidate && (
            <button
              type="button"
              onClick={() => onValidate(entry.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#2ECC71] px-3 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
            >
              <CheckIcon />
              {t('btn_validate')}
            </button>
          )}
          {canStart && (
            <button
              type="button"
              onClick={() => onStart(entry.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#C49A1E] px-3 py-2 text-[12px] font-bold text-[#0C1209] transition-opacity hover:opacity-90"
            >
              <PlayIcon />
              {t('btn_start_service')}
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => onCancel(entry.id)}
              className="flex items-center justify-center gap-1.5 rounded-[10px] border border-[#EF4444]/30 px-3 py-2 text-[12px] font-bold text-[#EF4444] transition-opacity hover:bg-[#EF4444]/5"
            >
              <CancelIcon />
              {t('btn_cancel_entry')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
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

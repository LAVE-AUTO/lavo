'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { StationHistoryEntry } from './types';

interface Props {
  entry: StationHistoryEntry;
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  completed: { bg: '#00C851', text: '#FFFFFF' },
  cancelled: { bg: '#FF2525', text: '#FFFFFF' },
  pending:   { bg: '#FF8800', text: '#FFFFFF' },
  in_progress: { bg: '#00C851', text: '#FFFFFF' },
  late:      { bg: '#FF8800', text: '#FFFFFF' },
};

const ACCENT: Record<string, string> = {
  completed: '#00C851', cancelled: '#FF2525', pending: '#FF8800',
  in_progress: '#00C851', late: '#FF8800',
};

export function HistoryCard({ entry }: Props) {
  const t = useTranslations('station_history');
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);

  const badge = STATUS_BADGE[entry.status] ?? STATUS_BADGE.pending;
  const accent = ACCENT[entry.status] ?? '#888888';
  const isReservation = entry.entry_type === 'reservation';

  const clientName = entry.client
    ? `${entry.client.first_name} ${entry.client.last_name}`
    : t('client_anonymous');

  const dateLabel = new Date(entry.date).toLocaleDateString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );

  const timeLabel = new Date(entry.date).toLocaleTimeString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { hour: '2-digit', minute: '2-digit' },
  );

  const statusKey = `status_${entry.status}` as const;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#C8C8B4] transition-shadow hover:shadow-md dark:bg-[#1E2A1A]">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />

      {/* Clickable row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-4 pl-5 text-left"
      >
        {/* Date block */}
        <div className="flex h-10 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-white/60 dark:bg-[#243020]">
          <span className="text-[10px] font-semibold text-[#000717]/50 dark:text-[#FFFFF0]/50">{dateLabel.split(' ')[1]?.toUpperCase()}</span>
          <span className="font-mono text-[14px] font-bold leading-none text-[#000C1F] dark:text-[#FFF8EC]">{new Date(entry.date).getDate()}</span>
        </div>

        {/* Client + service */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-[#000C1F] dark:text-[#FFF8EC]">
              {clientName}
            </span>
            <span className={`shrink-0 rounded px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide ${
              isReservation
                ? 'bg-[#0044FF]/15 text-[#0044FF] dark:bg-[#0044FF]/25 dark:text-[#7CC4F8]'
                : 'bg-[#FF8800]/15 text-[#FF8800] dark:bg-[#FF8800]/25 dark:text-[#FFB84D]'
            }`}>
              {isReservation ? t('type_reservation') : t('type_queue')}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#000717]/50 dark:text-[#FFFFF0]/50">
            <span className="font-mono font-semibold">{timeLabel}</span>
            {entry.vehicle_format_label && <span>{entry.vehicle_format_label}</span>}
          </div>
        </div>

        {/* Amount */}
        <span className="shrink-0 font-mono text-[14px] font-bold text-[#C09A18]">
          {parseFloat(entry.amount_paid).toFixed(2)}$
        </span>

        {/* Status */}
        <span
          className="shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold"
          style={{ background: badge.bg, color: badge.text }}
        >
          {t(statusKey)}
        </span>

        <ChevronIcon expanded={expanded} />
      </button>

      {/* Expandable detail */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[#B8B8A4] px-5 pb-4 pt-3 dark:border-[#3A4A36]">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-3">
              <DetailRow label={t('detail_entry_id')} value={`#${entry.id.slice(0, 8)}`} mono />
              <DetailRow label={t('col_date')} value={dateLabel} />
              <DetailRow label={t('col_type')} value={isReservation ? t('type_reservation') : t('type_queue')} />
              <DetailRow label={t('col_amount')} value={`${parseFloat(entry.amount_paid).toFixed(2)}$`} gold />
              {entry.station_payout && (
                <DetailRow label={t('col_payout')} value={`${parseFloat(entry.station_payout).toFixed(2)}$`} gold />
              )}
              {entry.commission_amount && (
                <DetailRow label={t('col_commission')} value={`${parseFloat(entry.commission_amount).toFixed(2)}$`} />
              )}
              <DetailRow label={t('detail_commission_rate')} value={`${(parseFloat(entry.commission_rate) * 100).toFixed(0)}%`} />
              {entry.tip_amount && parseFloat(entry.tip_amount) > 0 && (
                <DetailRow label={t('col_tip')} value={`${parseFloat(entry.tip_amount).toFixed(2)}$`} gold />
              )}
              {entry.penalty_amount && parseFloat(entry.penalty_amount) > 0 && (
                <DetailRow label={t('col_penalty')} value={`${parseFloat(entry.penalty_amount).toFixed(2)}$`} danger />
              )}
              {entry.vehicle_format_label && (
                <DetailRow label={t('col_service')} value={entry.vehicle_format_label} />
              )}
              {entry.reservation_ref && (
                <DetailRow label={t('col_ref')} value={`#${entry.reservation_ref.slice(0, 12)}`} mono />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, gold, danger }: { label: string; value: string; mono?: boolean; gold?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[#000717]/60 dark:text-[#FFFFF0]/50">{label}</span>
      <span className={`text-right font-semibold ${
        gold ? 'text-[#C09A18]' :
        danger ? 'text-[#FF2525]' :
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
    className={`shrink-0 text-[#000C1F]/30 transition-transform duration-200 dark:text-[#FFF8EC]/30 ${expanded ? 'rotate-180' : ''}`}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { StationHistoryEntry } from './types';

interface Props {
  entry: StationHistoryEntry;
}

/** Formats a decimal string amount as "12.34$" for the detail rows. */
function money(value: string): string {
  return `${(parseFloat(value) || 0).toFixed(2)}$`;
}

function displayAmount(entry: StationHistoryEntry): string {
  if (entry.status === 'completed') {
    const total = parseFloat(entry.client_total || '0');
    const fee = parseFloat(entry.platform_service_fee || '0');
    return money(String(Math.max(0, total - fee)));
  }
  return money(entry.station_service_total || entry.amount_paid || '0');
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  confirmed:   { bg: '#057960ff', text: '#FFFFFF' },
  completed:   { bg: '#00C851', text: '#FFFFFF' },
  cancelled:   { bg: '#FF2525', text: '#FFFFFF' },
  pending:     { bg: '#FF8800', text: '#FFFFFF' },
  in_progress: { bg: '#00C851', text: '#FFFFFF' },
  late:        { bg: '#ae024dff', text: '#FFFFFF' },
};

const ACCENT: Record<string, string> = {
  confirmed: '#057960ff',
  completed: '#00C851', cancelled: '#FF2525', pending: '#FF8800',
  in_progress: '#00C851', late: '#ae024dff',
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

  const dateObj = new Date(entry.date);
  const dayNum = dateObj.getDate();
  const monthShort = dateObj.toLocaleDateString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { month: 'short' },
  ).toUpperCase().replace('.', '');

  const dateLabel = dateObj.toLocaleDateString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );

  const timeLabel = dateObj.toLocaleTimeString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { hour: '2-digit', minute: '2-digit' },
  );

  /* Defensive lookup: any new status emitted by the backend that we
   * have not localised yet falls back to a generic 'Unknown status'
   * label so the whole history list never crashes on a missing key. */
  const KNOWN_STATUSES = new Set([
    'pending',
    'pending_payment',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'late',
    'no_show',
  ]);
  const statusKey = KNOWN_STATUSES.has(entry.status)
    ? (`status_${entry.status}` as const)
    : ('status_unknown' as const);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#C8C8B4] transition-shadow hover:shadow-md dark:bg-[#001A05]">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />

      {/* Clickable row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4 pl-5 text-left sm:gap-4"
      >
        {/* Date block */}
        <div className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-white/60 dark:bg-[#001A05]">
          <span className="text-[9px] font-bold tracking-wide text-[#000717]/40 dark:text-[#FFFFF0]/40">{monthShort}</span>
          <span className="font-mono text-[16px] font-bold leading-none text-foreground">{dayNum}</span>
        </div>

        {/* Client + service */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-foreground">
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
          <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[#000717]/50 dark:text-[#FFFFF0]/50">
            <span className="font-mono font-semibold">{timeLabel}</span>
            {(entry.service_name ?? entry.vehicle_format_label) && (
              <>
                <span className="text-[#000717]/20 dark:text-[#FFFFF0]/20">|</span>
                <span>{entry.service_name ?? entry.vehicle_format_label}</span>
              </>
            )}
          </div>
        </div>

        {/* Amount */}
        <span className="shrink-0 font-mono text-[15px] font-bold text-[#C09A18]">
          {displayAmount(entry)}
        </span>

        {/* Status */}
        <span
          className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold"
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
            {/* Info section */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
              <DetailRow label={t('detail_entry_id')} value={`#${entry.id.slice(0, 8)}`} mono />
              <DetailRow label={t('col_date')} value={dateLabel} />
              <DetailRow label={t('col_type')} value={isReservation ? t('type_reservation') : t('type_queue')} />
              {(entry.service_name ?? entry.vehicle_format_label) && (
                <DetailRow
                  label={t('col_service')}
                  value={entry.service_name ?? entry.vehicle_format_label ?? ''}
                />
              )}
              {entry.vehicle_format_label && entry.service_name && (
                <DetailRow label={t('detail_vehicle_format')} value={entry.vehicle_format_label} />
              )}
              {entry.reservation_ref && (
                <DetailRow label={t('col_ref')} value={`#${entry.reservation_ref.slice(0, 12)}`} mono />
              )}
            </div>

            {/* Financial section */}
            <div className="mt-3 rounded-xl bg-white/40 p-3 dark:bg-[#001A05]/60">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#000717]/35 dark:text-[#FFFFF0]/30">
                {t('col_amount')}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-3">
                <DetailRow label={t('col_amount')} value={displayAmount(entry)} gold />
                {entry.station_service_total && (
                  <DetailRow label={t('col_service_total')} value={money(entry.station_service_total)} />
                )}
                {entry.platform_service_fee && parseFloat(entry.platform_service_fee) > 0 && (
                  <DetailRow label={t('col_platform_fee')} value={money(entry.platform_service_fee)} />
                )}
                {entry.tps_amount && parseFloat(entry.tps_amount) > 0 && (
                  <DetailRow label={t('col_tps')} value={money(entry.tps_amount)} />
                )}
                {entry.tvq_amount && parseFloat(entry.tvq_amount) > 0 && (
                  <DetailRow label={t('col_tvq')} value={money(entry.tvq_amount)} />
                )}
                <DetailRow label={t('detail_commission_rate')} value={`${(parseFloat(entry.commission_rate) * 100).toFixed(0)}%`} />
                {entry.commission_amount && (
                  <DetailRow label={t('col_commission')} value={money(entry.commission_amount)} />
                )}
                {entry.station_tax_amount && parseFloat(entry.station_tax_amount) > 0 && (
                  <DetailRow label={t('col_station_tax')} value={money(entry.station_tax_amount)} />
                )}
                {/* Reference net figure: the true amount transferred to the station. */}
                <DetailRow
                  label={t('col_net_transferred')}
                  value={money(entry.station_total_transferred ?? entry.station_payout ?? '0')}
                  gold
                />
                {entry.tip_amount && parseFloat(entry.tip_amount) > 0 && (
                  <DetailRow label={t('col_tip')} value={`+${money(entry.tip_amount)}`} gold />
                )}
                {entry.penalty_amount && parseFloat(entry.penalty_amount) > 0 && (
                  <DetailRow label={t('col_penalty')} value={`-${money(entry.penalty_amount)}`} danger />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, gold, danger }: {
  label: string; value: string; mono?: boolean; gold?: boolean; danger?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[#000717]/50 dark:text-[#FFFFF0]/45">{label}</span>
      <span className={`text-right font-semibold ${
        gold ? 'text-[#C09A18]' :
        danger ? 'text-[#FF2525]' :
        'text-foreground'
      } ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className={`shrink-0 text-foreground/30 transition-transform duration-200 dark:text-foreground/30 ${expanded ? 'rotate-180' : ''}`}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

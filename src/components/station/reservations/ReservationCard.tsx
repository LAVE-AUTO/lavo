'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { START_WINDOW_MINUTES, isWithinStartWindow } from '@/helpers/start-window';
import { STATION_TIMEZONE, formatStationTime } from '@/helpers/station-time';
import type { ReservationEntry, EntryStatus } from './types';

interface Props {
  entry: ReservationEntry;
  onValidate: (id: string) => void;
  onStart: (id: string) => void;
  onCancel: (id: string) => void;
  onExtraTime: (id: string, minutes: number) => void;
}

interface StatusDef {
  i18nKey: string;
  bg: string;
  text: string;
}

const STATUS_MAP: Record<string, StatusDef> = {
  pending_payment: { i18nKey: 'status_pending_payment', bg: '#888888', text: '#FFFFFF' },
  pending:         { i18nKey: 'status_pending',         bg: '#FF8800', text: '#FFFFFF' },
  confirmed:       { i18nKey: 'status_confirmed',       bg: '#0044FF', text: '#FFFFFF' },
  in_progress:     { i18nKey: 'status_in_progress',     bg: '#00C851', text: '#FFFFFF' },
  completed:       { i18nKey: 'status_completed',       bg: '#0044FF', text: '#FFFFFF' },
  cancelled:       { i18nKey: 'status_cancelled',       bg: '#FF2525', text: '#FFFFFF' },
  late:            { i18nKey: 'status_late',             bg: '#FF8800', text: '#FFFFFF' },
};

const ACCENT_MAP: Record<string, string> = {
  pending_payment: '#888888', pending: '#FF8800', confirmed: '#0044FF',
  in_progress: '#00C851', completed: '#0044FF', cancelled: '#FF2525', late: '#FF8800',
};

/** Decimal string from the backend snapshot → "12.34$". Falls back to 0.00$. */
function money(v: string | null | undefined): string {
  const n = parseFloat(v ?? '0');
  return `${(isNaN(n) ? 0 : n).toFixed(2)}$`;
}

function canDoStart(s: EntryStatus) { return s === 'confirmed' || s === 'pending' || s === 'pending_payment'; }
function canDoValidate(s: EntryStatus) { return s === 'in_progress'; }
function canDoCancel(s: EntryStatus) { return s === 'confirmed' || s === 'pending' || s === 'late'; }

export function ReservationCard({ entry, onValidate, onStart, onCancel, onExtraTime }: Props) {
  const t = useTranslations('station_reservations');
  const [expanded, setExpanded] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Re-evaluate the start window periodically so the buttons appear on time
  // without the merchant needing to refresh.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  /* `pending_payment` is a transient internal lifecycle (Stripe card auth in
   * flight). The merchant doesn't need to see it - the booking exists and
   * the slot is held. We surface "confirmed" until the webhook reconciles. */
  const displayStatus: EntryStatus = entry.status === 'pending_payment' ? 'confirmed' : entry.status;
  const st = STATUS_MAP[displayStatus] ?? STATUS_MAP.pending;
  const accent = ACCENT_MAP[displayStatus] ?? '#888888';
  const firstName = entry.user?.first_name?.trim();
  const lastName = entry.user?.last_name?.trim();
  const fullName = [firstName, lastName].filter((part): part is string => Boolean(part && part.length > 0)).join(' ');
  /* Off-platform walk-ins: prefer the merchant-typed name, fall back to
   * the email so the merchant card stays readable even without a name. */
  const walkInName = entry.walk_in_client_name?.trim();
  const walkInEmail = entry.walk_in_client_email?.trim();
  const clientIdentity =
    walkInName && walkInName.length > 0
      ? walkInName
      : walkInEmail && walkInEmail.length > 0
        ? walkInEmail
        : fullName.length > 0
          ? fullName
          : `#${entry.user_id.slice(0, 8)}`;
  const time = formatHourMinute(entry.slot_start_time ?? entry.created_at);
  const isReservation = entry.entry_type === 'reservation';

  // "Démarrer" / "Annuler" only appear within START_WINDOW_MINUTES before the
  // scheduled slot start. Entries without a scheduled slot (queue / walk-in) are
  // not time-gated and behave as before.
  const withinStartWindow = isWithinStartWindow(entry.slot_start_time, now);

  const showValidate = canDoValidate(entry.status);
  const showStart = canDoStart(entry.status);
  const showCancel = canDoCancel(entry.status);
  const hasActions = showStart || showValidate || showCancel;
  const slotStartLabel = entry.slot_start_time ? formatHourMinute(entry.slot_start_time) : '';
  // Minutes remaining until the start window opens (0 when already open or no slot)
  const minutesLeft = entry.slot_start_time && !withinStartWindow
    ? Math.ceil((new Date(entry.slot_start_time).getTime() - START_WINDOW_MINUTES * 60_000 - now) / 60_000)
    : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#C8C8B4] transition-shadow hover:shadow-md dark:bg-surface">
      {/* Left accent bar */}
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />

      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-4 pl-5 text-left"
      >
        <div className="flex h-10 w-20 shrink-0 items-center justify-center rounded-lg bg-white/60 dark:bg-surface">
          <span className="whitespace-nowrap font-bebas text-[15px] tracking-wide text-foreground">{time}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-foreground">
              {clientIdentity}
            </span>
            <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${
              isReservation
                ? 'bg-[#0044FF]/15 text-[#0044FF] dark:bg-[#0044FF]/25 dark:text-[#7CC4F8]'
                : 'bg-[#FF8800]/15 text-[#FF8800] dark:bg-[#FF8800]/25 dark:text-[#FFB84D]'
            }`}>
              {isReservation ? t('type_reservation') : t('type_queue')}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="truncate text-[12px] font-semibold text-foreground/70 dark:text-foreground/70">
              {entry.service?.name ?? entry.vehicle_format?.label ?? t('label_no_service')}
            </span>
            {(entry.client_total || entry.amount_paid) && (
              <span className="font-mono text-[13px] font-bold text-[#C09A18]">
                {money(entry.client_total ?? entry.amount_paid)}
              </span>
            )}
          </div>
        </div>

        <span
          className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold"
          style={{ background: st.bg, color: st.text }}
        >
          {t(st.i18nKey)}
        </span>

        <ChevronIcon expanded={expanded} />
      </button>

      {/* Animated detail panel */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[#B8B8A4] px-5 pb-4 pt-3 dark:border-[#3A4A36]">
            {/* Details grid */}
            <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              <DetailRow
                label={t('detail_service')}
                value={entry.service?.name ?? entry.vehicle_format?.label ?? t('label_no_service')}
                muted={!entry.service?.name && !entry.vehicle_format?.label}
              />
              {entry.vehicle_format?.label && entry.service?.name && (
                <DetailRow
                  label={t('detail_vehicle_format')}
                  value={entry.vehicle_format.label}
                />
              )}
              <DetailRow label={t('detail_entry_type')} value={isReservation ? t('type_reservation') : t('type_queue')} />
              <DetailRow label={t('detail_created_at')} value={formatTime(entry.created_at)} />
              <DetailRow label={t('detail_updated_at')} value={formatTime(entry.updated_at)} />
              {entry.slot_start_time ? (
                <DetailRow label={t('detail_slot')} value={formatTime(entry.slot_start_time)} />
              ) : entry.entry_type === 'queue' ? (
                <DetailRow label={t('detail_slot')} value={t('detail_no_slot')} muted />
              ) : null}
              {entry.queue_position && (
                <DetailRow label={t('detail_queue_position')} value={`#${entry.queue_position}`} />
              )}
              {entry.completed_at && (
                <DetailRow label={t('detail_completed_at')} value={formatTime(entry.completed_at)} />
              )}
              {entry.amount_paid && (
                <DetailRow label={t('amount_label')} value={`${money(entry.client_total ?? entry.amount_paid)}`} gold />
              )}
            </div>

            {/* Financial breakdown on completed entries: real final amounts from
             * the backend snapshot — merchant price, taxes and commission. The
             * platform service fee is intentionally not shown on merchant cards. */}
            {entry.status === 'completed' && (entry.client_total || entry.station_service_total) && (
              <div className="mb-3 rounded-xl bg-white/40 p-3 dark:bg-[#001A05]/60">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#000717]/35 dark:text-[#FFFFF0]/30">
                  {t('amount_section_title')}
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
                  <DetailRow label={t('amount_client_total')} value={money(entry.client_total ?? entry.amount_paid ?? '0')} gold />
                  {entry.station_service_total && (
                    <DetailRow label={t('amount_service')} value={money(entry.station_service_total)} />
                  )}
                  {entry.tps_amount && parseFloat(entry.tps_amount) > 0 && (
                    <DetailRow label={t('amount_tps')} value={money(entry.tps_amount)} />
                  )}
                  {entry.tvq_amount && parseFloat(entry.tvq_amount) > 0 && (
                    <DetailRow label={t('amount_tvq')} value={money(entry.tvq_amount)} />
                  )}
                  {entry.commission_rate && (
                    <DetailRow label={t('amount_commission_rate')} value={`${(parseFloat(entry.commission_rate) * 100).toFixed(0)}%`} />
                  )}
                  {entry.commission_amount && (
                    <DetailRow label={t('amount_commission')} value={money(entry.commission_amount)} />
                  )}
                  {entry.station_tax_amount && parseFloat(entry.station_tax_amount) > 0 && (
                    <DetailRow label={t('amount_station_tax')} value={money(entry.station_tax_amount)} />
                  )}
                  {/* Reference net figure: the true amount that will be transferred to the station. */}
                  <DetailRow
                    label={t('amount_net_transferred')}
                    value={money(entry.station_total_transferred ?? entry.station_payout ?? '0')}
                    gold
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            {hasActions && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {showValidate && (
                    <>
                      {showTimePicker ? (
                        <div className="w-full" onClick={(e) => e.stopPropagation()}>
                          <ExtraTimeInput
                            onSubmit={(min) => { onExtraTime(entry.id, min); setShowTimePicker(false); }}
                            onCancel={() => setShowTimePicker(false)}
                            label={t('time_extension_minutes_label')}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShowTimePicker(true); }}
                          className="flex items-center gap-1.5 rounded-[10px] border border-[#C09A18]/60 px-4 py-2 text-[13px] font-bold text-[#C09A18] transition-all hover:bg-[#C09A18]/10 active:scale-[0.98]"
                        >
                          <ClockIcon />
                          {t('btn_extra_time')}
                        </button>
                      )}
                      {!showTimePicker && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onValidate(entry.id); }}
                          className="flex items-center gap-1.5 rounded-[10px] bg-Hurryline-success px-4 py-2 text-[13px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                        >
                          <CheckIcon />
                          {t('btn_validate')}
                        </button>
                      )}
                    </>
                  )}
                  {showStart && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onStart(entry.id); }}
                      className="flex items-center gap-1.5 rounded-[10px] bg-[#C09A18] px-4 py-2 text-[13px] font-bold text-dark-bg transition-all hover:bg-gold-hover active:scale-[0.98]"
                    >
                      <PlayIcon />
                      {t('btn_start_service')}
                    </button>
                  )}
                  {showCancel && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onCancel(entry.id); }}
                      className="flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-[#FF2525]/30 px-3 py-2 text-[13px] font-semibold text-[#FF2525] transition-all hover:bg-[#FF2525]/10 active:scale-[0.98]"
                    >
                      <CancelIcon />
                      {t('btn_cancel_entry')}
                    </button>
                  )}
                </div>
                {/* Informational countdown to the scheduled slot. The buttons stay
                 * active at all times — confirmation flows guard accidental taps. */}
                {!withinStartWindow && (showStart || showCancel) && minutesLeft > 0 && (
                  <p className="flex items-center gap-1.5 text-[11px] text-[#000717]/45 dark:text-[#FFFFF0]/35">
                    <ClockIcon />
                    {t('actions_available_in', { min: minutesLeft })}
                    {slotStartLabel ? ` · ${slotStartLabel}` : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Times shown to the merchant are wall times at the station, not the
 * browser's timezone — keeps the card aligned with the booking picker. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', timeZone: STATION_TIMEZONE });
}

function formatHourMinute(iso: string): string {
  return formatStationTime(iso);
}

function ExtraTimeInput({
  onSubmit,
  onCancel,
  label,
}: {
  onSubmit: (minutes: number) => void;
  onCancel: () => void;
  label: string;
}) {
  const [value, setValue] = useState('');
  const minutes = parseInt(value, 10);
  const valid = !isNaN(minutes) && minutes > 0 && minutes <= 480;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#000717]/50 dark:text-[#FFFFF0]/40">{label}</span>
        <button type="button" onClick={onCancel} className="ml-auto text-[11px] text-[#000717]/40 hover:text-[#C09A18]">✕</button>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-1 rounded-[10px] border border-[#B8B8A4] bg-white/60 px-3 dark:border-[#3A4A36] dark:bg-surface/60">
          <input
            type="number"
            min={1}
            max={480}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && valid) onSubmit(minutes); }}
            placeholder="ex: 15"
            className="w-full bg-transparent py-2 text-[13px] font-mono font-bold text-foreground outline-none placeholder:text-[#000717]/25 dark:text-foreground"
            autoFocus
          />
          <span className="shrink-0 text-[11px] text-[#000717]/40 dark:text-[#FFFFF0]/30">min</span>
        </div>
        <button
          type="button"
          onClick={() => { if (valid) onSubmit(minutes); }}
          disabled={!valid}
          className="rounded-[10px] bg-[#C09A18] px-4 py-2 text-[12px] font-black text-dark-bg transition-opacity disabled:opacity-40"
        >
          OK
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, gold, muted }: { label: string; value: string; mono?: boolean; gold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[#000717]/60 dark:text-[#FFFFF0]/50">{label}</span>
      <span className={`text-right font-semibold ${
        gold ? 'text-[#C09A18]' :
        muted ? 'text-[#000717]/40 dark:text-[#FFFFF0]/30' :
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

const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);


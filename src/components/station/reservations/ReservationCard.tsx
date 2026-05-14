'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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

function canDoStart(s: EntryStatus) { return s === 'confirmed' || s === 'pending' || s === 'pending_payment'; }
function canDoValidate(s: EntryStatus) { return s === 'in_progress'; }
function canDoCancel(s: EntryStatus) { return s === 'confirmed' || s === 'pending' || s === 'late'; }

export function ReservationCard({ entry, onValidate, onStart, onCancel, onExtraTime }: Props) {
  const t = useTranslations('station_reservations');
  const [expanded, setExpanded] = useState(false);
  const [codeVisible, setCodeVisible] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  /* `pending_payment` is a transient internal lifecycle (Stripe card auth in
   * flight). The merchant doesn't need to see it - the booking exists and
   * the slot is held. We surface "confirmed" until the webhook reconciles. */
  const displayStatus: EntryStatus = entry.status === 'pending_payment' ? 'confirmed' : entry.status;
  const st = STATUS_MAP[displayStatus] ?? STATUS_MAP.pending;
  const accent = ACCENT_MAP[displayStatus] ?? '#888888';
  const firstName = entry.user?.first_name?.trim();
  const lastName = entry.user?.last_name?.trim();
  const fullName = [firstName, lastName].filter((part): part is string => Boolean(part && part.length > 0)).join(' ');
  const clientIdentity = fullName.length > 0 ? fullName : `#${entry.user_id.slice(0, 8)}`;
  const time = formatHourMinute(entry.created_at);
  const isReservation = entry.entry_type === 'reservation';
  const verificationCode = entry.id.slice(0, 8).toUpperCase();

  const hasActions = canDoStart(entry.status) || canDoValidate(entry.status) || canDoCancel(entry.status);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#C8C8B4] transition-shadow hover:shadow-md dark:bg-dark-card">
      {/* Left accent bar */}
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />

      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-4 pl-5 text-left"
      >
        <div className="flex h-10 w-20 shrink-0 items-center justify-center rounded-lg bg-white/60 dark:bg-dark-surface">
          <span className="whitespace-nowrap font-mono text-[13px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{time}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-[#000C1F] dark:text-[#FFF8EC]">
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
            <span className="truncate text-[12px] font-semibold text-[#000C1F]/70 dark:text-[#FFF8EC]/70">
              {entry.vehicle_format?.label ?? t('label_no_service')}
            </span>
            {entry.amount_paid && (
              <span className="font-mono text-[13px] font-bold text-[#C09A18]">
                {parseFloat(entry.amount_paid).toFixed(2)}$
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
                value={entry.vehicle_format?.label ?? t('label_no_service')}
                muted={!entry.vehicle_format?.label}
              />
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

            {/* Verification code row */}
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-white/40 px-3 py-2 dark:bg-dark-surface/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#000717]/50 dark:text-[#FFFFF0]/40">
                {t('code_verification_label')}
              </span>
              <span className="ml-1 font-mono text-[12px] font-bold tracking-widest text-[#000C1F] dark:text-[#FFF8EC]">
                {codeVisible ? verificationCode : '••••••••'}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCodeVisible((v) => !v); }}
                className="ml-auto text-[#000717]/40 transition-colors hover:text-[#C09A18] dark:text-[#FFFFF0]/30"
                aria-label={codeVisible ? 'Masquer le code' : 'Afficher le code'}
              >
                {codeVisible ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            {/* Actions */}
            {hasActions && (
              <div className="flex flex-wrap items-center gap-2">
                {canDoValidate(entry.status) && (
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
                {canDoStart(entry.status) && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onStart(entry.id); }}
                    className="flex items-center gap-1.5 rounded-[10px] bg-[#C09A18] px-4 py-2 text-[13px] font-bold text-dark-bg transition-all hover:bg-gold-hover active:scale-[0.98]"
                  >
                    <PlayIcon />
                    {t('btn_start_service')}
                  </button>
                )}
                {canDoCancel(entry.status) && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
}

function formatHourMinute(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
        <div className="flex flex-1 items-center gap-1 rounded-[10px] border border-[#B8B8A4] bg-white/60 px-3 dark:border-[#3A4A36] dark:bg-dark-surface/60">
          <input
            type="number"
            min={1}
            max={480}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && valid) onSubmit(minutes); }}
            placeholder="ex: 15"
            className="w-full bg-transparent py-2 text-[13px] font-mono font-bold text-[#000C1F] outline-none placeholder:text-[#000717]/25 dark:text-[#FFF8EC]"
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

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';

export interface ReservationItem {
  id: string;
  clientName: string;
  vehicleFormat: string | null;
  status: string;
  slotStart: string | null;
  slotEnd: string | null;
  amountPaid: number | null;
}

interface Props {
  items: ReservationItem[];
  selectedDate: Date;
  breakStart?: string | null;
  breakEnd?: string | null;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onExtraTime: (id: string, minutes: number) => void;
}

const STATUS_CONFIG: Record<string, { label: string; text: string; dot: string }> = {
  confirmed:       { label: 'confirmed',       text: 'text-blue-600 dark:text-blue-400',     dot: '#3B82F6' },
  pending:         { label: 'pending',         text: 'text-amber-600 dark:text-amber-400',   dot: '#F59E0B' },
  pending_payment: { label: 'pending_payment', text: 'text-zinc-500 dark:text-zinc-400',     dot: '#888' },
  in_progress:     { label: 'in_progress',     text: 'text-emerald-600 dark:text-emerald-400', dot: '#10B981' },
  completed:       { label: 'completed',       text: 'text-zinc-400 dark:text-zinc-500',     dot: '#AAA' },
  cancelled:       { label: 'cancelled',       text: 'text-red-500 dark:text-red-400',       dot: '#EF4444' },
  late:            { label: 'late',            text: 'text-orange-500 dark:text-orange-400', dot: '#F97316' },
};

const AVATAR_COLORS = ['#C49A1E', '#3B82F6', '#10B981', '#8B5CF6', '#F97316'];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function formatTime(iso: string | null, locale: string): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function slotMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function ReservationCard({
  item,
  locale,
  onStart,
  onComplete,
  onCancel,
  onExtraTime,
}: {
  item: ReservationItem;
  locale: string;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onExtraTime: (minutes: number) => void;
}) {
  const t = useTranslations('station_dashboard');
  const [codeVisible, setCodeVisible] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Hide internal pending_payment lifecycle: surface as "confirmed" since the
  // booking exists and the slot is held; the Stripe webhook will reconcile.
  const _displayStatusA = item.status === 'pending_payment' ? 'confirmed' : item.status;
  const cfg = STATUS_CONFIG[_displayStatusA] ?? STATUS_CONFIG.pending;
  const timeStart = formatTime(item.slotStart, locale);
  const timeEnd = formatTime(item.slotEnd, locale);
  const color = avatarColor(item.clientName);
  const init = initials(item.clientName);
  const verificationCode = item.id.slice(0, 8).toUpperCase();
  const isInProgress = item.status === 'in_progress';
  const canStart = ['confirmed', 'pending', 'pending_payment'].includes(item.status);
  const isActive = !['completed', 'cancelled'].includes(item.status);

  return (
    <div className="flex flex-col rounded-2xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
      {/* Time bar */}
      <div className="flex items-center gap-2 rounded-t-2xl border-b border-[#F0EDE4] bg-[#F7F6F2] px-3 py-2 dark:border-[#1A2A14] dark:bg-[#0F1A0C]">
        <div className="flex items-baseline gap-1 font-mono">
          <span className="text-[15px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{timeStart}</span>
          <span className="text-[10px] text-[#AAAAAA]">→</span>
          <span className="text-[12px] font-bold text-[#888] dark:text-[#9A9A8A]">{timeEnd}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${cfg.text}`}>
            {t(`status_${cfg.label}` as Parameters<typeof t>[0])}
          </span>
        </div>
      </div>

      {/* Client row */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
          style={{ background: color }}
          aria-hidden="true"
        >
          {init || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{item.clientName}</p>
          <p className="truncate text-[11px] text-[#888] dark:text-[#9A9A8A]">
            {item.vehicleFormat ?? t('post_unknown_service')}
            {item.amountPaid != null && (
              <span className="ml-1.5 font-semibold text-[#C49A1E]">{item.amountPaid}$</span>
            )}
          </p>
        </div>
      </div>

      {/* Verification code */}
      <div className="flex items-center gap-2 border-t border-[#F0EDE4] px-3 py-1.5 dark:border-[#1A2A14]">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#AAAAAA] dark:text-[#5A5A4A]">
          {t('code_verification_label')}
        </span>
        <span className="ml-1 font-mono text-[11px] font-bold tracking-widest text-[#1A1A0A] dark:text-[#F0EDD4]">
          {codeVisible ? verificationCode : '••••••••'}
        </span>
        <button
          type="button"
          onClick={() => setCodeVisible((v) => !v)}
          className="ml-auto text-[#AAAAAA] transition-colors hover:text-[#C49A1E] dark:text-[#5A5A4A]"
          aria-label={codeVisible ? 'Cacher le code' : 'Afficher le code'}
        >
          {codeVisible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {/* Actions */}
      {isActive && (
        <div className="border-t border-[#F0EDE4] px-3 py-2 dark:border-[#1A2A14]">
          {isInProgress ? (
            showTimePicker ? (
              <ExtraTimeInput
                onSubmit={(min) => { onExtraTime(min); setShowTimePicker(false); }}
                onCancel={() => setShowTimePicker(false)}
                label={t('time_extension_minutes_label')}
                unit={t('time_extension_minutes_unit')}
                btnLabel={t('time_extension_button')}
              />
            ) : (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowTimePicker(true)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-[#C49A1E] py-1.5 text-[10px] font-bold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/10"
                >
                  <ClockIcon />
                  {t('btn_extra_time')}
                </button>
                <button
                  type="button"
                  onClick={onComplete}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#C49A1E] py-1.5 text-[10px] font-black text-[#0C1209] transition-opacity hover:opacity-85"
                >
                  <CheckIcon />
                  {t('btn_complete')}
                </button>
              </div>
            )
          ) : canStart ? (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onStart}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-[#C49A1E] py-1.5 text-[10px] font-bold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/10"
              >
                <PlayIcon />
                {t('btn_start')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center justify-center rounded-xl border border-red-300/60 px-2.5 py-1.5 text-red-400 transition-colors hover:bg-red-50 dark:border-red-800/40 dark:hover:bg-red-950/20"
                aria-label={t('btn_cancel')}
              >
                <XIcon />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function DoneCard({ item, locale }: { item: ReservationItem; locale: string }) {
  const t = useTranslations('station_dashboard');
  const _displayStatusB = item.status === 'pending_payment' ? 'confirmed' : item.status;
  const cfg = STATUS_CONFIG[_displayStatusB] ?? STATUS_CONFIG.completed;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#F0EDE4] bg-[#F7F6F2] px-4 py-2.5 opacity-60 dark:border-[#1A2A14] dark:bg-[#0F1A0C]">
      <div className="font-mono text-[12px] font-bold text-[#888] dark:text-[#9A9A8A]">
        {formatTime(item.slotStart, locale)}
      </div>
      <div className="min-w-0 flex-1 truncate text-[12px] text-[#888] dark:text-[#9A9A8A]">
        {item.clientName}
      </div>
      <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider ${cfg.text}`}>
        {t(`status_${cfg.label}` as Parameters<typeof t>[0])}
      </span>
    </div>
  );
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-[#E0DCD0] dark:bg-[#1A2A14]" />
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#AAAAAA] dark:text-[#5A5A4A]">
          {label}
        </span>
        {count > 0 && (
          <span className="rounded-full bg-[#C49A1E] px-1.5 py-0.5 text-[9px] font-black text-[#0C1209]">
            {count}
          </span>
        )}
      </div>
      <div className="h-px flex-1 bg-[#E0DCD0] dark:bg-[#1A2A14]" />
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-[#E0DCD0] py-5 dark:border-[#1A2A14]">
      <span className="text-[11px] text-[#AAAAAA] dark:text-[#5A5A4A]">{message}</span>
    </div>
  );
}

export function DashboardReservationsPanel({
  items,
  selectedDate,
  breakStart,
  breakEnd,
  onStart,
  onComplete,
  onCancel,
  onExtraTime,
}: Props) {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();

  const dateLabel = selectedDate.toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const capitalized = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

  const activeItems = items.filter((i) => !['completed', 'cancelled'].includes(i.status));
  const doneItems = items.filter((i) => ['completed', 'cancelled'].includes(i.status));

  const shouldSplit = !!(breakStart && breakEnd);

  const morningItems = shouldSplit
    ? activeItems.filter((i) => !i.slotStart || slotMinutes(i.slotStart) < parseHHMM(breakStart!))
    : activeItems;

  const eveningItems = shouldSplit
    ? activeItems.filter((i) => !!i.slotStart && slotMinutes(i.slotStart) >= parseHHMM(breakEnd!))
    : [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E0DCD0] bg-[#F7F6F2] px-4 py-3 dark:border-[#1A2A14] dark:bg-[#0F1A0C]">
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
            {t('reservations_panel_title')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#888] dark:text-[#9A9A8A]">{capitalized}</span>
          {activeItems.length > 0 && (
            <span className="rounded-full bg-[#C49A1E] px-2 py-0.5 text-[10px] font-black text-[#0C1209]">
              {activeItems.length}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[#D0CCC0] dark:text-[#2A3A20]" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
            </svg>
            <div>
              <p className="text-[13px] font-bold text-[#888] dark:text-[#9A9A8A]">{t('reservations_empty_title')}</p>
              <p className="mt-0.5 text-[11px] text-[#AAAAAA] dark:text-[#5A5A4A]">{t('reservations_empty_hint')}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Morning section */}
            {shouldSplit && <SectionLabel label={t('section_morning')} count={morningItems.length} />}
            {morningItems.length === 0 ? (
              <EmptySection message={t('section_morning_empty')} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {morningItems.map((item) => (
                  <ReservationCard
                    key={item.id}
                    item={item}
                    locale={locale}
                    onStart={() => onStart(item.id)}
                    onComplete={() => onComplete(item.id)}
                    onCancel={() => onCancel(item.id)}
                    onExtraTime={(minutes) => onExtraTime(item.id, minutes)}
                  />
                ))}
              </div>
            )}

            {/* Evening section */}
            {shouldSplit && (
              <>
                <SectionLabel label={t('section_evening')} count={eveningItems.length} />
                {eveningItems.length === 0 ? (
                  <EmptySection message={t('section_evening_empty')} />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {eveningItems.map((item) => (
                      <ReservationCard
                        key={item.id}
                        item={item}
                        locale={locale}
                        onStart={() => onStart(item.id)}
                        onComplete={() => onComplete(item.id)}
                        onCancel={() => onCancel(item.id)}
                        onExtraTime={(minutes) => onExtraTime(item.id, minutes)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Done items */}
            {doneItems.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-[#E0DCD0] dark:bg-[#1A2A14]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#AAAAAA] dark:text-[#5A5A4A]">
                    {t('reservations_done_section')}
                  </span>
                  <div className="h-px flex-1 bg-[#E0DCD0] dark:bg-[#1A2A14]" />
                </div>
                <div className="flex flex-col gap-2">
                  {doneItems.map((item) => (
                    <DoneCard key={item.id} item={item} locale={locale} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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

function ExtraTimeInput({
  onSubmit,
  onCancel,
  label,
  unit,
  btnLabel,
}: {
  onSubmit: (minutes: number) => void;
  onCancel: () => void;
  label: string;
  unit: string;
  btnLabel: string;
}) {
  const [value, setValue] = useState('');
  const minutes = parseInt(value, 10);
  const valid = !isNaN(minutes) && minutes > 0 && minutes <= 480;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#888]">{label}</span>
        <button type="button" onClick={onCancel} className="ml-auto text-[10px] text-[#AAAAAA] hover:text-[#C49A1E]">✕</button>
      </div>
      <div className="flex gap-1.5">
        <div className="flex flex-1 items-center gap-1 rounded-lg border border-[#E0DCD0] bg-white px-2 dark:border-[#1A2A14] dark:bg-[#0F1A0C]">
          <input
            type="number"
            min={1}
            max={480}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && valid) { onSubmit(minutes); } }}
            placeholder="15"
            className="w-full bg-transparent py-1.5 text-[11px] font-mono font-bold text-[#1A1A0A] outline-none placeholder:text-[#CCCCCC] dark:text-[#F0EDD4]"
            autoFocus
          />
          <span className="shrink-0 text-[9px] text-[#AAAAAA]">{unit}</span>
        </div>
        <button
          type="button"
          onClick={() => { if (valid) onSubmit(minutes); }}
          disabled={!valid}
          className="rounded-lg bg-[#C49A1E] px-3 py-1.5 text-[10px] font-black text-[#0C1209] transition-opacity disabled:opacity-40"
        >
          {btnLabel}
        </button>
      </div>
    </div>
  );
}

const PlayIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ClockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const XIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

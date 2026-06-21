'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { TextField } from '../TextField';

export interface HourException {
  id: string;
  exception_date: string;
  reason: string;
}

interface Props {
  exceptions: HourException[];
  saving?: boolean;
  onAdd: (exception_date: string, reason: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function MiniCalendar({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (iso: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('station_config');
  const todayISO = toISO(new Date());

  const seed = selected ? new Date(selected + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getMonth());

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startPad = firstOfMonth.getDay(); // 0 = Sunday

  const cells: (number | null)[] = [
    ...Array<null>(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Day-of-week headers starting Sunday
  const dayHeaders = Array.from({ length: 7 }, (_, i) => {
    const ref = new Date(2024, 0, 7 + i); // Jan 7 2024 = Sunday
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(ref).slice(0, 2);
  });

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(firstOfMonth);
  const capitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const navBtn =
    'flex h-7 w-7 items-center justify-center rounded-lg text-foreground/55 transition-colors hover:bg-[#F0EDE4] hover:text-[#001201] dark:hover:bg-[#001A05] dark:hover:text-[#FFF9EC]';

  return (
    <div className="w-full select-none">
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={prevMonth} className={navBtn} aria-label={t('hours_exceptions_prev_month')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{capitalized}</span>
        <button type="button" onClick={nextMonth} className={navBtn} aria-label={t('hours_exceptions_next_month')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 gap-px">
        {dayHeaders.map((h, i) => (
          <span
            key={i}
            className="text-center text-[10px] font-bold uppercase tracking-wider text-[#AAAAAA] dark:text-[#5A5A4A]"
          >
            {h}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const iso = toISO(new Date(viewYear, viewMonth, day));
          const isSelected = iso === selected;
          const isToday = iso === todayISO;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={[
                'flex h-8 w-full items-center justify-center rounded-lg text-[12px] font-semibold transition-colors',
                isSelected
                  ? 'bg-[#DDAF3B] text-[#001201]'
                  : isToday
                    ? 'ring-1 ring-[#DDAF3B] text-[#DDAF3B] hover:bg-[#DDAF3B]/10'
                    : 'text-[#001201] hover:bg-[#F0EDE4] dark:text-[#FFF9EC] dark:hover:bg-dark-surface',
              ].join(' ')}
              aria-pressed={isSelected}
              aria-label={iso}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HoursExceptions({ exceptions, saving = false, onAdd, onDelete, disabled = false }: Props) {
  const t = useTranslations('station_config');

  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dateError, setDateError] = useState(false);
  const [reasonError, setReasonError] = useState(false);

  function handleCancel() {
    setDate('');
    setReason('');
    setDateError(false);
    setReasonError(false);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dateValid = date.length === 10;
    const reasonValid = reason.trim().length > 0;
    setDateError(!dateValid);
    setReasonError(!reasonValid);
    if (!dateValid || !reasonValid) return;

    setSubmitting(true);
    await onAdd(date, reason.trim());
    setSubmitting(false);
    handleCancel();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }

  return (
    <section className="rounded-2xl border border-separator/25 bg-card-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:border-[#1A2A14] dark:bg-[#182214] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#DDAF3B]">
          {t('hours_exceptions_title')}
        </h3>
        {!showForm && (
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => setShowForm(true)}
            aria-label={t('hours_exceptions_add')}
            className="flex items-center gap-1.5 rounded-[8px] border border-[#DDAF3B]/40 px-3 py-1.5 text-[12px] font-semibold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/8 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('hours_exceptions_add')}
          </button>
        )}
      </div>

      <p className="mb-4 text-[12px] leading-snug text-foreground/55 dark:text-[#B0BFB1]">
        {t('hours_exceptions_hint')}
      </p>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 flex flex-col gap-4 rounded-xl border border-[#FFF9EC] bg-[#FFF9EC] p-4 dark:border-dark-surface dark:bg-dark-bg"
        >
          <p className="text-[12px] font-bold text-[#001201] dark:text-[#FFF9EC]">
            {t('hours_exceptions_add_title')}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr]">
            {/* Calendar picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/55 dark:text-[#B0BFB1]">
                {t('hours_exceptions_date_label')}
              </label>
              <div
                className={[
                  'rounded-xl border border-separator/30 bg-card-surface p-3 dark:bg-[#182214]',
                  dateError
                    ? 'border-red-400 dark:border-red-700'
                    : date
                      ? 'border-[#DDAF3B]'
                      : 'border-[#FFF9EC] dark:border-dark-surface',
                ].join(' ')}
              >
                <MiniCalendar
                  selected={date}
                  onSelect={(iso) => { setDate(iso); if (dateError) setDateError(false); }}
                />
                {date && (
                  <p className="mt-2 text-center text-[11px] font-semibold text-[#DDAF3B]">
                    {new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
                      new Date(date + 'T00:00:00')
                    )}
                  </p>
                )}
                {dateError && (
                  <p className="mt-1.5 text-center text-[11px] font-semibold text-red-500">
                    {t('hours_exceptions_date_required')}
                  </p>
                )}
              </div>
            </div>

            {/* Reason + actions */}
            <div className="flex flex-col justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/55 dark:text-[#B0BFB1]">
                  {t('hours_exceptions_reason_label')}
                </label>
                <TextField
                  value={reason}
                  onChange={(v) => { setReason(v); if (reasonError) setReasonError(false); }}
                  placeholder={t('hours_exceptions_reason_placeholder')}
                  maxLength={200}
                  invalid={reasonError}
                  aria-invalid={reasonError}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={submitting}
                  className="rounded-xl border border-[#FFF9EC] px-4 py-2 text-[12px] font-semibold text-foreground/65 transition-colors hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-dark-surface dark:text-[#B0BFB1]"
                >
                  {t('hours_exceptions_add_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#DDAF3B] px-4 py-2 text-[12px] font-bold text-[#001201] transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                  {submitting ? '…' : t('hours_exceptions_add_submit')}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {exceptions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#D8D4C8] bg-[#FFF9EC] px-4 py-8 dark:border-dark-surface dark:bg-dark-bg">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BBBBAA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-[12px] font-semibold text-foreground/55 dark:text-[#B0BFB1]">
            {t('hours_exceptions_empty')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-[#F0EDE4] dark:divide-[#1A2A14]">
          {exceptions.map((ex) => (
            <div key={ex.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">
                  {ex.exception_date}
                </span>
                <span className="text-[12px] text-foreground/55 dark:text-[#B0BFB1]">{ex.reason}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(ex.id)}
                disabled={disabled || deletingId === ex.id}
                aria-label={t('hours_exceptions_delete_aria')}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[#FFF9EC] text-[#AAAAAA] transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-surface dark:hover:border-red-800/50 dark:hover:bg-red-950/20 dark:hover:text-red-400"
              >
                {deletingId === ex.id ? (
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

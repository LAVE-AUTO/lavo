'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';

interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESET_KEYS = ['week', 'month', '3months', 'year'] as const;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isInRange(day: Date, from: Date | null, to: Date | null): boolean {
  if (!from || !to) return false;
  const d = day.getTime();
  return d >= from.getTime() && d <= to.getTime();
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function DateRangePicker({ value, onChange }: Props) {
  const t = useTranslations('station_history');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const displayLabel = useMemo(() => {
    if (!value.from && !value.to) return t('period_all');
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const loc = locale === 'en' ? 'en-CA' : 'fr-CA';
    if (value.from && value.to) {
      const f = value.from.toLocaleDateString(loc, opts);
      const toStr = value.to.toLocaleDateString(loc, { ...opts, year: 'numeric' });
      return `${f} - ${toStr}`;
    }
    if (value.from) return `${t('calendar_from')} ${value.from.toLocaleDateString(loc, opts)}`;
    return t('period_all');
  }, [value, locale, t]);

  function applyPreset(key: typeof PRESET_KEYS[number]) {
    const to = startOfDay(new Date());
    let targetYear = to.getFullYear();
    let targetMonth = to.getMonth();
    const day = to.getDate();

    if (key === 'week') {
      onChange({ from: new Date(targetYear, targetMonth, day - 7), to });
      setOpen(false);
      return;
    }
    if (key === 'month')   targetMonth -= 1;
    if (key === '3months') targetMonth -= 3;
    if (key === 'year')    targetYear -= 1;

    // Clamp day to avoid month overflow (e.g. Mar 31 -> Feb 28)
    const maxDay = getDaysInMonth(targetYear, targetMonth);
    const from = new Date(targetYear, targetMonth, Math.min(day, maxDay));
    onChange({ from, to });
    setOpen(false);
  }

  function clearRange() {
    onChange({ from: null, to: null });
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-bold transition-all active:scale-[0.98] ${
          value.from
            ? 'bg-[#C09A18] text-[#1A2116] shadow-sm'
            : 'bg-[#C8C8B4] text-[#000717]/70 hover:bg-[#BDBDA8] dark:bg-[#1E2A1A] dark:text-[#FFFFF0]/70 dark:hover:bg-[#2A3626]'
        }`}
      >
        <CalendarIcon />
        <span>{displayLabel}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[340px] animate-fade-in rounded-2xl border border-[#CCCCCC] bg-[#E8E8D8] p-4 shadow-xl dark:border-[#3A4A36] dark:bg-[#1E2A1A]">
          {/* Presets */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={clearRange}
              className={`rounded-[8px] px-2.5 py-1 text-[12px] font-bold transition-all active:scale-[0.97] ${
                !value.from
                  ? 'bg-[#C09A18] text-[#1A2116]'
                  : 'bg-[#C8C8B4] text-[#000717]/50 hover:bg-[#BDBDA8] dark:bg-[#243020] dark:text-[#FFFFF0]/50 dark:hover:bg-[#2A3626]'
              }`}
            >
              {t('period_all')}
            </button>
            {PRESET_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className="rounded-[8px] bg-[#C8C8B4] px-2.5 py-1 text-[12px] font-bold text-[#000717]/50 transition-all hover:bg-[#BDBDA8] active:scale-[0.97] dark:bg-[#243020] dark:text-[#FFFFF0]/50 dark:hover:bg-[#2A3626]"
              >
                {t(`period_${key}`)}
              </button>
            ))}
          </div>

          <div className="h-px bg-[#CCCCCC] dark:bg-[#3A4A36]" />

          {/* Calendar */}
          <CalendarGrid
            locale={locale}
            range={value}
            onChange={(range) => {
              onChange(range);
              if (range.from && range.to) setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar grid                                                       */
/* ------------------------------------------------------------------ */

interface CalendarGridProps {
  locale: string;
  range: DateRange;
  onChange: (range: DateRange) => void;
}

function CalendarGrid({ locale, range, onChange }: CalendarGridProps) {
  const t = useTranslations('station_history');
  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewDate, setViewDate] = useState(() => range.from ?? today);
  const [selecting, setSelecting] = useState<'from' | 'to'>(!range.from ? 'from' : 'to');

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthLabel = new Date(year, month).toLocaleDateString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { month: 'long', year: 'numeric' },
  );

  const dayNames = useMemo(() => {
    const loc = locale === 'en' ? 'en-CA' : 'fr-CA';
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, i + 1);
      return d.toLocaleDateString(loc, { weekday: 'narrow' });
    });
  }, [locale]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const prevMonth = useCallback(() => setViewDate(new Date(year, month - 1, 1)), [year, month]);
  const nextMonth = useCallback(() => {
    const next = new Date(year, month + 1, 1);
    if (next <= new Date(today.getFullYear(), today.getMonth() + 1, 1)) {
      setViewDate(next);
    }
  }, [year, month, today]);

  const canGoNext = new Date(year, month + 1, 1) <= new Date(today.getFullYear(), today.getMonth() + 1, 1);

  function handleDayClick(day: number) {
    const clicked = new Date(year, month, day);
    if (clicked > today) return;

    if (selecting === 'from') {
      onChange({ from: clicked, to: null });
      setSelecting('to');
    } else {
      if (range.from && clicked < range.from) {
        onChange({ from: clicked, to: null });
        setSelecting('to');
      } else {
        onChange({ from: range.from, to: clicked });
        setSelecting('from');
      }
    }
  }

  return (
    <div className="mt-3">
      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#C8C8B4] active:scale-95 dark:hover:bg-[#243020]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-[#000C1F]/60 dark:text-[#FFF8EC]/60"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="text-[14px] font-bold capitalize text-[#000C1F] dark:text-[#FFF8EC]">{monthLabel}</span>
        <button type="button" onClick={nextMonth} disabled={!canGoNext} className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#C8C8B4] active:scale-95 disabled:opacity-20 dark:hover:bg-[#243020]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-[#000C1F]/60 dark:text-[#FFF8EC]/60"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {/* Day header */}
      <div className="mb-1 grid grid-cols-7 gap-0">
        {dayNames.map((name, i) => (
          <div key={i} className="flex h-8 items-center justify-center text-[11px] font-bold uppercase tracking-wider text-[#000717]/35 dark:text-[#FFFFF0]/30">
            {name}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0">
        {/* Empty cells for offset */}
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`empty-${i}`} className="h-9" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = new Date(year, month, day);
          const isToday = isSameDay(date, today);
          const isFuture = date > today;
          const isFrom = range.from ? isSameDay(date, range.from) : false;
          const isTo = range.to ? isSameDay(date, range.to) : false;
          const isSelected = isFrom || isTo;
          const inRange = isInRange(date, range.from, range.to);

          return (
            <button
              key={day}
              type="button"
              disabled={isFuture}
              onClick={() => handleDayClick(day)}
              className={`relative flex h-9 items-center justify-center text-[13px] font-semibold transition-all ${
                isFuture
                  ? 'cursor-not-allowed text-[#000717]/15 dark:text-[#FFFFF0]/15'
                  : isSelected
                    ? 'z-10 rounded-lg bg-[#C09A18] font-bold text-[#1A2116] shadow-sm'
                    : inRange
                      ? 'bg-[#C09A18]/15 text-[#000C1F] dark:bg-[#C09A18]/20 dark:text-[#FFF8EC]'
                      : isToday
                        ? 'font-bold text-[#C09A18]'
                        : 'text-[#000C1F]/70 hover:bg-[#C8C8B4] dark:text-[#FFF8EC]/70 dark:hover:bg-[#243020]'
              }`}
            >
              {day}
              {isToday && !isSelected && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#C09A18]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selection hint */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[#000717]/35 dark:text-[#FFFFF0]/30">
          {selecting === 'from' ? t('calendar_select_start') : t('calendar_select_end')}
        </p>
        {range.from && (
          <button
            type="button"
            onClick={() => {
              onChange({ from: null, to: null });
              setSelecting('from');
            }}
            className="text-[11px] font-bold text-[#FF2525]/70 transition-colors hover:text-[#FF2525]"
          >
            {t('calendar_clear')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

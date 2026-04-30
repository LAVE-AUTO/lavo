// MonthCalendar — displays a monthly grid with availability block indicators
// Each day that has blocks shows a "bloc-tag" chip; clicking a day opens details
'use client';
import { useTranslations } from 'next-intl';
import type { AvailabilityBlock } from './types';

interface Props {
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
  getBlocksForDate: (dateISO: string) => AvailabilityBlock[];
  onDayClick: (dateISO: string) => void;
}

const DAYS_FR = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatBlocTag(blocks: AvailabilityBlock[]): string | null {
  if (blocks.length === 0) return null;
  const first = blocks[0];
  const bays =
    first.bayIds.includes('all') || first.bayIds.length === 0
      ? 'Tous'
      : `P${first.bayIds.join(',')}`;
  const timeLabel = first.startTime.replace(':00', 'h');
  const suffix = blocks.length > 1 ? ` +${blocks.length - 1}` : '';
  return `${bays} ${timeLabel}${suffix}`;
}

export function MonthCalendar({ currentMonth, onMonthChange, getBlocksForDate, onDayClick }: Props) {
  const t = useTranslations('station_dashboard');

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const today = new Date();
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  // First day of month (adjusted: Mon=0 .. Sun=6)
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;

  // Days in current and adjacent months
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { iso: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Leading days from prev month
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ iso: toISO(prevYear, prevMonth, d), dayNum: d, isCurrentMonth: false });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: toISO(year, month, d), dayNum: d, isCurrentMonth: true });
  }

  // Trailing days to complete last row
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ iso: toISO(nextYear, nextMonth, d), dayNum: d, isCurrentMonth: false });
    }
  }

  function prevMonth() {
    onMonthChange(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    onMonthChange(new Date(year, month + 1, 1));
  }

  const monthLabel = firstDay
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    .toUpperCase();

  return (
    <div className="flex flex-1 flex-col p-5">
      {/* Calendar nav */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Mois précédent"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#C09A18]/10 text-[#C09A18] transition-colors hover:bg-[#C09A18]/20"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h2 className="text-lg font-black tracking-wide text-[#C09A18]">{monthLabel}</h2>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Mois suivant"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#C09A18]/10 text-[#C09A18] transition-colors hover:bg-[#C09A18]/20"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
        </button>

        {/* Legend */}
        <div className="ml-auto flex flex-wrap items-center gap-4 text-[11px] text-[#666] dark:text-[#A0A090]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-sm border-2 border-[#C09A18] bg-[#F0EDE0] dark:bg-[#1E2A1A]" aria-hidden="true" />
            {t('availability_legend_today')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-sm bg-[#C09A18]/30" aria-hidden="true" />
            {t('availability_legend_has_bloc')}
          </span>
          <span className="hidden sm:inline">{t('availability_legend_click_hint')}</span>
        </div>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {DAYS_FR.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-black uppercase tracking-wider text-[#666] dark:text-[#A0A090]">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid flex-1 grid-cols-7 gap-1.5">
        {cells.map(({ iso, dayNum, isCurrentMonth }) => {
          const dayBlocks = isCurrentMonth ? getBlocksForDate(iso) : [];
          const hasBloc = dayBlocks.length > 0;
          const isToday = iso === todayISO;
          const blocTag = formatBlocTag(dayBlocks);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => isCurrentMonth && onDayClick(iso)}
              disabled={!isCurrentMonth}
              className={[
                'min-h-[70px] rounded-xl p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09A18]',
                isCurrentMonth ? 'cursor-pointer' : 'cursor-default opacity-40',
                isToday
                  ? 'border-2 border-[#C09A18] bg-[#F0EDE0] dark:bg-[#1E2A1A]'
                  : hasBloc
                  ? 'border-2 border-[#C09A18]/50 bg-[#C09A18]/15 hover:bg-[#C09A18]/25 dark:bg-[#C09A18]/10'
                  : isCurrentMonth
                  ? 'bg-[#F0EDE0] hover:bg-[#E8E4D2] dark:bg-[#1E2A1A] dark:hover:bg-[#243220]'
                  : 'bg-[#E8E4D2] dark:bg-[#161E10]',
              ].join(' ')}
              aria-label={`${dayNum} — ${hasBloc ? dayBlocks.length + ' bloc(s)' : 'aucun bloc'}`}
            >
              <span
                className={`block text-[13px] font-bold ${
                  isToday
                    ? 'text-[#C09A18]'
                    : isCurrentMonth
                    ? 'text-[#1A1A0A] dark:text-[#F0EDD4]'
                    : 'text-[#A0A090]'
                }`}
              >
                {dayNum}
              </span>
              {blocTag && (
                <span className="mt-1 block rounded px-1 py-0.5 text-[9px] font-bold text-[#C09A18]" style={{ background: 'rgba(192,154,24,0.2)' }}>
                  {blocTag}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';

interface MonthCalendarProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
}

export function MonthCalendar({ selectedDate, onChange }: MonthCalendarProps) {
  const [displayedMonth, setDisplayedMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const calendar = useMemo(() => {
    const year = displayedMonth.getFullYear();
    const month = displayedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Mon-first: Mon=0, Sun=6
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [displayedMonth]);

  const monthName = displayedMonth.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const today = new Date();

  const prevMonth = () =>
    setDisplayedMonth(new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1));
  const nextMonth = () =>
    setDisplayedMonth(new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1));

  return (
    <div className="rounded-xl bg-[#F0EDE0] p-4 dark:bg-[#1E2A1A]">
      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Mois précédent"
          className="cursor-pointer rounded-lg p-1.5 text-[#1A1A0A] transition-colors hover:bg-[#C09A18]/10 dark:text-[#F0EDD4]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h3 className="text-sm font-bold capitalize text-[#1A1A0A] dark:text-[#F0EDD4]">{monthName}</h3>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Mois suivant"
          className="cursor-pointer rounded-lg p-1.5 text-[#1A1A0A] transition-colors hover:bg-[#C09A18]/10 dark:text-[#F0EDD4]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {/* Day headers Mon–Sun */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
          <div key={i} className="text-center text-[11px] font-semibold text-[#666] dark:text-[#A0A090]">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {calendar.map((date, idx) => {
          const isSelected = date && selectedDate.toDateString() === date.toDateString();
          const isToday = date && today.toDateString() === date.toDateString();

          return (
            <button
              key={idx}
              type="button"
              onClick={() => date && onChange(date)}
              disabled={!date}
              className={`aspect-square rounded-lg text-xs font-medium transition-colors ${
                !date
                  ? 'invisible'
                  : isSelected
                    ? 'cursor-pointer bg-[#C09A18] font-bold text-[#1A1A0A]'
                    : isToday
                      ? 'cursor-pointer border-2 border-[#C09A18] font-bold text-[#C09A18]'
                      : 'cursor-pointer text-[#1A1A0A] hover:bg-[#C09A18]/10 dark:text-[#F0EDD4]'
              }`}
            >
              {date ? date.getDate() : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

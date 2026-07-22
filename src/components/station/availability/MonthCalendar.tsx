// MonthCalendar - displays a monthly grid with availability block indicators
// Each day that has blocks shows a "bloc-tag" chip; clicking a day opens details
'use client';
import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { intlDateLocale, shortWeekdayUpper } from '@/helpers/date-helper';
import type { AvailabilityBlock } from './types';

interface Props {
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
  getBlocksForDate: (dateISO: string) => AvailabilityBlock[];
  onDayClick: (dateISO: string) => void;
  selectedDateISO?: string | null;
  posts: { id: string; position: number }[];
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function MonthCalendar({
  currentMonth,
  onMonthChange,
  getBlocksForDate,
  onDayClick,
  selectedDateISO,
  posts,
}: Props) {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();
  // Monday-first localized weekday headers (Jan 1 2024 is a Monday).
  const dayHeaders = useMemo(() => {
    const ref = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ref);
      d.setDate(ref.getDate() + i);
      return shortWeekdayUpper(d, locale);
    });
  }, [locale]);

  function formatBlocTag(blocks: AvailabilityBlock[]): string | null {
    if (blocks.length === 0) return null;
    const first = blocks[0];
    const bays =
      first.bayIds.includes('all') || first.bayIds.length === 0
        ? t('availability_all_postes_short')
        : first.bayIds.map((b) => posts.find((p) => p.id === b)?.position ?? b).join(',');
    const timeLabel = first.startTime.replace(':00', 'h');
    const suffix = blocks.length > 1 ? ` +${blocks.length - 1}` : '';
    return `${bays} ${timeLabel}${suffix}`;
  }

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
    .toLocaleDateString(intlDateLocale(locale), { month: 'long', year: 'numeric' })
    .toUpperCase();

  return (
    <div className="flex flex-col p-4 sm:p-5 md:flex-1">
      {/* Calendar nav */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={prevMonth}
          aria-label={t('availability_prev_month')}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#DDAF3B]/10 text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/20"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h2 className="text-lg font-black tracking-wide text-[#DDAF3B]">{monthLabel}</h2>
        <button
          type="button"
          onClick={nextMonth}
          aria-label={t('availability_next_month')}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#DDAF3B]/10 text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/20"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
        </button>

        {/* Legend */}
        <div className="ml-auto flex flex-wrap items-center gap-4 text-[11px] text-foreground/65 dark:text-[#B0BFB1]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-sm border-2 border-[#DDAF3B] bg-[#F0EDE0] dark:bg-[#001A05]" aria-hidden="true" />
            {t('availability_legend_today')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-sm bg-[#4A3418]" aria-hidden="true" />
            {t('availability_legend_has_bloc')}
          </span>
          <span className="hidden sm:inline">{t('availability_legend_click_hint')}</span>
        </div>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {dayHeaders.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-black uppercase tracking-wider text-foreground/65 dark:text-[#B0BFB1]">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1.5 md:flex-1">
        {cells.map(({ iso, dayNum, isCurrentMonth }) => {
          const dayBlocks = isCurrentMonth ? getBlocksForDate(iso) : [];
          const hasBloc = dayBlocks.length > 0;
          const isToday = iso === todayISO;
          const isPast = isCurrentMonth && iso < todayISO;
          const isDisabled = !isCurrentMonth || isPast;
          const isSelected = selectedDateISO === iso;
          const blocTag = formatBlocTag(dayBlocks);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => !isDisabled && onDayClick(iso)}
              disabled={isDisabled}
              className={[
                'min-h-[58px] rounded-xl p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAF3B] md:min-h-[70px]',
                isDisabled ? 'cursor-default opacity-40' : 'cursor-pointer',
                isSelected
                  ? 'border-2 border-[#4A3418] bg-[#4A3418]'
                  : isPast
                  ? 'border border-[#D7D2BF] bg-[#E9E4D2] dark:border-[#2A3424] dark:bg-[#141C10]'
                  : isToday
                  ? 'border-2 border-[#DDAF3B] bg-[#F0EDE0] dark:bg-[#001A05]'
                  : hasBloc
                  ? 'border-2 border-[#4A3418] bg-[#4A3418]/20 hover:bg-[#4A3418]/30'
                  : isCurrentMonth
                  ? 'bg-[#F0EDE0] hover:bg-[#E8E4D2] dark:bg-[#001A05] dark:hover:bg-[#243220]'
                  : 'bg-[#E8E4D2] dark:bg-[#161E10]',
              ].join(' ')}
              aria-label={`${dayNum} - ${t('availability_blocks_count_aria', { count: dayBlocks.length })}`}
            >
              <span
                className={`block text-[13px] font-bold ${
                  isSelected
                    ? 'text-[#FFF9EC]'
                    : isPast
                    ? 'text-[#8E8A78] dark:text-[#55624C]'
                    : isToday
                    ? 'text-[#DDAF3B]'
                    : isCurrentMonth
                    ? 'text-[#001201] dark:text-[#FFF9EC]'
                    : 'text-[#B0BFB1]'
                }`}
              >
                {dayNum}
              </span>
              {blocTag && !isPast && (
                <span className="mt-1 block rounded px-1 py-0.5 text-[9px] font-bold text-[#DDAF3B]" style={{ background: '#4A3418' }}>
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


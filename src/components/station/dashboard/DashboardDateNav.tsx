'use client';

import { useTranslations } from 'next-intl';

interface DayChip {
  name: string;
  num: number;
  date: Date;
  isActive: boolean;
}

interface DashboardDateNavProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  view: 'weekly' | 'monthly';
  onViewChange: (view: 'weekly' | 'monthly') => void;
}

function buildWeekChips(selectedDate: Date): DayChip[] {
  const dayNames = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
  const startOfWeek = new Date(selectedDate);
  const dayOfWeek = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek + 1); // Monday

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return {
      name: dayNames[d.getDay()],
      num: d.getDate(),
      date: d,
      isActive: d.toDateString() === selectedDate.toDateString(),
    };
  });
}

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export function DashboardDateNav({ selectedDate, onDateChange, view, onViewChange }: DashboardDateNavProps) {
  const t = useTranslations('station_dashboard');
  const chips = buildWeekChips(selectedDate);

  function shiftWeek(dir: -1 | 1) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir * 7);
    onDateChange(d);
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-3 border-b border-[#E0DCD0] bg-white px-5 py-3 dark:border-[#1A2A14] dark:bg-[#111A0E]">
      {/* Month bubble */}
      <div className="rounded-full bg-[#EDE9CC] px-4 py-1.5 text-[14px] font-bold text-[#1A1A0A]">
        {MONTH_NAMES_FR[selectedDate.getMonth()]}
      </div>

      {/* Prev arrow */}
      <button
        type="button"
        onClick={() => shiftWeek(-1)}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#E8E4D8] text-[14px] text-[#1A1A0A] transition-opacity hover:opacity-70 dark:bg-[#1A2A14] dark:text-[#F0EDD4]"
        aria-label="Semaine précédente"
      >
        &#8249;
      </button>

      {/* Day chips */}
      <div className="flex gap-1.5 overflow-hidden">
        {chips.map((chip) => (
          <button
            key={chip.date.toISOString()}
            type="button"
            onClick={() => onDateChange(chip.date)}
            className={
              chip.isActive
                ? 'min-w-[52px] rounded-lg px-3 py-2 text-center bg-[#C49A1E] text-[#0C1209]'
                : 'min-w-[52px] rounded-lg px-3 py-2 text-center bg-[#E8E4D8] text-[#1A1A0A] dark:bg-[#1E2A18] dark:text-[#F0EDD4] transition-colors'
            }
          >
            <div className="text-[9px] font-bold tracking-[0.06em]">{chip.name}</div>
            <div className="text-[16px] font-black">{chip.num}</div>
          </button>
        ))}
      </div>

      {/* Next arrow */}
      <button
        type="button"
        onClick={() => shiftWeek(1)}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#E8E4D8] text-[14px] text-[#1A1A0A] transition-opacity hover:opacity-70 dark:bg-[#1A2A14] dark:text-[#F0EDD4]"
        aria-label="Semaine suivante"
      >
        &#8250;
      </button>

      {/* View toggle */}
      <div className="ml-auto flex gap-[3px] rounded-lg bg-[#E8E4D8] p-[3px] dark:bg-[#1A2A14]">
        {(['weekly', 'monthly'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={
              view === v
                ? 'rounded-md px-3.5 py-1.5 text-[12px] font-bold bg-[#C49A1E] text-[#0C1209]'
                : 'rounded-md px-3.5 py-1.5 text-[12px] font-bold text-[#666] dark:text-[#8A8A7A] transition-colors'
            }
          >
            {t(v === 'weekly' ? 'view_weekly' : 'view_monthly')}
          </button>
        ))}
      </div>
    </div>
  );
}

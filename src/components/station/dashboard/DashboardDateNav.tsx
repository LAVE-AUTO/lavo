'use client';

import { useTranslations } from 'next-intl';

interface DayChip {
  name: string;
  num: number;
  date: Date;
  isActive: boolean;
  isToday: boolean;
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

  const today = new Date();

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return {
      name: dayNames[d.getDay()],
      num: d.getDate(),
      date: d,
      isActive: d.toDateString() === selectedDate.toDateString(),
      isToday: d.toDateString() === today.toDateString(),
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
    <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-[#1A2A14] bg-[#111A0E] px-5 py-3">
      {/* Month bubble */}
      <div className="rounded-full bg-[#EDE9CC] px-4 py-1.5 text-[14px] font-bold text-[#1A1A0A]">
        {MONTH_NAMES_FR[selectedDate.getMonth()]}
      </div>

      {/* Prev arrow */}
      <button
        type="button"
        onClick={() => shiftWeek(-1)}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1A2A14] text-[14px] text-[#F0EDD4] transition-opacity hover:opacity-70"
        aria-label="Semaine précédente"
      >
        &#8249;
      </button>

      {/* Day chips */}
      <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((chip) => (
          <button
            key={chip.date.toISOString()}
            type="button"
            onClick={() => onDateChange(chip.date)}
            className={[
              'relative min-w-[52px] rounded-[10px] px-3 py-2 text-center transition-all duration-150',
              chip.isActive
                ? 'bg-[#C49A1E] text-[#0C1209]'
                : 'bg-[#1A2A14] text-[#F0EDD4] hover:bg-[#243020]',
            ].join(' ')}
          >
            <div className="text-[10px] font-bold tracking-[0.06em]">{chip.name}</div>
            <div className="text-[16px] font-black">{chip.num}</div>
            {/* Gold dot for today */}
            {chip.isToday && !chip.isActive && (
              <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#C09A18]" />
            )}
            {chip.isToday && chip.isActive && (
              <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#0C1209]/50" />
            )}
          </button>
        ))}
      </div>

      {/* Next arrow */}
      <button
        type="button"
        onClick={() => shiftWeek(1)}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1A2A14] text-[14px] text-[#F0EDD4] transition-opacity hover:opacity-70"
        aria-label="Semaine suivante"
      >
        &#8250;
      </button>

      {/* View toggle */}
      <div className="ml-auto flex gap-[3px] rounded-[8px] bg-[#1A2A14] p-[3px]">
        {(['weekly', 'monthly'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={
              view === v
                ? 'rounded-md px-3.5 py-1.5 text-[12px] font-bold bg-[#C49A1E] text-[#0C1209] transition-all duration-150'
                : 'rounded-md px-3.5 py-1.5 text-[12px] font-bold text-[#8A8A7A] transition-all duration-150 hover:text-[#F0EDD4]'
            }
          >
            {t(v === 'weekly' ? 'view_weekly' : 'view_monthly')}
          </button>
        ))}
      </div>
    </div>
  );
}

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
    <div
      className="flex flex-shrink-0 items-center gap-3 border-b px-5 py-3"
      style={{ background: '#111A0E', borderColor: '#1A2A14' }}
    >
      {/* Month bubble */}
      <div className="rounded-full px-4 py-1.5 text-[14px] font-bold" style={{ background: '#EDE9CC', color: '#1A1A0A' }}>
        {MONTH_NAMES_FR[selectedDate.getMonth()]}
      </div>

      {/* Prev arrow */}
      <button
        type="button"
        onClick={() => shiftWeek(-1)}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[14px] transition-opacity hover:opacity-70"
        style={{ background: '#1A2A14', color: '#F0EDD4' }}
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
            className="min-w-[52px] rounded-lg px-3 py-2 text-center transition-all"
            style={{
              background: chip.isActive ? '#C49A1E' : '#1E2A18',
              color: chip.isActive ? '#0C1209' : '#F0EDD4',
            }}
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
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[14px] transition-opacity hover:opacity-70"
        style={{ background: '#1A2A14', color: '#F0EDD4' }}
        aria-label="Semaine suivante"
      >
        &#8250;
      </button>

      {/* View toggle */}
      <div className="ml-auto flex rounded-lg p-[3px] gap-[3px]" style={{ background: '#1A2A14' }}>
        {(['weekly', 'monthly'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className="rounded-md px-3.5 py-1.5 text-[12px] font-bold transition-all"
            style={{
              background: view === v ? '#C49A1E' : 'transparent',
              color: view === v ? '#0C1209' : '#8A8A7A',
            }}
          >
            {t(v === 'weekly' ? 'view_weekly' : 'view_monthly')}
          </button>
        ))}
      </div>
    </div>
  );
}

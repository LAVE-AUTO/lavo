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
  view: 'daily' | 'weekly' | 'monthly';
  onViewChange: (view: 'daily' | 'weekly' | 'monthly') => void;
}


function buildWeekChips(selectedDate: Date): DayChip[] {
  const dayNames = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
  const startOfWeek = new Date(selectedDate);
  const dayOfWeek = startOfWeek.getDay();
  // Monday-first: Sunday (0) must go back 6 days, other days go back (dow-1)
  startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

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

  function shiftDate(dir: -1 | 1) {
    const d = new Date(selectedDate);
    if (view === 'monthly') {
      d.setDate(1); // anchor to 1st to prevent month overflow (e.g. Jan 31 + 1 month = Mar 3)
      d.setMonth(d.getMonth() + dir);
    } else if (view === 'weekly') {
      d.setDate(d.getDate() + dir * 7);
    } else {
      d.setDate(d.getDate() + dir);
    }
    onDateChange(d);
  }

  const monthLabel = MONTH_NAMES_FR[selectedDate.getMonth()];

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-[#E0DCD0] bg-white px-5 py-3 dark:border-[#1A2A14] dark:bg-[#111A0E]">
      {/* Month bubble — shows year too in monthly view */}
      <div className="rounded-full bg-[#EDE9CC] px-4 py-1.5 text-[14px] font-bold text-[#001201] dark:bg-[#001A05] dark:text-[#FFF9EC]">
        {monthLabel}{view === 'monthly' ? ` ${selectedDate.getFullYear()}` : ''}
      </div>

      {/* Prev arrow */}
      <button
        type="button"
        onClick={() => shiftDate(-1)}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#E8E4D8] text-[14px] text-[#001201] transition-opacity hover:opacity-70 dark:bg-[#1A2A14] dark:text-[#FFF9EC]"
        aria-label={view === 'monthly' ? 'Mois précédent' : view === 'daily' ? 'Jour précédent' : 'Semaine précédente'}
      >
        &#8249;
      </button>

      {/* Day chips — hidden in monthly view */}
      {view !== 'monthly' && (
        <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((chip) => (
            <button
              key={chip.date.toISOString()}
              type="button"
              onClick={() => onDateChange(chip.date)}
              className={[
                'relative min-w-[52px] rounded-lg px-3 py-2 text-center transition-all duration-150',
                chip.isActive
                  ? 'bg-[#DDAF3B] text-[#0C1209]'
                  : 'bg-[#E8E4D8] text-[#001201] hover:bg-[#DDD8C4] dark:bg-[#1E2A18] dark:text-[#FFF9EC] dark:hover:bg-[#001A05]',
              ].join(' ')}
            >
              <div className="text-[10px] font-bold tracking-[0.06em]">{chip.name}</div>
              <div className="text-[16px] font-black">{chip.num}</div>
              {chip.isToday && !chip.isActive && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#DDAF3B]" />
              )}
              {chip.isToday && chip.isActive && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#0C1209]/50" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Next arrow */}
      <button
        type="button"
        onClick={() => shiftDate(1)}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#E8E4D8] text-[14px] text-[#001201] transition-opacity hover:opacity-70 dark:bg-[#1A2A14] dark:text-[#FFF9EC]"
        aria-label={view === 'monthly' ? 'Mois suivant' : view === 'daily' ? 'Jour suivant' : 'Semaine suivante'}
      >
        &#8250;
      </button>

      {/* View toggle — 3 options: Jour / Semaine / Mois */}
      <div className="ml-auto flex gap-[3px] rounded-lg bg-[#E8E4D8] p-[3px] dark:bg-[#1A2A14]">
        {(['daily', 'weekly', 'monthly'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={
              view === v
                ? 'rounded-lg px-3.5 py-1.5 text-[13px] font-bold bg-[#DDAF3B] text-[#0C1209] transition-all duration-150'
                : 'rounded-lg px-3.5 py-1.5 text-[13px] font-bold text-foreground/65 transition-all duration-150 dark:text-[#A0A090]'
            }
          >
            {t(v === 'daily' ? 'view_daily' : v === 'weekly' ? 'view_weekly' : 'view_monthly')}
          </button>
        ))}
      </div>
    </div>
  );
}

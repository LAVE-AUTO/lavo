'use client';

import { useMemo } from 'react';

interface WeekViewProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
}

export function WeekView({ selectedDate, onChange }: WeekViewProps) {
  const weekDays = useMemo(() => {
    const d = selectedDate;
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    }
    return days;
  }, [selectedDate]);

  const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const today = new Date();

  const prevWeek = () => {
    const d = weekDays[0];
    onChange(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
  };
  const nextWeek = () => {
    const d = weekDays[0];
    onChange(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
  };

  const weekLabel = `${weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;

  return (
    <div className="rounded-xl bg-[#F0EDE0] p-4 dark:bg-[#1E2A1A]">
      {/* Week navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={prevWeek}
          aria-label="Semaine précédente"
          className="cursor-pointer rounded-lg p-1.5 text-[#1A1A0A] transition-colors hover:bg-[#C09A18]/10 dark:text-[#F0EDD4]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h3 className="text-sm font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{weekLabel}</h3>
        <button
          type="button"
          onClick={nextWeek}
          aria-label="Semaine suivante"
          className="cursor-pointer rounded-lg p-1.5 text-[#1A1A0A] transition-colors hover:bg-[#C09A18]/10 dark:text-[#F0EDD4]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((date, idx) => {
          const isSelected = selectedDate.toDateString() === date.toDateString();
          const isToday = today.toDateString() === date.toDateString();

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onChange(date)}
              className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-lg px-1 py-2.5 transition-colors ${
                isSelected
                  ? 'bg-[#C09A18] text-[#1A1A0A]'
                  : isToday
                    ? 'border-2 border-[#C09A18] text-[#C09A18]'
                    : 'text-[#1A1A0A] hover:bg-[#C09A18]/10 dark:text-[#F0EDD4]'
              }`}
            >
              <span className="text-[10px] font-semibold">{dayNames[idx]}</span>
              <span className="text-sm font-bold">{date.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

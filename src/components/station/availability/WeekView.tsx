'use client';

import { useMemo } from 'react';

interface WeekViewProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
}

export function WeekView({ selectedDate, onChange }: WeekViewProps) {
  const weekDays = useMemo(() => {
    const date = new Date(selectedDate);
    const day = date.getDay();
    const diff = date.getDate() - day;
    const monday = new Date(date.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-4 text-center font-semibold text-slate-900 dark:text-white">Semaine du {weekDays[0].toLocaleDateString('fr-FR')}</h3>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((date, idx) => {
          const isSelected = selectedDate.toDateString() === date.toDateString();
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onChange(date)}
              className={`flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-amber-600 text-white'
                  : isToday
                    ? 'border-2 border-amber-600 text-amber-600'
                    : 'text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700'
              }`}
            >
              <span>{dayNames[idx]}</span>
              <span className="text-base font-bold">{date.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

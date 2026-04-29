'use client';

import { useMemo } from 'react';

interface MonthCalendarProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
}

export function MonthCalendar({ selectedDate, onChange }: MonthCalendarProps) {
  const calendar = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [selectedDate]);

  const monthName = selectedDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-4 text-center font-semibold text-slate-900 dark:text-white">{monthName}</h3>

      {/* Day headers */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-slate-600 dark:text-slate-400">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {calendar.map((date, idx) => {
          const isSelected = date && selectedDate.toDateString() === date.toDateString();
          const isToday = date && new Date().toDateString() === date.toDateString();

          return (
            <button
              key={idx}
              type="button"
              onClick={() => date && onChange(date)}
              disabled={!date}
              className={`aspect-square rounded-lg text-xs font-medium transition-colors ${
                !date
                  ? 'cursor-not-allowed'
                  : isSelected
                    ? 'bg-amber-600 text-white'
                    : isToday
                      ? 'border-2 border-amber-600 text-amber-600'
                      : 'text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700'
              }`}
            >
              {date?.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

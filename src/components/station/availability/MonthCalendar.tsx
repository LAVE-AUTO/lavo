'use client';

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

'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useMemo } from 'react';
import type { StationHourRow } from '@/types/station';

interface StationOpeningHoursProps {
  hours: StationHourRow[];
}

/* "HH:MM:SS" or "HH:MM" → "HH:MM" with leading zeros normalised. */
function trimSeconds(value: string | null): string | null {
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length < 2) return value;
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

function formatRange(start: string | null, end: string | null): string | null {
  const a = trimSeconds(start);
  const b = trimSeconds(end);
  if (!a && !b) return null;
  if (a && b) return `${a} – ${b}`;
  return a ?? b;
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function StationOpeningHours({ hours }: StationOpeningHoursProps) {
  const t = useTranslations('stations');
  const locale = useLocale();
  const intlLocale = locale === 'fr' ? 'fr-CA' : 'en-CA';

  /* Map provided rows by day_of_week; backfill missing days with closed rows
   * so the grid always shows the full week. */
  const ordered = useMemo(() => {
    const byDay = new Map<number, StationHourRow>();
    hours.forEach((h) => byDay.set(h.dayOfWeek, h));
    return WEEK_ORDER.map((day) => {
      const row = byDay.get(day);
      return row ?? {
        dayOfWeek: day,
        isOpen: false,
        morningStart: null,
        morningEnd: null,
        afternoonStart: null,
        afternoonEnd: null,
      };
    });
  }, [hours]);

  const todayDow = new Date().getDay();

  return (
    <section>
      <h2 className="text-[17px] font-black text-foreground mb-3">
        {t('hours_title')}
      </h2>
      <ul className="rounded-2xl border border-border bg-surface overflow-hidden">
        {ordered.map((row, idx) => {
          /* Use a fixed reference week (2024-01-07 = Sunday) to derive locale-aware
           * weekday names without hardcoding strings. */
          const refDate = new Date(2024, 0, 7 + row.dayOfWeek);
          const longName = refDate.toLocaleDateString(intlLocale, { weekday: 'long' });
          const dayLabel = longName.charAt(0).toUpperCase() + longName.slice(1);
          const isToday = row.dayOfWeek === todayDow;

          const morning = formatRange(row.morningStart, row.morningEnd);
          const afternoon = formatRange(row.afternoonStart, row.afternoonEnd);

          return (
            <li
              key={row.dayOfWeek}
              className={`flex items-center justify-between gap-3 px-5 py-3 text-[13.5px] ${
                idx > 0 ? 'border-t border-border' : ''
              } ${isToday ? 'bg-gold/10 dark:bg-gold/15' : ''}`}
            >
              <span
                className={`font-bold ${
                  isToday
                    ? 'text-gold'
                    : 'text-foreground'
                }`}
              >
                {dayLabel}
                {isToday && (
                  <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-gold">
                    {t('hours_today')}
                  </span>
                )}
              </span>
              {row.isOpen && (morning || afternoon) ? (
                <span className="font-bebas text-right text-foreground tabular-nums text-[16px] tracking-wider">
                  {morning && <span>{morning}</span>}
                  {morning && afternoon && (
                    <span className="text-foreground/55 mx-1.5">•</span>
                  )}
                  {afternoon && <span>{afternoon}</span>}
                </span>
              ) : (
                <span className="text-foreground/55 font-semibold italic">
                  {t('hours_closed')}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

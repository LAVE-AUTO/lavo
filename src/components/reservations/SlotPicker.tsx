'use client';

/* ------------------------------------------------------------------ */
/* SlotPicker - grille de sélection de créneau horaire                 */
/* ------------------------------------------------------------------ */

import { STATION_TIMEZONE, utcToStationMinutes } from '@/helpers/station-time';

export interface AvailableSlot {
  id: string;
  startTime: string; /* ISO string */
  isFull: boolean;
}

interface SlotPickerProps {
  slots: AvailableSlot[];
  selectedSlotId: string | null;
  onSelect: (slotId: string) => void;
  locale: string;
}

/* Station-local wall time (not the visitor's browser timezone) — a slot
 * booked for "16:04" station-local must show as "16:04" everywhere. */
function formatSlotTime(isoString: string, locale: string): { date: string; time: string } {
  const d = new Date(isoString);
  const date = d.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: STATION_TIMEZONE,
  });
  const minutes = utcToStationMinutes(d);
  const h = String(Math.floor(minutes / 60) % 24).padStart(2, '0');
  const mn = String(minutes % 60).padStart(2, '0');
  return { date, time: `${h}:${mn}` };
}

function groupSlotsByDate(
  slots: AvailableSlot[],
  locale: string,
): Array<{ dateLabel: string; slots: Array<AvailableSlot & { time: string }> }> {
  const map = new Map<string, Array<AvailableSlot & { time: string }>>();

  for (const slot of slots) {
    const { date, time } = formatSlotTime(slot.startTime, locale);
    const existing = map.get(date) ?? [];
    existing.push({ ...slot, time });
    map.set(date, existing);
  }

  return Array.from(map.entries()).map(([dateLabel, slotList]) => ({ dateLabel, slots: slotList }));
}

export default function SlotPicker({ slots, selectedSlotId, onSelect, locale }: SlotPickerProps) {
  const groups = groupSlotsByDate(slots, locale);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-5">
      {groups.map(({ dateLabel, slots: daySlots }) => (
        <div key={dateLabel}>
          <p className="text-[12px] font-bold text-[#999] dark:text-foreground/55 uppercase tracking-widest mb-2">
            {dateLabel}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {daySlots.map((slot) => {
              const isSelected = slot.id === selectedSlotId;
              const isDisabled = slot.isFull;

              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onSelect(slot.id)}
                  className={[
                    'py-2.5 rounded-[10px] text-[16px] font-bebas tracking-wider border transition-all',
                    isDisabled
                      ? 'border-border text-foreground/40 cursor-not-allowed'
                      : isSelected
                        ? 'border-gold bg-gold text-background shadow-sm cursor-pointer'
                        : 'border-border text-foreground hover:border-gold/60 cursor-pointer',
                  ].join(' ')}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

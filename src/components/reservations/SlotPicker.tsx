'use client';

/* ------------------------------------------------------------------ */
/* SlotPicker — grille de sélection de créneau horaire                 */
/* ------------------------------------------------------------------ */

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

function formatSlotTime(isoString: string, locale: string): { date: string; time: string } {
  const d = new Date(isoString);
  const date = d.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  const h = String(d.getHours()).padStart(2, '0');
  const mn = String(d.getMinutes()).padStart(2, '0');
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
          <p className="text-[12px] font-bold text-[#999] dark:text-[#888] uppercase tracking-widest mb-2">
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
                    'py-2.5 rounded-[10px] text-[14px] font-bold border transition-all',
                    'font-[family-name:var(--font-roboto-mono)]',
                    isDisabled
                      ? 'border-[#D0D0C0] dark:border-tab-inactive text-[#CCC] dark:text-[#555] cursor-not-allowed'
                      : isSelected
                        ? 'border-gold bg-gold text-dark-bg shadow-sm cursor-pointer'
                        : 'border-[#D0D0C0] dark:border-tab-inactive text-[#0A0A14] dark:text-white hover:border-gold/60 cursor-pointer',
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

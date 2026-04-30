'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AddSlotModal } from './AddSlotModal';
import { SlotCard } from './SlotCard';
import { BayFilter } from './BayFilter';

interface DaySlotsListProps {
  date: Date;
  slots: any[];
  onSlotsChange: (slots: any[]) => void;
}

export function DaySlotsList({ date, slots, onSlotsChange }: DaySlotsListProps) {
  const t = useTranslations('station_dashboard');
  const [selectedBay, setSelectedBay] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const bays = useMemo(() => {
    const baySet = new Set(slots.map((s) => s.bay_id));
    return Array.from(baySet);
  }, [slots]);

  const filteredSlots = useMemo(() => {
    if (!selectedBay) return slots;
    return slots.filter((s) => s.bay_id === selectedBay);
  }, [slots, selectedBay]);

  const handleAddSlot = useCallback(
    (newSlot: any) => {
      onSlotsChange([...slots, newSlot]);
    },
    [slots, onSlotsChange]
  );

  const handleUpdateSlot = useCallback(
    (slotId: string, updatedSlot: any) => {
      onSlotsChange(slots.map((s) => (s.id === slotId ? updatedSlot : s)));
    },
    [slots, onSlotsChange]
  );

  const handleDeleteSlot = useCallback(
    (slotId: string) => {
      onSlotsChange(slots.filter((s) => s.id !== slotId));
    },
    [slots, onSlotsChange]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
            {t('availability_day_slots_title')}
            {slots.length > 0 && (
              <span className="ml-2 rounded-full bg-[#C09A18]/15 px-2 py-0.5 text-xs font-semibold text-[#C09A18]">
                {slots.length}
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-sm capitalize text-[#666] dark:text-[#A0A090]">
            {date.toLocaleDateString('fr-FR', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="cursor-pointer rounded-xl bg-[#C09A18] px-4 py-2 text-sm font-bold text-[#1A1A0A] transition-colors hover:bg-[#a8861a]'"
        >
          + {t('availability_add_slot_button')}
        </button>
      </div>

      {/* Bay Filter */}
      {bays.length > 0 && <BayFilter bays={bays} selectedBay={selectedBay} onBayChange={setSelectedBay} />}

      {/* Slots List */}
      {filteredSlots.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-[#F0EDE0] p-10 text-center dark:bg-[#1E2A1A]">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mb-3 text-[#666] dark:text-[#A0A090]"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>
          <p className="text-sm font-medium text-[#666] dark:text-[#A0A090]">{t('availability_no_slots')}</p>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 cursor-pointer rounded-xl bg-[#C09A18] px-4 py-2 text-sm font-bold text-[#1A1A0A] transition-colors hover:bg-[#a8861a]"
          >
            + {t('availability_add_slot_button')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSlots.map((slot) => (
            <SlotCard key={slot.id} slot={slot} onUpdate={handleUpdateSlot} onDelete={handleDeleteSlot} />
          ))}
        </div>
      )}

      {/* Add Slot Modal */}
      <AddSlotModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        date={date}
        bays={bays}
        onSuccess={handleAddSlot}
      />
    </div>
  );
}

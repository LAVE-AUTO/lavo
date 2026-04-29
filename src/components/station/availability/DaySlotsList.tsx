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
          <h3 className="font-semibold text-slate-900 dark:text-white">{t('availability_day_slots_title')}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{date.toLocaleDateString('fr-FR', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
        >
          + {t('availability_add_slot_button')}
        </button>
      </div>

      {/* Bay Filter */}
      {bays.length > 0 && <BayFilter bays={bays} selectedBay={selectedBay} onBayChange={setSelectedBay} />}

      {/* Slots List */}
      {filteredSlots.length === 0 ? (
        <div className="rounded-lg bg-slate-50 p-8 text-center dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('availability_no_slots')}</p>
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

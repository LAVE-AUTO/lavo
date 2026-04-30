'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { postWithApi } from '@/services';
import { Modal } from '@/components/ui/Modal';

interface AddSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  bays: string[];
  onSuccess: (slot: any) => void;
}

export function AddSlotModal({ isOpen, onClose, date, bays, onSuccess }: AddSlotModalProps) {
  const t = useTranslations('station_dashboard');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [bay, setBay] = useState(bays[0] || '1');
  const [capacity, setCapacity] = useState('5');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddSlot = useCallback(async () => {
    if (!startTime || !endTime || !bay || !capacity) {
      setError(t('availability_error_missing_fields'));
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const dateStr = date.toISOString().split('T')[0];
      const [startHour, startMin] = startTime.split(':');
      const [endHour, endMin] = endTime.split(':');

      const startDateTime = new Date(`${dateStr}T${startTime}:00`).toISOString();
      const endDateTime = new Date(`${dateStr}T${endTime}:00`).toISOString();

      const [success, data] = await postWithApi('/station/slots', {
        start_time: startDateTime,
        end_time: endDateTime,
        bay_id: bay,
        capacity: parseInt(capacity, 10),
      });

      if (!success) {
        setError(data?.error || t('error_queue_empty'));
        return;
      }

      onSuccess(data?.data || {});
      onClose();
    } catch (err) {
      console.error('Add slot error:', err);
      setError(t('error_queue_empty'));
    } finally {
      setIsLoading(false);
    }
  }, [startTime, endTime, bay, capacity, date, onClose, onSuccess, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('availability_add_slot_title')}>
      <div className="space-y-4 p-4">
        <p className="capitalize text-sm text-[#666] dark:text-[#A0A090]">
          {date.toLocaleDateString('fr-FR', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>

        {/* Start Time */}
        <div>
          <label className="block text-sm font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">
            {t('availability_start_time')}<span className="text-[#FF2525]">*</span>
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#C09A18]/30 bg-[#F0EDE0] px-3 py-2 text-sm text-[#1A1A0A] outline-none transition-colors focus:border-[#C09A18] dark:bg-[#1E2A1A] dark:text-[#F0EDD4]"
          />
        </div>

        {/* End Time */}
        <div>
          <label className="block text-sm font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">
            {t('availability_end_time')}<span className="text-[#FF2525]">*</span>
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#C09A18]/30 bg-[#F0EDE0] px-3 py-2 text-sm text-[#1A1A0A] outline-none transition-colors focus:border-[#C09A18] dark:bg-[#1E2A1A] dark:text-[#F0EDD4]"
          />
        </div>

        {/* Bay */}
        <div>
          <label className="block text-sm font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">
            {t('availability_bay')}<span className="text-[#FF2525]">*</span>
          </label>
          <select
            value={bay}
            onChange={(e) => setBay(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#C09A18]/30 bg-[#F0EDE0] px-3 py-2 text-sm text-[#1A1A0A] outline-none transition-colors focus:border-[#C09A18] dark:bg-[#1E2A1A] dark:text-[#F0EDD4]"
          >
            {bays.map((b) => (
              <option key={b} value={b}>
                Poste {b}
              </option>
            ))}
          </select>
        </div>

        {/* Capacity */}
        <div>
          <label className="block text-sm font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">
            {t('availability_capacity')}<span className="text-[#FF2525]">*</span>
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#C09A18]/30 bg-[#F0EDE0] px-3 py-2 text-sm text-[#1A1A0A] outline-none transition-colors focus:border-[#C09A18] dark:bg-[#1E2A1A] dark:text-[#F0EDD4]"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-[#FF2525]/10 p-3 text-sm font-medium text-[#FF2525]">{error}</div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-xl border border-[#C09A18]/30 bg-transparent px-4 py-2 text-sm font-semibold text-[#1A1A0A] transition-colors hover:bg-[#C09A18]/10 dark:text-[#F0EDD4]"
          >
            {t('confirm_btn_cancel')}
          </button>
          <button
            type="button"
            onClick={handleAddSlot}
            disabled={isLoading}
            className="flex-1 cursor-pointer rounded-xl bg-[#C09A18] px-4 py-2 text-sm font-bold text-[#1A1A0A] transition-colors hover:bg-[#a8861a] disabled:opacity-50"
          >
            {isLoading ? t('loading') : t('availability_add_slot_button')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

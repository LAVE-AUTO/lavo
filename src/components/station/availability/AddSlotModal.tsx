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
        <p className="text-sm text-slate-600 dark:text-slate-400">{date.toLocaleDateString('fr-FR', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

        {/* Start Time */}
        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white">
            {t('availability_start_time')}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* End Time */}
        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white">
            {t('availability_end_time')}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Bay */}
        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white">
            {t('availability_bay')}
            <span className="text-red-500">*</span>
          </label>
          <select
            value={bay}
            onChange={(e) => setBay(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            {bays.map((b) => (
              <option key={b} value={b}>
                Bay {b}
              </option>
            ))}
          </select>
        </div>

        {/* Capacity */}
        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white">
            {t('availability_capacity')}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Error */}
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {t('confirm_btn_cancel')}
          </button>
          <button
            type="button"
            onClick={handleAddSlot}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {isLoading ? t('loading') : t('availability_add_slot_button')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

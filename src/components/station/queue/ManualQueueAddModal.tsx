'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { postWithApi } from '@/services';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ManualQueueAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleFormats: Array<{ id: string; label: string; price: string }>;
  availableSlots: Array<{ id: string; time: string; capacity: number; booked_count: number }>;
  onSuccess: (entryId: string) => void;
}

export function ManualQueueAddModal({
  isOpen,
  onClose,
  vehicleFormats,
  availableSlots,
  onSuccess,
}: ManualQueueAddModalProps) {
  const t = useTranslations('station_dashboard');
  const [formatId, setFormatId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddEntry = useCallback(async () => {
    if (!formatId) {
      setError(t('manual_queue_error_format'));
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const [success, data] = await postWithApi('/station/entries', {
        vehicle_format_id: formatId,
        time_slot_id: slotId || undefined,
      });

      if (!success) {
        setError(t('manual_queue_error_unavailable'));
        return;
      }

      const newEntryId = (data as { data?: { id?: string } })?.data?.id;
      if (!newEntryId) {
        setError(t('manual_queue_error_unavailable'));
        return;
      }

      onSuccess(newEntryId);
      onClose();
    } catch {
      setError(t('manual_queue_error_unavailable'));
    } finally {
      setIsLoading(false);
    }
  }, [formatId, slotId, clientPhone, notes, onClose, onSuccess, t]);

  const isValid = formatId.length > 0;

  return (
    <Modal open={isOpen} onClose={onClose} title={t('manual_queue_title')}>
      <div className="space-y-4 p-4">
        {/* Vehicle Format Select */}
        <div>
          <label htmlFor="manual-queue-format" className="block text-sm font-medium text-slate-900 dark:text-white">
            {t('manual_queue_format_label')}
            <span className="text-red-500">*</span>
          </label>
          <select
            id="manual-queue-format"
            value={formatId}
            onChange={(e) => setFormatId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t('manual_queue_format_placeholder')}</option>
            {vehicleFormats.map((format) => (
              <option key={format.id} value={format.id}>
                {format.label} ({format.price})
              </option>
            ))}
          </select>
        </div>

        {/* Slot Select (Optional) */}
        <div>
          <label htmlFor="manual-queue-slot" className="block text-sm font-medium text-slate-900 dark:text-white">
            {t('manual_queue_slot_label')}
          </label>
          <select
            id="manual-queue-slot"
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t('manual_queue_slot_placeholder')}</option>
            {availableSlots.map((slot) => (
              <option key={slot.id} value={slot.id} disabled={slot.booked_count >= slot.capacity}>
                {slot.time} ({slot.capacity - slot.booked_count} {t('manual_queue_slots_available')})
              </option>
            ))}
          </select>
        </div>

        {/* Phone (Optional) */}
        <div>
          <label htmlFor="manual-queue-phone" className="block text-sm font-medium text-slate-900 dark:text-white">
            {t('manual_queue_phone_label')}
          </label>
          <input
            id="manual-queue-phone"
            type="tel"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            placeholder="+15141234567"
            maxLength={20}
            inputMode="tel"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
          />
        </div>

        {/* Notes (Optional) */}
        <div>
          <label htmlFor="manual-queue-notes" className="block text-sm font-medium text-slate-900 dark:text-white">
            {t('manual_queue_notes_label')}
          </label>
          <textarea
            id="manual-queue-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('manual_queue_notes_placeholder')}
            rows={2}
            maxLength={300}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
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
            onClick={handleAddEntry}
            disabled={!isValid || isLoading}
            className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {isLoading ? t('loading') : t('manual_queue_add_button')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

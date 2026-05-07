'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { postWithApi } from '@/services';
import { Modal } from '@/components/ui/Modal';

interface SlotBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotId: string;
  slotTime: string;
  onSuccess: () => void;
}

const BLOCK_REASONS = [
  'maintenance',
  'cleaning',
  'staff_break',
  'emergency',
  'other',
] as const;

export function SlotBlockModal({ isOpen, onClose, slotId, slotTime, onSuccess }: SlotBlockModalProps) {
  const t = useTranslations('station_dashboard');
  const [reason, setReason] = useState<string>('maintenance');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBlockSlot = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [success] = await postWithApi(`/station/slots/${slotId}/block`, {});

      if (!success) {
        setError(t('error_queue_empty'));
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError(t('error_queue_empty'));
    } finally {
      setIsLoading(false);
    }
  }, [slotId, onClose, onSuccess, t]);

  return (
    <Modal open={isOpen} onClose={onClose} title={t('slot_block_title')}>
      <div className="space-y-4 p-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('slot_block_subtitle')} <span className="font-semibold">{slotTime}</span>
        </p>

        <div>
          <label htmlFor="slot-block-reason" className="block text-sm font-medium text-slate-900 dark:text-white">
            {t('slot_block_reason_label')}
          </label>
          <select
            id="slot-block-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            {BLOCK_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`slot_block_reason_${r}`)}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

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
            onClick={handleBlockSlot}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? t('loading') : t('slot_block_button')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

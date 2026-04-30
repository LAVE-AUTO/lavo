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
];

export function SlotBlockModal({ isOpen, onClose, slotId, slotTime, onSuccess }: SlotBlockModalProps) {
  const t = useTranslations('station_dashboard');
  const [reason, setReason] = useState('maintenance');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBlockSlot = useCallback(async () => {
    if (!reason) {
      setError(t('slot_block_error_reason'));
      return;
    }
    const duration = parseInt(durationMinutes, 10);
    if (isNaN(duration) || duration <= 0) {
      setError(t('slot_block_error_reason'));
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const blockedUntil = new Date(Date.now() + duration * 60 * 1000).toISOString();

      // TODO: connect to API once POST /station/slots/:id/block endpoint is available
      const [success, data] = await postWithApi(`/station/slots/${slotId}/block`, {
        reason,
        blocked_until: blockedUntil,
      });

      if (!success) {
        setError(data?.error || t('error_queue_empty'));
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError(t('error_queue_empty'));
    } finally {
      setIsLoading(false);
    }
  }, [reason, durationMinutes, slotId, onClose, onSuccess, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('slot_block_title')} blocking>
      <div className="space-y-4 p-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('slot_block_subtitle')} <span className="font-semibold">{slotTime}</span>
        </p>

        {/* Reason Select */}
        <div>
          <label htmlFor="slot-block-reason" className="block text-sm font-medium text-slate-900 dark:text-white">
            {t('slot_block_reason_label')}
            <span className="text-red-500">*</span>
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

        {/* Duration Select */}
        <div>
          <label htmlFor="slot-block-duration" className="block text-sm font-medium text-slate-900 dark:text-white">
            {t('slot_block_duration_label')}
            <span className="text-red-500">*</span>
          </label>
          <div className="mt-2 flex gap-2">
            <select
              id="slot-block-duration"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">1 heure</option>
              <option value="120">2 heures</option>
              <option value="240">4 heures</option>
            </select>
          </div>
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
            onClick={handleBlockSlot}
            disabled={isLoading || !reason}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? t('loading') : t('slot_block_button')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

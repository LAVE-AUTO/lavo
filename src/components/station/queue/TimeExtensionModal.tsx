'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { postWithApi } from '@/services';
import { Modal } from '@/components/ui/Modal';

interface TimeExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryId: string;
  currentEndTime: string;
  onSuccess: () => void;
}

export function TimeExtensionModal({
  isOpen,
  onClose,
  entryId,
  currentEndTime,
  onSuccess,
}: TimeExtensionModalProps) {
  const t = useTranslations('station_dashboard');
  const [minutes, setMinutes] = useState('15');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtendTime = useCallback(async () => {
    const mins = parseInt(minutes, 10);
    if (isNaN(mins) || mins <= 0 || mins > 120) {
      setError(t('time_extension_error_minutes'));
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const [success, data] = await postWithApi('/station/extra-time', {
        reservation_id: entryId,
        extra_minutes: mins,
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
  }, [minutes, entryId, onClose, onSuccess, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('time_extension_title')} blocking>
      <div className="space-y-4 p-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('time_extension_subtitle')} <span className="font-semibold">{currentEndTime}</span>
        </p>

        {/* Minutes Input */}
        <div>
          <label htmlFor="time-extension-minutes" className="block text-sm font-medium text-slate-900 dark:text-white">
            {t('time_extension_minutes_label')}
            <span className="text-red-500">*</span>
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="time-extension-minutes"
              type="number"
              min="1"
              max="120"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            <span className="flex items-center text-sm text-slate-600 dark:text-slate-400">{t('time_extension_minutes_unit')}</span>
          </div>
        </div>

        {/* Quick buttons */}
        <div className="flex gap-2">
          {[5, 10, 15, 30].map((min) => (
            <button
              key={min}
              type="button"
              onClick={() => setMinutes(min.toString())}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                minutes === min.toString()
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              +{min} {t('time_extension_minutes_unit')}
            </button>
          ))}
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
            onClick={handleExtendTime}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {isLoading ? t('loading') : t('time_extension_button')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

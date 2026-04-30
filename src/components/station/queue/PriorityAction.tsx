'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { patchWithApi } from '@/services';

interface PriorityActionProps {
  entryId: string;
  currentPosition: number;
  disabled?: boolean;
  onSuccess: () => void;
}

export function PriorityAction({ entryId, currentPosition, disabled = false, onSuccess }: PriorityActionProps) {
  const t = useTranslations('station_dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMoveFront = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // TODO: connect to API once PATCH /station/entries/:id/priority endpoint is available
      const [success, data] = await patchWithApi(`/station/entries/${entryId}/priority`, {
        new_queue_position: 1,
      });

      if (!success) {
        setError(data?.error || t('error_queue_empty'));
        return;
      }

      onSuccess();
    } catch {
      setError(t('error_queue_empty'));
    } finally {
      setIsLoading(false);
    }
  }, [entryId, onSuccess, t]);

  // Don't show button if already first in queue
  if (currentPosition === 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleMoveFront}
        disabled={disabled || isLoading || currentPosition === 1}
        title={t('priority_action_tooltip')}
        className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? t('loading') : t('priority_action_button')}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

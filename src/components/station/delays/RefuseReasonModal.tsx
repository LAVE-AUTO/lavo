'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const MAX_REASON = 300;

interface RefuseReasonModalProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function RefuseReasonModal({ open, loading, error, onConfirm, onCancel }: RefuseReasonModalProps) {
  const t = useTranslations('station_delays');
  const [reason, setReason] = useState('');

  if (!open) return null;

  function handleConfirm() {
    onConfirm(reason);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!loading ? onCancel : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm rounded-[14px] bg-white p-6 shadow-xl dark:bg-[#1E2A1A]">
        <h2 className="text-[16px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('refuse_title')}</h2>
        <p className="mt-1.5 text-[12px] text-[#000717]/60 dark:text-[#FFFFF0]/50">{t('refuse_message')}</p>

        <div className="mt-4">
          <label htmlFor="refusal-reason" className="block text-[11px] font-semibold text-[#000717]/50 dark:text-[#FFFFF0]/40 mb-1.5">
            {t('refuse_reason_label')} <span className="text-[#000717]/30 dark:text-[#FFFFF0]/25">({t('optional')})</span>
          </label>
          <textarea
            id="refusal-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
            rows={3}
            disabled={loading}
            placeholder={t('refuse_reason_placeholder')}
            className="w-full resize-none rounded-[8px] border border-[#CCCCCC] bg-[#F5F5EE] px-3 py-2 text-[13px] text-[#000C1F] outline-none transition-colors focus:border-[#C09A18] dark:border-[#3A4A36] dark:bg-[#141E10] dark:text-[#FFF8EC] placeholder:text-[#000717]/30 dark:placeholder:text-[#FFFFF0]/20 disabled:opacity-50"
          />
          <div className="mt-1 text-right text-[10px] text-[#000717]/30 dark:text-[#FFFFF0]/25">
            {reason.length}/{MAX_REASON}
          </div>
        </div>

        {error && (
          <p className="mt-2 text-[12px] font-medium text-[#E8472A]">{error}</p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-[8px] border border-[#CCCCCC] py-2.5 text-[13px] font-semibold text-[#000C1F]/60 transition-colors hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-[#3A4A36] dark:text-[#FFF8EC]/50 dark:hover:bg-[#243020]"
          >
            {t('btn_cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-[8px] bg-[#E8472A] py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#D43D22] disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                {t('btn_refuse')}
              </span>
            ) : t('btn_refuse')}
          </button>
        </div>
      </div>
    </div>
  );
}

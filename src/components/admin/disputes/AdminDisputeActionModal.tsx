'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

export type ModalMode = 'refund_full' | 'refund_partial' | 'close_dispute';

interface Props {
  mode: ModalMode | null;
  maxAmount?: number;
  busy: boolean;
  onConfirm: (payload: { amount?: number; reason?: string }) => void;
  onClose: () => void;
}

export function AdminDisputeActionModal({ mode, maxAmount, busy, onConfirm, onClose }: Props) {
  const t        = useTranslations('admin_disputes');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error,  setError]  = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (mode) { setAmount(''); setReason(''); setError(''); setTimeout(() => (inputRef.current as HTMLElement | null)?.focus(), 80); }
  }, [mode]);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [busy, onClose]);

  if (!mode) return null;

  function handleSubmit() {
    setError('');
    if (mode === 'refund_partial') {
      const val = parseFloat(amount.replace(',', '.'));
      if (!amount.trim()) { setError(t('modal_amount_required')); return; }
      if (isNaN(val) || val <= 0 || (maxAmount !== undefined && val > maxAmount) || !/^\d+(\.\d{1,2})?$/.test(amount.replace(',', '.'))) { setError(t('modal_amount_invalid')); return; }
      onConfirm({ amount: val });
    } else if (mode === 'close_dispute') {
      if (!reason.trim() || reason.trim().length < 10) { setError(t('modal_reason_required')); return; }
      onConfirm({ reason: reason.trim() });
    } else {
      onConfirm({});
    }
  }

  const title = mode === 'refund_full' ? t('modal_refund_full_title') : mode === 'refund_partial' ? t('modal_refund_partial_title') : t('modal_close_title');
  const isDestructive = mode === 'close_dispute';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-[420px] animate-fade-in-up overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-2xl dark:border-[#1E2E18] dark:bg-[#0F1A0C]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
          <h2 className="text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]">{title}</h2>
          <button type="button" onClick={onClose} disabled={busy}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#BBBBAA] transition-colors hover:bg-[#F0EDE6] hover:text-foreground/70 dark:hover:bg-[#1A2A14]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {mode === 'refund_full' && (
            <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-[#9A9A8A]">{t('modal_refund_full_hint')}</p>
          )}

          {mode === 'refund_partial' && (
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('modal_amount_label')}</label>
              <div className={`flex items-center overflow-hidden rounded-lg border transition-all ${error ? 'border-red-400' : 'border-[#D8D4C8] focus-within:border-[#DDAF3B] focus-within:shadow-[0_0_0_3px_rgba(221, 175, 59,0.10)] dark:border-[#001A05] dark:focus-within:border-[#DDAF3B]'}`}>
                <input ref={inputRef as React.RefObject<HTMLInputElement>} type="number" min="0.01" step="0.01" max={maxAmount}
                  value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('modal_amount_placeholder')}
                  className="flex-1 bg-transparent px-3 py-2 text-[13px] text-[#001201] outline-none [appearance:textfield] dark:text-[#FFF9EC]" />
                <span className="shrink-0 border-l border-[#E8E4DC] bg-[#F9F8F5] px-3 py-2 text-[12px] font-bold text-foreground/55 dark:border-[#1E2E18] dark:bg-[#131E10]">CAD</span>
              </div>
              {maxAmount !== undefined && (
                <p className="text-[12px] text-[#BBBBAA] dark:text-[#A0A090]">Max : {maxAmount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
              )}
            </div>
          )}

          {mode === 'close_dispute' && (
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('modal_reason_label')}</label>
              <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={500}
                placeholder={t('modal_reason_placeholder')}
                className={`w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-[13px] text-[#001201] outline-none transition-all dark:text-[#FFF9EC] ${error ? 'border-red-400' : 'border-[#D8D4C8] focus:border-[#DDAF3B] focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.10)] dark:border-[#001A05] dark:focus:border-[#DDAF3B]'}`} />
            </div>
          )}

          {error && <p className="mt-2 text-[12px] font-semibold text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
          <button type="button" onClick={onClose} disabled={busy}
            className="rounded-lg border border-[#D8D4C8] px-4 py-2 text-[13px] font-semibold text-foreground/65 transition-colors hover:bg-[#F5F3EE] disabled:opacity-50 dark:border-[#001A05] dark:text-[#9A9A8A]">
            {t('btn_cancel')}
          </button>
          <button type="button" onClick={handleSubmit} disabled={busy}
            className={[
              'rounded-lg px-4 py-2 text-[13px] font-bold text-white transition-colors disabled:opacity-50',
              isDestructive ? 'bg-[#6B7280] hover:bg-[#555]' : 'bg-[#DDAF3B] hover:bg-[#B08A14]',
            ].join(' ')}>
            {busy ? '…' : t('btn_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const MAX_REASON = 300;
const MIN_REASON = 3;
const TEMPLATE_KEYS = ['refuse_template_full', 'refuse_template_planning', 'refuse_template_reschedule'] as const;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="refuse-modal-title">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!loading ? onCancel : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm animate-fade-in overflow-hidden rounded-[16px] bg-white shadow-2xl dark:bg-[#001A05]">
        {/* Top accent */}
        <div className="h-[3px] w-full bg-gradient-to-r from-[#FF383C] to-[#FF7A5A]" />

        <div className="p-6">
          {/* Icon + title */}
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF383C]/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF383C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div>
              <h2 id="refuse-modal-title" className="text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]">{t('refuse_title')}</h2>
              <p className="mt-0.5 text-[12px] text-foreground/70/60 dark:text-[#FFFFF0]/45">{t('refuse_message')}</p>
            </div>
          </div>

          {/* Quick templates */}
          <div className="mb-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/70/50 dark:text-[#FFFFF0]/40">{t('templates_label')}</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setReason(t(key).slice(0, MAX_REASON))}
                  disabled={loading}
                  className="rounded-full border border-[#DDD9CC] bg-[#F5F4EE] px-3 py-1.5 text-[12px] font-semibold text-foreground/70 transition-colors hover:border-[#FF383C]/50 hover:text-[#FF383C] disabled:opacity-50 dark:border-[#001A05] dark:bg-dark-bg dark:text-[#FFFFF0]/60"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>

          {/* Reason textarea (required) */}
          <div>
            <label htmlFor="refusal-reason" className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-foreground/70/50 dark:text-[#FFFFF0]/40">
              {t('refuse_reason_label')}
            </label>
            <textarea
              id="refusal-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
              rows={3}
              maxLength={MAX_REASON}
              disabled={loading}
              placeholder={t('refuse_reason_placeholder')}
              aria-invalid={!!error}
              aria-describedby={error ? 'refuse-modal-error' : undefined}
              className="w-full resize-none rounded-[10px] border border-[#DDD9CC] bg-[#F5F4EE] px-3.5 py-2.5 text-[13px] text-[#001201] outline-none transition-all duration-150 focus:border-[#FF383C]/60 focus:ring-2 focus:ring-[#FF383C]/10 dark:border-[#001A05] dark:bg-dark-bg dark:text-[#FFF9EC] placeholder:text-foreground/70/30 dark:placeholder:text-[#FFFFF0]/20 disabled:opacity-50"
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] text-foreground/70/30 dark:text-[#FFFFF0]/20">
                {reason.length === 0 ? t('refuse_reason_hint') : ''}
              </span>
              <span className="text-[11px] text-foreground/70/30 dark:text-[#FFFFF0]/20">
                {reason.length}/{MAX_REASON}
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div id="refuse-modal-error" role="alert" className="mt-3 rounded-[8px] bg-[#FEF2F2] px-3 py-2 text-[12px] font-medium text-[#FF383C] dark:bg-[#2A0A0A]">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-[10px] border border-[#DDD9CC] py-2.5 text-[13px] font-bold text-foreground/70/70 transition-colors hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-[#001A05] dark:text-[#FFFFF0]/50 dark:hover:bg-[#182214]"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="button"
              onClick={() => onConfirm(reason.trim())}
              disabled={loading || reason.trim().length < MIN_REASON}
              className="flex-1 rounded-[10px] bg-[#FF383C] py-2.5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#D43D22] hover:shadow-md disabled:opacity-60"
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
    </div>
  );
}

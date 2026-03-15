'use client';

import { useEffect, useRef } from 'react';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'default';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const CONFIRM_COLORS: Record<ConfirmDialogVariant, string> = {
  danger:  'bg-[#EF4444] text-white hover:bg-[#DC2626]',
  warning: 'bg-[#FF8800] text-white hover:bg-[#E07700]',
  default: 'bg-[#C49A1E] text-[#0C1209] hover:opacity-90',
};

const ICON: Record<ConfirmDialogVariant, { path: string; color: string }> = {
  danger: {
    path: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18',
    color: 'text-[#EF4444]',
  },
  warning: {
    path: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    color: 'text-[#FF8800]',
  },
  default: {
    path: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'text-[#C49A1E]',
  },
};

/**
 * Accessible confirmation dialog. Replaces all window.confirm() usage.
 * Supports danger / warning / default variants.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  /* Focus cancel button on open (safer default) */
  useEffect(() => {
    if (open) setTimeout(() => cancelRef.current?.focus(), 30);
  }, [open]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const { path, color } = ICON[variant];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      aria-modal="true"
      role="alertdialog"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-[340px] rounded-xl border border-[#E8E4DC] bg-white shadow-2xl dark:border-[#1A2A14] dark:bg-[#182214] animate-fade-in-up">
        <div className="flex flex-col items-center gap-3 px-6 pb-5 pt-6 text-center">
          {/* Icon */}
          <div className={`flex h-11 w-11 items-center justify-center rounded-full ${
            variant === 'danger'  ? 'bg-[#FEF2F2] dark:bg-[#2A0A0A]' :
            variant === 'warning' ? 'bg-[#FFF7ED] dark:bg-[#2A1A00]' :
            'bg-[#FDF8EC] dark:bg-[#1A1A08]'
          }`}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={color}>
              <path strokeLinecap="round" strokeLinejoin="round" d={path} />
            </svg>
          </div>

          {/* Text */}
          <div>
            <div className="text-[15px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{title}</div>
            <div className="mt-1 text-[13px] leading-snug text-[#888] dark:text-[#6A6A5A]">{message}</div>
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14]">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-[10px] border border-[#D8D4C8] py-2.5 text-[13px] font-medium text-[#5A5A4A] transition-opacity hover:opacity-70 disabled:opacity-40 dark:border-[#243020] dark:text-[#9A9A8A]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] py-2.5 text-[13px] font-bold transition-all disabled:opacity-50 ${CONFIRM_COLORS[variant]}`}
          >
            {loading && (
              <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

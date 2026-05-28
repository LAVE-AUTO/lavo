'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  clientName: string;
  onSubmit: (code: string) => Promise<{ ok: boolean; reason?: 'invalid_code' | 'generic' }>;
}

const CODE_LENGTH = 6;

export function StartServiceModal({ open, onClose, clientName, onSubmit }: Props) {
  const t = useTranslations('station_dashboard');
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const reset = useCallback(() => {
    setDigits(Array(CODE_LENGTH).fill(''));
    setError(null);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reset();
    const id = window.setTimeout(() => inputsRef.current[0]?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, reset]);

  function setDigitAt(idx: number, value: string) {
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  function handleChange(idx: number, raw: string) {
    setError(null);
    /* sanitize: keep only digits + uppercase letters; tolerate paste */
    const clean = raw.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
    if (clean.length === 0) {
      setDigitAt(idx, '');
      return;
    }
    if (clean.length > 1) {
      /* Paste handling: distribute across cells starting from idx */
      const chars = clean.slice(0, CODE_LENGTH - idx).split('');
      setDigits((prev) => {
        const next = [...prev];
        chars.forEach((c, i) => { next[idx + i] = c; });
        return next;
      });
      const targetIdx = Math.min(idx + chars.length, CODE_LENGTH - 1);
      window.setTimeout(() => inputsRef.current[targetIdx]?.focus(), 0);
      return;
    }
    setDigitAt(idx, clean);
    if (idx < CODE_LENGTH - 1) inputsRef.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && digits[idx] === '' && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) inputsRef.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < CODE_LENGTH - 1) inputsRef.current[idx + 1]?.focus();
    if (e.key === 'Enter') void submit();
  }

  async function submit() {
    const code = digits.join('');
    if (code.length !== CODE_LENGTH) {
      setError(t('start_modal_error_incomplete'));
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await onSubmit(code);
    if (!result.ok) {
      setError(result.reason === 'invalid_code' ? t('start_modal_error_invalid') : t('start_modal_error_generic'));
      setSubmitting(false);
      /* Clear cells and refocus first for a fast retry */
      setDigits(Array(CODE_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
      return;
    }
    setSubmitting(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="md" title={t('start_modal_title')}>
      <div className="space-y-4 pb-2">
        <p className="text-[13px] text-foreground/65 dark:text-[#A0A090]">
          {t('start_modal_subtitle', { name: clientName })}
        </p>

        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={(e) => {
                const txt = e.clipboardData.getData('text');
                if (txt.length > 1) {
                  e.preventDefault();
                  handleChange(i, txt);
                }
              }}
              aria-label={t('start_modal_digit_label', { n: i + 1 })}
              className={`h-14 w-11 rounded-xl border bg-white text-center text-[24px] font-black uppercase tabular-nums tracking-wider text-[#1A1A0A] outline-none transition-all dark:bg-[#0F1A0C] dark:text-[#F0EDD4] ${
                error
                  ? 'border-[#E8472A] focus:border-[#E8472A] focus:ring-2 focus:ring-[#E8472A]/30'
                  : d
                    ? 'border-[#C49A1E] focus:border-[#C49A1E] focus:ring-2 focus:ring-[#C49A1E]/30'
                    : 'border-[#E0DCD0] focus:border-[#C49A1E] focus:ring-2 focus:ring-[#C49A1E]/30 dark:border-[#243020]'
              }`}
            />
          ))}
        </div>

        {error && (
          <div role="alert" className="text-center text-[12px] font-bold text-[#E8472A]">
            {error}
          </div>
        )}

        <p className="text-center text-[11px] text-[#999] dark:text-[#5A5A4A]">
          {t('start_modal_hint')}
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-[#E0DCD0] pt-3 dark:border-[#1A2A14]">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-lg border border-[#E0DCD0] px-4 py-2 text-[13px] font-bold text-foreground/65 transition-colors hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-[#243020] dark:text-[#A0A090] dark:hover:bg-[#1A2A14]"
        >
          {t('btn_cancel')}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || digits.join('').length !== CODE_LENGTH}
          className="rounded-lg bg-[#C49A1E] px-5 py-2 text-[13px] font-black text-[#0C1209] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? t('start_modal_submitting') : t('start_modal_confirm')}
        </button>
      </div>
    </Modal>
  );
}

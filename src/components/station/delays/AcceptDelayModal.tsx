'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const MAX_MESSAGE = 300;
const MIN_MESSAGE = 3;
const MINUTE_OPTIONS = [15, 30, 45, 60] as const;
const TEMPLATE_KEYS = ['accept_template_ok', 'accept_template_hold', 'accept_template_drive'] as const;

interface AcceptDelayModalProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  onConfirm: (message: string, maxMinutes: number | null) => void;
  onCancel: () => void;
}

/**
 * Station modal to accept a client delay request. Requires a message shown to the
 * client and lets the station set an optional maximum tolerated delay (minutes).
 */
export function AcceptDelayModal({ open, loading, error, onConfirm, onCancel }: AcceptDelayModalProps) {
  const t = useTranslations('station_delays');
  const [message, setMessage] = useState('');
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);

  if (!open) return null;

  const canConfirm = message.trim().length >= MIN_MESSAGE && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="accept-modal-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!loading ? onCancel : undefined} aria-hidden="true" />

      <div className="relative w-full max-w-sm animate-fade-in overflow-hidden rounded-[16px] bg-white shadow-2xl dark:bg-[#001A05]">
        <div className="h-[3px] w-full bg-gradient-to-r from-[#0E8C45] to-[#2ECC71]" />

        <div className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2ECC71]/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E8C45" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <h2 id="accept-modal-title" className="text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]">{t('accept_title')}</h2>
              <p className="mt-0.5 text-[12px] text-foreground/60 dark:text-[#FFFFF0]/45">{t('accept_subtitle')}</p>
            </div>
          </div>

          {/* Quick templates */}
          <div className="mb-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/50 dark:text-[#FFFFF0]/40">{t('templates_label')}</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMessage(t(key).slice(0, MAX_MESSAGE))}
                  disabled={loading}
                  className="rounded-full border border-[#DDD9CC] bg-[#F5F4EE] px-3 py-1.5 text-[12px] font-semibold text-foreground/70 transition-colors hover:border-[#2ECC71]/50 hover:text-[#0E8C45] disabled:opacity-50 dark:border-[#001A05] dark:bg-dark-bg dark:text-[#FFFFF0]/60"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>

          {/* Message (required) */}
          <div>
            <label htmlFor="accept-message" className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-foreground/50 dark:text-[#FFFFF0]/40">
              {t('accept_message_label')}
            </label>
            <textarea
              id="accept-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
              rows={3}
              maxLength={MAX_MESSAGE}
              disabled={loading}
              placeholder={t('accept_message_placeholder')}
              className="w-full resize-none rounded-[10px] border border-[#DDD9CC] bg-[#F5F4EE] px-3.5 py-2.5 text-[13px] text-[#001201] outline-none transition-all duration-150 focus:border-[#2ECC71]/60 focus:ring-2 focus:ring-[#2ECC71]/10 disabled:opacity-50 dark:border-[#001A05] dark:bg-dark-bg dark:text-[#FFF9EC]"
            />
            <div className="mt-1 text-right text-[11px] text-foreground/40 dark:text-[#FFFFF0]/20">{message.length}/{MAX_MESSAGE}</div>
          </div>

          {/* Max tolerated delay (optional) */}
          <div className="mt-3">
            <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-foreground/50 dark:text-[#FFFFF0]/40">
              {t('accept_minutes_label')}
            </p>
            <div className="flex flex-wrap gap-2">
              {MINUTE_OPTIONS.map((m) => {
                const selected = maxMinutes === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMaxMinutes(selected ? null : m)}
                    disabled={loading}
                    aria-pressed={selected}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors disabled:opacity-50 ${
                      selected
                        ? 'border-[#0E8C45] bg-[#2ECC71]/15 text-[#0E8C45]'
                        : 'border-[#DDD9CC] bg-[#F5F4EE] text-foreground/70 hover:border-[#2ECC71]/40 dark:border-[#001A05] dark:bg-dark-bg dark:text-[#FFFFF0]/60'
                    }`}
                  >
                    {t('accept_minutes_value', { minutes: m })}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-foreground/40 dark:text-[#FFFFF0]/25">{t('accept_minutes_hint')}</p>
          </div>

          {error && (
            <div role="alert" className="mt-3 rounded-[8px] bg-[#FEF2F2] px-3 py-2 text-[12px] font-medium text-[#FF383C] dark:bg-[#2A0A0A]">
              {error}
            </div>
          )}

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-[10px] border border-[#DDD9CC] py-2.5 text-[13px] font-bold text-foreground/70 transition-colors hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-[#001A05] dark:text-[#FFFFF0]/50 dark:hover:bg-[#182214]"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="button"
              onClick={() => onConfirm(message.trim(), maxMinutes)}
              disabled={!canConfirm}
              className="flex-1 rounded-[10px] bg-[#0E8C45] py-2.5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0B7A3C] hover:shadow-md disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {t('btn_accept')}
                </span>
              ) : t('btn_accept')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { deleteWithApi } from '@/services';

interface StationData {
  id: string;
  name: string;
  city?: string | null;
}

interface Props {
  open:      boolean;
  station:   StationData | null;
  onClose:   () => void;
  onDeleted: (stationId: string, permanent: boolean) => void;
}

// The hard-delete confirmation word — user must type this exactly.
const CONFIRM_WORD = 'SUPPRIMER';

/**
 * Confirmation dialog for deleting a station.
 *
 * Soft delete: sets status to 'disabled' (orange action).
 * Hard delete: permanently removes the row. Requires typing SUPPRIMER (red action).
 */
export function AdminDeleteStationModal({ open, station, onClose, onDeleted }: Props) {
  const t = useTranslations('admin_delete_station');

  const [mode,        setMode]        = useState<'soft' | 'hard'>('soft');
  const [confirmText, setConfirmText] = useState('');
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    if (open) {
      setMode('soft');
      setConfirmText('');
      setBusy(false);
      setError('');
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [busy, onClose]);

  async function handleConfirm() {
    if (!station) return;
    if (mode === 'hard' && confirmText !== CONFIRM_WORD) return;

    setBusy(true);
    setError('');
    try {
      const permanent = mode === 'hard';
      const [ok, data] = await deleteWithApi(`/admin/stations/${station.id}?permanent=${permanent}`);
      if (ok) {
        onDeleted(station.id, permanent);
        onClose();
      } else {
        const errData = data as { message?: string };
        setError(errData?.message ?? t('error_generic'));
      }
    } catch {
      setError(t('error_generic'));
    } finally {
      setBusy(false);
    }
  }

  if (!open || !station) return null;

  const hardReady = confirmText === CONFIRM_WORD;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />

      <div className="relative z-10 w-full max-w-[440px] animate-fade-in-up overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-2xl dark:border-[#1E2E18] dark:bg-[#0F1A0C]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
          <h2 className="text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]">{t('modal_title')}</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('btn_cancel')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#BBBBAA] transition-colors hover:bg-[#F0EDE6] hover:text-foreground/70 disabled:opacity-40 dark:hover:bg-[#1A2A14]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-6 py-5">

          {/* Target station info */}
          <div className="flex items-center gap-3 rounded-xl bg-[#F5F3EE] px-4 py-3 dark:bg-[#131E10]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DDAF3B]/12 text-[12px] font-black text-[#DDAF3B]">
              {station.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{station.name}</p>
              {station.city && <p className="truncate text-[12px] text-foreground/55 dark:text-[#9A9A8A]">{station.city}</p>}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Mode selection */}
          <div className="flex flex-col gap-2">
            {/* Soft delete */}
            <button type="button" onClick={() => { setMode('soft'); setConfirmText(''); }}
              className={[
                'flex items-start gap-3 rounded-xl border-[1.5px] px-4 py-3 text-left transition-all',
                mode === 'soft'
                  ? 'border-[#F97316] bg-orange-50 dark:bg-orange-950/20'
                  : 'border-[#E8E4DC] bg-white hover:border-[#F97316]/50 dark:border-[#1E2E18] dark:bg-[#0F1A0C]',
              ].join(' ')}>
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-[#F97316]">
                {mode === 'soft' && <div className="h-2 w-2 rounded-full bg-[#F97316]" />}
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#F97316]">{t('soft_title')}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-foreground/65 dark:text-[#A0A090]">{t('soft_description')}</p>
              </div>
            </button>

            {/* Hard delete */}
            <button type="button" onClick={() => { setMode('hard'); setConfirmText(''); }}
              className={[
                'flex items-start gap-3 rounded-xl border-[1.5px] px-4 py-3 text-left transition-all',
                mode === 'hard'
                  ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                  : 'border-[#E8E4DC] bg-white hover:border-red-300 dark:border-[#1E2E18] dark:bg-[#0F1A0C]',
              ].join(' ')}>
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-red-500">
                {mode === 'hard' && <div className="h-2 w-2 rounded-full bg-red-500" />}
              </div>
              <div>
                <p className="text-[13px] font-bold text-red-600">{t('hard_title')}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-foreground/65 dark:text-[#A0A090]">{t('hard_description')}</p>
              </div>
            </button>
          </div>

          {/* Hard delete confirmation input */}
          {mode === 'hard' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="delete-station-confirm-input" className="text-[12px] font-bold text-red-600 dark:text-red-400">
                {t('hard_confirm_label', { word: CONFIRM_WORD })}
              </label>
              <input
                id="delete-station-confirm-input"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-red-300 bg-transparent px-3 py-2 text-[13px] font-mono text-red-700 outline-none transition-all placeholder:text-red-300 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)] dark:border-red-900/50 dark:text-red-400"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
          <button type="button" onClick={onClose} disabled={busy}
            className="rounded-lg border border-[#D8D4C8] px-4 py-2 text-[13px] font-semibold text-foreground/65 transition-colors hover:bg-[#F5F3EE] disabled:opacity-50 dark:border-[#001A05] dark:text-[#9A9A8A]">
            {t('btn_cancel')}
          </button>
          {mode === 'soft' ? (
            <button type="button" onClick={handleConfirm} disabled={busy}
              className="rounded-lg bg-orange-500 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed">
              {busy ? '…' : t('btn_soft')}
            </button>
          ) : (
            <button type="button" onClick={handleConfirm} disabled={busy || !hardReady}
              className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
              {busy ? '…' : t('btn_hard')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

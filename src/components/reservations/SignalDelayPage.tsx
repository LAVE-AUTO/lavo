'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { getFromApi, postWithApi } from '@/services/axios-service';
import { STATION_TIMEZONE, utcToStationMinutes } from '@/helpers/station-time';

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

const MAX_MESSAGE = 500;

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type PageState = 'loading' | 'error' | 'already_signaled' | 'form' | 'success';

interface ResInfo {
  stationName: string;
  forfaitName: string;
  dateLabel:   string;
  timeSlot:    string;
}

interface RichEntryResponse {
  data?: {
    entry_type?: 'reservation' | 'queue';
    status?: string;
    slot_start_time?: string | null;
    station?: { name?: string };
    vehicle_format?: { label?: string } | null;
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function SignalDelayPage() {
  const t      = useTranslations('signal_delay');
  const locale = useLocale();
  const id     = useParams().id as string;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [pageState, setPageState]   = useState<PageState>('loading');
  const [res, setRes]               = useState<ResInfo | null>(null);
  const [message, setMessage]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setPageState('loading');

    const [ok, data] = await getFromApi(`/me/entries/${id}`);
    if (!mountedRef.current) return;
    if (!ok) { setPageState('error'); return; }

    const entry = (data as RichEntryResponse)?.data;
    const isReservation = entry?.entry_type === 'reservation';
    const status = entry?.status ?? '';
    /* Mirror the backend SIGNAL_ALLOWED_STATUSES: a delay can be signalled on a
     * confirmed reservation and on not-yet-paid ones (pending / pending_payment,
     * shown as "Confirmé" to the client). in_progress is intentionally excluded. */
    const canSignal = status === 'confirmed' || status === 'pending' || status === 'pending_payment';
    const slotStart = entry?.slot_start_time ? new Date(entry.slot_start_time) : null;

    if (!isReservation || !canSignal || !slotStart || Number.isNaN(slotStart.getTime())) {
      setPageState('error');
      return;
    }

    const slotMinutes = utcToStationMinutes(slotStart);
    setRes({
      stationName: entry?.station?.name ?? '-',
      forfaitName: entry?.vehicle_format?.label ?? '-',
      dateLabel: slotStart.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: STATION_TIMEZONE,
      }),
      timeSlot: `${String(Math.floor(slotMinutes / 60) % 24).padStart(2, '0')}:${String(slotMinutes % 60).padStart(2, '0')}`,
    });
    setPageState('form');
  }, [id, locale]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    const payload: Record<string, unknown> = {};
    if (message.trim()) payload.message = message.trim();

    const [ok, data] = await postWithApi(`/reservations/${id}/signal-delay`, payload);
    if (!mountedRef.current) return;
    setSubmitting(false);

    if (ok) {
      setPageState('success');
      return;
    }

    const errData = data as { code?: string; message?: string };
    /* Backend returns 409 CONFLICT for both cases - distinguish them so the
     * "already signaled" page only fires when an active request actually exists. */
    if (errData?.code === 'CONFLICT') {
      const isAlreadySignaled = (errData.message ?? '').toLowerCase().includes('already active');
      setPageState(isAlreadySignaled ? 'already_signaled' : 'error');
    } else {
      setPageState('error');
    }
  };

  /* ---- Non-form states ---- */
  if (pageState === 'loading') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center pb-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      </main>
    );
  }

  if (pageState === 'error') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6 pb-20">
        <div className="flex flex-col items-center text-center gap-4 max-w-xs w-full">
          <div className="w-16 h-16 rounded-full bg-Hurryline-error/15 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF383C" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-[20px] font-black text-foreground">{t('error_load')}</h2>
          <button
            type="button"
            onClick={loadData}
            className="rounded-[10px] border border-gold/50 px-4 py-2 text-[13px] font-semibold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
          >
            {t('btn_retry')}
          </button>
        </div>
      </main>
    );
  }

  if (pageState === 'already_signaled') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6 pb-20">
        <div className="flex flex-col items-center text-center gap-4 max-w-xs w-full">
          <div className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="text-[20px] font-black text-foreground">{t('already_signaled_title')}</h2>
          <p className="text-[14px] text-foreground/70 leading-relaxed">{t('already_signaled_desc')}</p>
          <Link
            href={`/client/reservations/${id}`}
            className="text-[14px] font-bold text-gold hover:text-gold-hover transition-colors mt-1"
          >
            {t('btn_back')}
          </Link>
        </div>
      </main>
    );
  }

  if (pageState === 'success') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6 pb-20">
        <div className="flex flex-col items-center text-center gap-5 max-w-xs w-full">
          <div className="w-20 h-20 rounded-full bg-Hurryline-success/15 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-[22px] font-black text-foreground">{t('success_title')}</h2>
          <p className="text-[15px] text-foreground/70 leading-relaxed">{t('success_desc')}</p>
          <Link
            href={`/client/reservations/${id}`}
            className="block w-full py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg text-center transition-colors mt-2"
          >
            {t('btn_back_reservation')}
          </Link>
        </div>
      </main>
    );
  }

  /* ---- Form ---- */
  return (
    <main className="min-h-screen bg-background pb-24 sm:pb-8">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto">
        <Link
          href={`/client/reservations/${id}`}
          className="inline-flex items-center gap-2 text-[14px] font-bold text-gold hover:text-gold-hover transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t('btn_back')}
        </Link>
        <h1 className="text-[22px] font-black text-foreground mt-3">{t('page_title')}</h1>
        <p className="text-[14px] text-foreground/65 mt-1">{t('subtitle')}</p>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4">
        {/* Warning banner */}
        <div className="flex gap-3 bg-Hurryline-error/10 border border-Hurryline-error/25 rounded-xl px-4 py-3.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF383C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-[13px] font-semibold text-Hurryline-error leading-relaxed">{t('warning')}</p>
        </div>

        {/* Reservation recap */}
        {res && (
          <div className="bg-surface rounded-xl border border-border p-4 space-y-2">
            <p className="text-[15px] font-black text-foreground">{res.stationName}</p>
            <p className="text-[13px] text-foreground/65">{res.forfaitName}</p>
            <div className="flex items-center gap-3 text-[13px] text-foreground/70">
              <span className="flex items-center gap-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {res.dateLabel}
              </span>
              <span className="flex items-center gap-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="font-bebas text-[15px] tracking-wide">{res.timeSlot}</span>
              </span>
            </div>
          </div>
        )}

        {/* Optional message */}
        <div className="bg-surface rounded-xl border border-border p-5">
          <label
            htmlFor="delay-message"
            className="block text-[15px] font-black text-foreground mb-1"
          >
            {t('message_label')}
          </label>
          <p className="text-[13px] text-[#999] dark:text-foreground/55 mb-3">{t('message_hint')}</p>

          {/* Pre-written quick messages — one tap fills the field. */}
          <div className="mb-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/55">{t('templates_label')}</p>
            <div className="flex flex-wrap gap-2">
              {(['template_traffic', 'template_15', 'template_soon'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMessage(t(key).slice(0, MAX_MESSAGE))}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-foreground/70 transition-colors hover:border-gold/50 hover:text-gold cursor-pointer"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>

          <textarea
            id="delay-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
            placeholder={t('message_placeholder')}
            rows={3}
            className="w-full bg-white/60 dark:bg-background/50 border border-border rounded-[10px] px-4 py-3 text-[14px] text-foreground placeholder-[#AAA] dark:placeholder-[#666] resize-none focus:outline-none focus:border-gold/60 transition-colors"
          />
          <p className="text-[12px] text-[#999] dark:text-foreground/55 text-right mt-1">
            {message.length}/{MAX_MESSAGE}
          </p>
        </div>

        {/* Submit */}
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-[10px] bg-Hurryline-error hover:bg-Hurryline-error/90 text-white text-[15px] font-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting && (
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          )}
          {submitting ? t('processing') : t('btn_submit')}
        </button>
      </div>
    </main>
  );
}

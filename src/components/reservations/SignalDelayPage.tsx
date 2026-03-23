'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { postWithApi } from '@/services/axios-service';
import { RESERVATIONS_MOCK_ENABLED, findMockReservation } from '@/data/reservations-mock';

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

    // TODO: remove mock block once booking flow is connected to Stripe
    if (RESERVATIONS_MOCK_ENABLED) {
      const mock = findMockReservation(id);
      if (!mock || mock.status !== 'confirmed') { setPageState('error'); return; }
      const d = new Date(`${mock.date}T${mock.timeSlot}`);
      setRes({
        stationName: mock.stationName,
        forfaitName: mock.forfaitName,
        dateLabel:   d.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
          weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
        }),
        timeSlot: mock.timeSlot,
      });
      setPageState('form');
      return;
    }

    // TODO: connect to API once GET /me/entries/:id is available
    // GET /me/entries/:id — verify status === 'confirmed' or 'in_progress'
    setPageState('error');
  }, [id, locale]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    // TODO: remove mock block once booking flow is connected to Stripe
    if (RESERVATIONS_MOCK_ENABLED) {
      await new Promise((r) => setTimeout(r, 700));
      if (!mountedRef.current) return;
      setSubmitting(false);
      setPageState('success');
      return;
    }

    const payload: Record<string, unknown> = {};
    if (message.trim()) payload.message = message.trim();

    const [ok, data] = await postWithApi(`/reservations/${id}/signal-delay`, payload);
    if (!mountedRef.current) return;
    setSubmitting(false);

    if (ok) {
      setPageState('success');
      return;
    }

    const errData = data as { code?: string };
    if (errData?.code === 'CONFLICT') {
      setPageState('already_signaled');
    } else {
      setPageState('error');
    }
  };

  /* ---- Non-form states ---- */
  if (pageState === 'loading') {
    return (
      <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] flex items-center justify-center pb-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      </main>
    );
  }

  if (pageState === 'error') {
    return (
      <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] flex items-center justify-center p-6 pb-20">
        <div className="flex flex-col items-center text-center gap-4 max-w-xs w-full">
          <div className="w-16 h-16 rounded-full bg-lavo-error/15 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8472A" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-[20px] font-black text-[#0A0A14] dark:text-white">{t('error_load')}</h2>
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
      <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] flex items-center justify-center p-6 pb-20">
        <div className="flex flex-col items-center text-center gap-4 max-w-xs w-full">
          <div className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#af8408" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="text-[20px] font-black text-[#0A0A14] dark:text-white">{t('already_signaled_title')}</h2>
          <p className="text-[14px] text-[#555] dark:text-[#B0B0A0] leading-relaxed">{t('already_signaled_desc')}</p>
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
      <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] flex items-center justify-center p-6 pb-20">
        <div className="flex flex-col items-center text-center gap-5 max-w-xs w-full">
          <div className="w-20 h-20 rounded-full bg-lavo-success/15 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-[22px] font-black text-[#0A0A14] dark:text-white">{t('success_title')}</h2>
          <p className="text-[15px] text-[#555] dark:text-[#B0B0A0] leading-relaxed">{t('success_desc')}</p>
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
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] pb-24 sm:pb-8">
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
        <h1 className="text-[22px] font-black text-[#0A0A14] dark:text-white mt-3">{t('page_title')}</h1>
        <p className="text-[14px] text-[#666] dark:text-[#B0B0A0] mt-1">{t('subtitle')}</p>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4">
        {/* Warning banner */}
        <div className="flex gap-3 bg-lavo-error/10 border border-lavo-error/25 rounded-xl px-4 py-3.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8472A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-[13px] font-semibold text-lavo-error leading-relaxed">{t('warning')}</p>
        </div>

        {/* Reservation recap */}
        {res && (
          <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-4 space-y-2">
            <p className="text-[15px] font-black text-[#0A0A14] dark:text-white">{res.stationName}</p>
            <p className="text-[13px] text-[#666] dark:text-[#B0B0A0]">{res.forfaitName}</p>
            <div className="flex items-center gap-3 text-[13px] text-[#555] dark:text-[#B0B0A0]">
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
                {res.timeSlot}
              </span>
            </div>
          </div>
        )}

        {/* Optional message */}
        <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-5">
          <label
            htmlFor="delay-message"
            className="block text-[15px] font-black text-[#0A0A14] dark:text-white mb-1"
          >
            {t('message_label')}
          </label>
          <p className="text-[13px] text-[#999] dark:text-[#888] mb-4">{t('message_hint')}</p>
          <textarea
            id="delay-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
            placeholder={t('message_placeholder')}
            rows={3}
            className="w-full bg-white/60 dark:bg-dark-bg/50 border border-[#D0D0C0] dark:border-tab-inactive rounded-[10px] px-4 py-3 text-[14px] text-[#0A0A14] dark:text-white placeholder-[#AAA] dark:placeholder-[#666] resize-none focus:outline-none focus:border-gold/60 transition-colors"
          />
          <p className="text-[12px] text-[#999] dark:text-[#888] text-right mt-1">
            {message.length}/{MAX_MESSAGE}
          </p>
        </div>

        {/* Submit */}
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-[10px] bg-lavo-error hover:bg-lavo-error/90 text-white text-[15px] font-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

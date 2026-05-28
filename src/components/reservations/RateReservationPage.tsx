'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { getFromApi, postWithApi } from '@/services/axios-service';

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

const MAX_COMMENT = 500;

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type PageState = 'loading' | 'error' | 'already_rated' | 'expired' | 'form' | 'success';

interface ResInfo {
  stationId:   string;
  stationName: string;
  forfaitName: string;
  dateLabel:   string;
}

interface ApiEntry {
  id: string; entry_type: string; status: string;
  station_id: string; vehicle_format_id: string | null; time_slot_id: string | null;
}

interface ApiStation {
  id: string; name: string;
  vehicleFormats: Array<{ id: string; label: string }>;
  timeSlots: Array<{ id: string; start_time: string }>;
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function RateReservationPage() {
  const t      = useTranslations('rating');
  const locale = useLocale();
  const id     = useParams().id as string;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [pageState, setPageState]   = useState<PageState>('loading');
  const [res, setRes]               = useState<ResInfo | null>(null);
  const [score, setScore]           = useState(0);
  const [hovered, setHovered]       = useState(0);
  const [comment, setComment]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setPageState('loading');

    const [entriesOk, entriesData] = await getFromApi('/me/entries?per_page=100');
    if (!mountedRef.current) return;
    if (!entriesOk) { setPageState('error'); return; }

    const entries: ApiEntry[] = (entriesData as { data: { entries: ApiEntry[] } })?.data?.entries ?? [];
    const entry = entries.find((e) => e.id === id && e.entry_type === 'reservation');
    if (!entry) { setPageState('error'); return; }
    if (entry.status !== 'completed') { setPageState('error'); return; }

    const [stationOk, stationData] = await getFromApi(`/stations/${entry.station_id}`);
    if (!mountedRef.current) return;
    if (!stationOk) { setPageState('error'); return; }

    const station = (stationData as { data: ApiStation }).data;
    const format = station.vehicleFormats.find((f) => f.id === entry.vehicle_format_id);
    const slot = station.timeSlots.find((s) => s.id === entry.time_slot_id);
    const slotDate = slot ? new Date(slot.start_time) : null;

    setRes({
      stationId:   station.id,
      stationName: station.name,
      forfaitName: format?.label ?? '-',
      dateLabel:   slotDate
        ? slotDate.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
            weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
          })
        : '-',
    });
    setPageState('form');
  }, [id, locale]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    if (score === 0 || submitting) return;
    setSubmitting(true);

    const payload: Record<string, unknown> = { reservation_id: id, score };
    if (comment.trim()) payload.comment = comment.trim();
    const [ok] = await postWithApi('/ratings', payload);
    if (!mountedRef.current) return;
    setSubmitting(false);
    if (ok) setPageState('success');
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
      <StatusView
        icon="error"
        title={t('error_load')}
        action={
          <button
            type="button"
            onClick={loadData}
            className="mt-3 rounded-[10px] border border-gold/50 px-4 py-2 text-[13px] font-semibold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
          >
            {t('btn_retry')}
          </button>
        }
      />
    );
  }
  if (pageState === 'already_rated') {
    return (
      <StatusView
        icon="check"
        title={t('already_rated_title')}
        desc={t('already_rated_desc')}
        backHref="/client/reservations"
        backLabel={t('btn_back_reservations')}
      />
    );
  }
  if (pageState === 'expired') {
    return (
      <StatusView
        icon="clock"
        title={t('expired_title')}
        desc={t('expired_desc')}
        backHref="/client/reservations"
        backLabel={t('btn_back_reservations')}
      />
    );
  }
  if (pageState === 'success') {
    return <SuccessView stationId={res?.stationId ?? ''} />;
  }

  const display    = hovered > 0 ? hovered : score;
  const starLabels = ['', t('star_1'), t('star_2'), t('star_3'), t('star_4'), t('star_5')];

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
        {/* Reservation recap */}
        {res && (
          <div className="bg-surface rounded-xl border border-border p-4 space-y-1">
            <p className="text-[15px] font-black text-foreground">{res.stationName}</p>
            <p className="text-[13px] text-foreground/65">{res.forfaitName}</p>
            <p className="text-[13px] text-[#999] dark:text-foreground/55">{res.dateLabel}</p>
          </div>
        )}

        {/* Star selector */}
        <div className="bg-surface rounded-xl border border-border p-5">
          <p className="text-[15px] font-black text-foreground mb-1">{t('score_label')}</p>
          <p className="text-[13px] text-[#999] dark:text-foreground/55 mb-5">{t('score_hint')}</p>
          <div
            className="flex items-center gap-2 justify-center"
            role="group"
            aria-label={t('score_label')}
            onMouseLeave={() => setHovered(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={starLabels[n]}
                aria-pressed={score === n}
                onClick={() => setScore(n)}
                onMouseEnter={() => setHovered(n)}
                className="cursor-pointer transition-transform hover:scale-110 active:scale-95 p-1"
              >
                <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    fill={n <= display ? '#DDAF3B' : 'none'}
                    stroke="#DDAF3B"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition: 'fill 0.1s' }}
                  />
                </svg>
              </button>
            ))}
          </div>
          <p className="text-center text-[14px] font-bold text-gold mt-3 h-5">
            {display > 0 ? starLabels[display] : ''}
          </p>
        </div>

        {/* Comment */}
        <div className="bg-surface rounded-xl border border-border p-5">
          <label
            htmlFor="rating-comment"
            className="block text-[15px] font-black text-foreground mb-3"
          >
            {t('comment_label')}
          </label>
          <textarea
            id="rating-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
            placeholder={t('comment_placeholder')}
            rows={4}
            className="w-full bg-white/60 dark:bg-background/50 border border-border rounded-[10px] px-4 py-3 text-[14px] text-foreground placeholder-[#AAA] dark:placeholder-[#666] resize-none focus:outline-none focus:border-gold/60 transition-colors"
          />
          <p className="text-[12px] text-[#999] dark:text-foreground/55 text-right mt-1">
            {t('comment_max', { count: comment.length })}
          </p>
        </div>

        {/* Submit */}
        <button
          type="button"
          disabled={score === 0 || submitting}
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-[10px] bg-gold hover:bg-gold-hover text-dark-bg text-[15px] font-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function SuccessView({ stationId }: { stationId: string }) {
  const t = useTranslations('rating');
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
        <div className="flex flex-col gap-3 w-full mt-2">
          {stationId && (
            <Link
              href={`/stations/${stationId}`}
              className="block w-full py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg text-center transition-colors"
            >
              {t('btn_view_station')}
            </Link>
          )}
          <Link
            href="/client/reservations"
            className="block w-full py-3 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 text-center transition-colors"
          >
            {t('btn_back_reservations')}
          </Link>
        </div>
      </div>
    </main>
  );
}

function StatusView({
  icon, title, desc, backHref, backLabel, action,
}: {
  icon:       'error' | 'check' | 'clock';
  title:      string;
  desc?:      string;
  backHref?:  string;
  backLabel?: string;
  action?:    ReactNode;
}) {
  const iconMap: Record<string, ReactNode> = {
    error: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#391C01" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    check: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    clock: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  };
  const bgMap: Record<string, string> = {
    error: 'bg-Hurryline-error/15',
    check: 'bg-Hurryline-success/15',
    clock: 'bg-[#D0D0C0] dark:bg-[#2A2A28]',
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6 pb-20">
      <div className="flex flex-col items-center text-center gap-4 max-w-xs w-full">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${bgMap[icon]}`}>
          {iconMap[icon]}
        </div>
        <h2 className="text-[20px] font-black text-foreground">{title}</h2>
        {desc && <p className="text-[14px] text-foreground/70 leading-relaxed">{desc}</p>}
        {action}
        {backHref && backLabel && (
          <Link href={backHref} className="text-[14px] font-bold text-gold hover:text-gold-hover transition-colors mt-1">
            {backLabel}
          </Link>
        )}
      </div>
    </main>
  );
}

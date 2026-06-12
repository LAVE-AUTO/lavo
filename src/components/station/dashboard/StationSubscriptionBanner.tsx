'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { getFromApi, postWithApi } from '@/services';
import { useToast } from '@/context/toast-context';

type Interval = 'month' | 'year';

interface SubscriptionState {
  billing_model: 'commission' | 'subscription';
  plan_id: string | null;
  subscription: {
    status: string;
    plan_name: string | null;
    interval: string;
    amount: number;
    current_period_end: string | null;
  } | null;
}

/** Statuses that mean the station is currently covered by an active subscription. */
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-CA' : 'fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/**
 * Shown on the station dashboard only when the admin assigned a subscription
 * billing model. Prompts the station to subscribe (Stripe Checkout) when no
 * active subscription covers them, or shows the renewal date when active.
 */
export function StationSubscriptionBanner() {
  const t = useTranslations('station_subscription');
  const locale = useLocale();
  const { success: showSuccess, error: showError } = useToast();
  const searchParams = useSearchParams();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [state, setState] = useState<SubscriptionState | null>(null);
  const [interval, setInterval] = useState<Interval>('month');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [ok, data] = await getFromApi('/station/subscription');
    if (!mountedRef.current) return;
    if (ok) setState((data as { data?: SubscriptionState })?.data ?? null);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Toast feedback after returning from Stripe Checkout. */
  useEffect(() => {
    const result = searchParams.get('subscription');
    if (result === 'success') showSuccess(t('checkout_success'));
    else if (result === 'cancelled') showError(t('checkout_cancelled'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubscribe = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    const [ok, data] = await postWithApi('/station/subscription/checkout', { interval, locale });
    if (!mountedRef.current) return;
    const url = (data as { data?: { url?: string } })?.data?.url;
    if (ok && url) {
      window.location.href = url;
      return;
    }
    setSubmitting(false);
    showError(t('checkout_error'));
  }, [submitting, interval, locale, showError, t]);

  /* Render nothing unless the admin set this station to subscription billing. */
  if (!state || state.billing_model !== 'subscription') return null;

  const sub = state.subscription;
  const isActive = sub != null && ACTIVE_STATUSES.has(sub.status);

  if (isActive && sub) {
    const renewal = formatDate(sub.current_period_end, locale);
    const intervalLabel = sub.interval === 'year' ? t('per_year') : t('per_month');
    return (
      <div className="shrink-0 border-b border-[#10B981]/20 bg-[#ECFDF5] px-5 py-3 dark:border-[#10B981]/15 dark:bg-[#0A1F17]">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#10B981]/12">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#047857] dark:text-[#34D399]">
              {t('active_title', { plan: sub.plan_name ?? '' })}
            </p>
            <p className="text-[12px] text-[#065F46] dark:text-[#6EE7B7]">
              ${sub.amount} {intervalLabel}
              {renewal ? ` — ${t('renews_on', { date: renewal })}` : ''}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* Not covered yet (incomplete / past_due / canceled / unpaid / no row). */
  return (
    <div className="shrink-0 border-b border-gold/25 bg-[#FFFBEB] px-5 py-4 dark:border-gold/20 dark:bg-[#211B0A]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#af8408" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#8A6A06] dark:text-[#E3B53D]">{t('subscribe_title')}</p>
            <p className="text-[12px] text-[#7A5E08] dark:text-[#D6AE4A]">{t('subscribe_notice')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gold/30 bg-white/60 p-0.5 dark:bg-black/20" role="group" aria-label={t('interval_label')}>
            <button
              type="button"
              onClick={() => setInterval('month')}
              aria-pressed={interval === 'month'}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${interval === 'month' ? 'bg-gold text-white' : 'text-[#8A6A06] dark:text-[#E3B53D]'}`}
            >
              {t('monthly')}
            </button>
            <button
              type="button"
              onClick={() => setInterval('year')}
              aria-pressed={interval === 'year'}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${interval === 'year' ? 'bg-gold text-white' : 'text-[#8A6A06] dark:text-[#E3B53D]'}`}
            >
              {t('annual')}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={submitting}
            className="btn-shine rounded-lg bg-gold px-4 py-2 text-[12px] font-bold text-white transition hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t('redirecting') : t('subscribe_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}

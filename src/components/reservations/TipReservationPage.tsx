'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getFromApi, postWithApi } from '@/services/axios-service';
import { RESERVATIONS_MOCK_ENABLED, findMockReservation } from '@/data/reservations-mock';

/** Lazy Stripe singleton (deferred until first render to avoid SSR issues). */
let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripePromise() {
  if (stripePromise !== null) return stripePromise;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (key) stripePromise = loadStripe(key);
  return stripePromise;
}

interface RichEntryShape {
  id: string;
  status: string;
  station_id: string;
  station: { name: string | null; address: string | null; city: string | null } | null;
  vehicle_format: { label: string } | null;
  amount_paid: string | null;
  slot_start_time: string | null;
  is_tipped?: boolean;
}

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

const PRESET_AMOUNTS = [2, 5, 10, 15];

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type PageState = 'loading' | 'error' | 'already_tipped' | 'form' | 'pay' | 'success';

interface ResInfo {
  stationId:   string;
  stationName: string;
  forfaitName: string;
  dateLabel:   string;
  totalPrice:  number;
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function TipReservationPage() {
  const t      = useTranslations('tip');
  const locale = useLocale();
  const id     = useParams().id as string;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [pageState, setPageState]   = useState<PageState>('loading');
  const [res, setRes]               = useState<ResInfo | null>(null);
  const [preset, setPreset]         = useState<number | null>(null);
  const [custom, setCustom]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [submitError, setSubmitError]   = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setPageState('loading');

    // TODO: remove mock block once API is available
    if (RESERVATIONS_MOCK_ENABLED) {
      const mock = findMockReservation(id);
      if (!mock || mock.status !== 'completed') { setPageState('error'); return; }
      const d = new Date(`${mock.date}T${mock.timeSlot}`);
      setRes({
        stationId:   mock.stationId,
        stationName: mock.stationName,
        forfaitName: mock.forfaitName,
        dateLabel:   d.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
          weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
        }),
        totalPrice: mock.totalPrice,
      });
      setPageState('form');
      return;
    }

    /* /me/entries returns the rich entry shape with denormalised station +
     * vehicle format + slot times + is_tipped flag, so a single fetch is
     * enough. The endpoint paginates - 100 is well above any realistic count
     * of recent entries for a single client. */
    const [ok, data] = await getFromApi<{ data: { entries: RichEntryShape[] } }>('/me/entries?per_page=100');
    if (!mountedRef.current) return;
    if (!ok || !data || !('data' in data)) { setPageState('error'); return; }

    const entries = (data as { data: { entries: RichEntryShape[] } }).data?.entries ?? [];
    const entry = entries.find((e) => e.id === id);
    if (!entry) { setPageState('error'); return; }
    if (entry.status !== 'completed') { setPageState('error'); return; }
    if (entry.is_tipped) { setPageState('already_tipped'); return; }

    const slotDate = entry.slot_start_time ? new Date(entry.slot_start_time) : new Date(entry.id);
    setRes({
      stationId:   entry.station_id,
      stationName: entry.station?.name ?? '',
      forfaitName: entry.vehicle_format?.label ?? '-',
      dateLabel: Number.isNaN(slotDate.getTime())
        ? ''
        : slotDate.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
            weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
          }),
      totalPrice: parseFloat(entry.amount_paid ?? '0'),
    });
    setPageState('form');
  }, [id, locale]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectPreset = (amount: number) => {
    setPreset(amount);
    setCustom('');
  };

  const handleCustomChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d{0,2}).*/, '$1');
    setCustom(sanitized);
    setPreset(null);
  };

  const resolvedAmount = (): number => {
    if (preset !== null) return preset;
    const parsed = parseFloat(custom);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleSubmit = async () => {
    const amount = resolvedAmount();
    if (amount <= 0 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    if (RESERVATIONS_MOCK_ENABLED) {
      await new Promise((r) => setTimeout(r, 800));
      if (!mountedRef.current) return;
      setSubmitting(false);
      setPageState('success');
      return;
    }

    /* The endpoint creates the tip row and returns a Stripe `clientSecret`.
     * The card payment confirmation happens in the next step (StripeCardForm)
     * so we move the page state to `pay` once the secret is available. */
    const [ok, data] = await postWithApi<{ data: { clientSecret?: string; client_secret?: string } }>(
      `/reservations/${id}/tip`,
      { amount },
    );
    if (!mountedRef.current) return;
    setSubmitting(false);
    if (!ok) {
      const err = data as { code?: string; message?: string } | null;
      if (err?.code === 'TIP_ALREADY_EXISTS') { setPageState('already_tipped'); return; }
      setSubmitError(err?.message ?? t('error_submit'));
      return;
    }
    const payload = (data as { data: { clientSecret?: string; client_secret?: string } }).data;
    const secret = payload?.clientSecret ?? payload?.client_secret ?? null;
    if (!secret) {
      /* Backend acknowledged but no Stripe secret means a free station path -
       * surface success directly. */
      setPageState('success');
      return;
    }
    setClientSecret(secret);
    setPageState('pay');
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
  if (pageState === 'already_tipped') {
    return (
      <StatusView
        icon="check"
        title={t('already_tipped_title')}
        desc={t('already_tipped_desc')}
        backHref="/client/reservations"
        backLabel={t('btn_back_reservations')}
      />
    );
  }
  if (pageState === 'success') {
    return <SuccessView stationId={res?.stationId ?? ''} />;
  }
  if (pageState === 'pay' && clientSecret) {
    return (
      <Elements stripe={getStripePromise()} options={{ clientSecret }}>
        <TipPayStep
          amount={resolvedAmount()}
          clientSecret={clientSecret}
          onBack={() => { setPageState('form'); setClientSecret(null); }}
          onSuccess={() => setPageState('success')}
        />
      </Elements>
    );
  }

  const amount = resolvedAmount();

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
        {/* Reservation recap */}
        {res && (
          <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-4 space-y-1">
            <p className="text-[15px] font-black text-[#0A0A14] dark:text-white">{res.stationName}</p>
            <p className="text-[13px] text-[#666] dark:text-[#B0B0A0]">{res.forfaitName}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[13px] text-[#999] dark:text-[#888]">{res.dateLabel}</p>
              <p className="text-[14px] font-bold text-gold">{res.totalPrice.toFixed(2)}$</p>
            </div>
          </div>
        )}

        {/* Preset amounts */}
        <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-5">
          <p className="text-[15px] font-black text-[#0A0A14] dark:text-white mb-4">{t('amount_label')}</p>
          <div className="grid grid-cols-4 gap-3">
            {PRESET_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => handleSelectPreset(a)}
                className={[
                  'py-3.5 rounded-xl text-[15px] font-black transition-all cursor-pointer',
                  preset === a
                    ? 'bg-gold text-dark-bg shadow-sm scale-[1.03]'
                    : 'bg-[#D8D8C8] dark:bg-dark-surface text-[#0A0A14] dark:text-white hover:bg-gold/20 hover:text-gold border border-[#D0D0C0] dark:border-tab-inactive',
                ].join(' ')}
              >
                {a}$
              </button>
            ))}
          </div>
        </div>

        {/* Custom amount */}
        <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-5">
          <label
            htmlFor="tip-custom"
            className="block text-[15px] font-black text-[#0A0A14] dark:text-white mb-3"
          >
            {t('custom_label')}
          </label>
          <div className="relative">
            <input
              id="tip-custom"
              type="text"
              inputMode="decimal"
              value={custom}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder={t('custom_placeholder')}
              className="w-full bg-white/60 dark:bg-dark-bg/50 border border-[#D0D0C0] dark:border-tab-inactive rounded-[10px] pl-4 pr-10 py-3 text-[15px] font-bold text-[#0A0A14] dark:text-white placeholder-[#AAA] dark:placeholder-[#666] focus:outline-none focus:border-gold/60 transition-colors"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#999] dark:text-[#666]">$</span>
          </div>
        </div>

        {/* Amount preview */}
        {amount > 0 && (
          <div className="flex items-center justify-between bg-gold/10 border border-gold/30 rounded-xl px-4 py-3">
            <p className="text-[14px] font-bold text-[#0A0A14] dark:text-white">{t('amount_preview')}</p>
            <p className="text-[18px] font-black text-gold">{amount.toFixed(2)}$</p>
          </div>
        )}

        {submitError && (
          <p className="text-[13px] text-lavo-error text-center" role="alert">{submitError}</p>
        )}

        {/* Submit */}
        <button
          type="button"
          disabled={amount <= 0 || submitting}
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

        {/* Skip */}
        <div className="text-center pb-2">
          <Link
            href={`/client/reservations/${id}`}
            className="text-[14px] font-semibold text-[#999] dark:text-[#777] hover:text-[#555] dark:hover:text-[#B0B0A0] transition-colors"
          >
            {t('btn_skip')}
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function SuccessView({ stationId }: { stationId: string }) {
  const t = useTranslations('tip');
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
  icon:       'error' | 'check';
  title:      string;
  desc?:      string;
  backHref?:  string;
  backLabel?: string;
  action?:    ReactNode;
}) {
  const iconMap: Record<string, ReactNode> = {
    error: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8472A" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    check: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  };
  const bgMap: Record<string, string> = {
    error: 'bg-lavo-error/15',
    check: 'bg-lavo-success/15',
  };

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] flex items-center justify-center p-6 pb-20">
      <div className="flex flex-col items-center text-center gap-4 max-w-xs w-full">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${bgMap[icon]}`}>
          {iconMap[icon]}
        </div>
        <h2 className="text-[20px] font-black text-[#0A0A14] dark:text-white">{title}</h2>
        {desc && <p className="text-[14px] text-[#555] dark:text-[#B0B0A0] leading-relaxed">{desc}</p>}
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

/**
 * Stripe card payment step for the tip flow. Reuses the same card-element
 * pattern as the booking PaymentStep, scoped to the tip's PaymentIntent.
 */
function TipPayStep({
  amount,
  clientSecret,
  onBack,
  onSuccess,
}: {
  amount: number;
  clientSecret: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations('tip');
  const stripe = useStripe();
  const elements = useElements();
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;
    setProcessing(true);
    setStripeError(null);
    try {
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });
      if (error) {
        setStripeError(error.message ?? t('error_stripe'));
        return;
      }
      onSuccess();
    } catch {
      setStripeError(t('error_stripe'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] pb-24 sm:pb-8">
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[14px] font-bold text-gold hover:text-gold-hover transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t('btn_back')}
        </button>
        <h1 className="text-[22px] font-black text-[#0A0A14] dark:text-white mt-3">{t('pay_title')}</h1>
        <p className="text-[14px] text-[#666] dark:text-[#B0B0A0] mt-1">{t('pay_subtitle')}</p>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4">
        <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-5 space-y-4">
          <div className="flex items-center gap-2">
            <svg width="28" height="18" viewBox="0 0 28 18" fill="none" aria-hidden="true">
              <rect width="28" height="18" rx="3" fill="#635BFF" />
              <text x="5" y="13" fontSize="10" fill="white" fontWeight="bold">S</text>
            </svg>
            <span className="text-[13px] font-bold text-[#555] dark:text-[#A0A090]">{t('payment_secured')}</span>
          </div>
          <div className="rounded-lg border-2 border-[#D0D0C0] dark:border-tab-inactive bg-white dark:bg-dark-bg/40 px-4 py-3">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '15px',
                    color: '#000C1F',
                    '::placeholder': { color: '#BBBBBB' },
                    fontFamily: 'Rajdhani, sans-serif',
                  },
                  invalid: { color: '#E8472A' },
                },
                hidePostalCode: true,
              }}
            />
          </div>
          {stripeError && (
            <p className="text-[13px] text-lavo-error" role="alert">{stripeError}</p>
          )}
        </div>

        <div className="bg-gold/10 border-2 border-gold rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-[14px] font-bold text-[#0A0A14] dark:text-white">{t('amount_preview')}</span>
          <span className="text-[20px] font-black text-gold">{amount.toFixed(2)}$</span>
        </div>

        <button
          type="button"
          onClick={handlePay}
          disabled={!stripe || processing}
          className="w-full py-3.5 rounded-[10px] bg-gold hover:bg-gold-hover text-dark-bg text-[15px] font-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {processing && (
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          )}
          {processing ? t('processing') : t('btn_pay', { amount: amount.toFixed(2) })}
        </button>
      </div>
    </main>
  );
}

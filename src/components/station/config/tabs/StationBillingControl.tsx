'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi, postWithApi, updateWithApi } from '@/services';

interface Plan {
  id: string;
  name: string;
  description: string;
  features: string[];
  monthly_price: number;
  annual_price: number | null;
  is_active: boolean;
}
type BillingModel = 'commission' | 'subscription';
type Interval = 'month' | 'year';

interface SubInfo {
  status: string;
  plan_name: string | null;
  interval: string;
  amount: number;
  current_period_end: string | null;
}
interface BillingState {
  billing_model: BillingModel;
  plan_id: string | null;
  plans: Plan[];
  subscription: SubInfo | null;
}

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-CA' : 'fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

interface Props {
  locked: boolean;
}

/**
 * Station-facing billing control: choose between commission and a subscription
 * plan, pay via Stripe Checkout, or switch back to commission. The admin is
 * notified of any model change (handled server-side). Commission is only waived
 * once the subscription is actually active.
 */
export function StationBillingControl({ locked }: Props) {
  const t = useTranslations('station_config');
  const locale = useLocale();
  const { success, error: showError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [state, setState] = useState<BillingState | null>(null);
  const [model, setModel] = useState<BillingModel>('commission');
  const [planId, setPlanId] = useState<string>('');
  const [interval, setInterval] = useState<Interval>('month');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [ok, data] = await getFromApi('/station/subscription');
    if (!mountedRef.current) return;
    if (ok) {
      const d = (data as { data?: BillingState })?.data ?? null;
      setState(d);
      setModel(d?.billing_model ?? 'commission');
      setPlanId(d?.plan_id ?? d?.plans?.[0]?.id ?? '');
      if (d?.subscription?.interval === 'year') setInterval('year');
    } else {
      showError(t('billing_load_error'));
    }
    setLoading(false);
  }, [showError, t]);
  useEffect(() => { load(); }, [load]);

  const activeSub = state?.subscription && ACTIVE_STATUSES.has(state.subscription.status) ? state.subscription : null;
  const plans = state?.plans ?? [];

  async function switchToCommission() {
    if (submitting) return;
    setSubmitting(true);
    const [ok, data] = await updateWithApi('/station/billing', { model: 'commission' });
    if (!mountedRef.current) return;
    setSubmitting(false);
    if (ok) { success(t('billing_change_success')); await load(); }
    else showError((data as { message?: string })?.message || t('billing_change_error'));
  }

  async function subscribeAndPay() {
    if (submitting) return;
    if (!planId) { showError(t('billing_choose_plan')); return; }
    setSubmitting(true);
    // Record the chosen plan first, then open Checkout. Commission keeps applying
    // until the subscription is actually active.
    const [setOk, setData] = await updateWithApi('/station/billing', { model: 'subscription', plan_id: planId });
    if (!mountedRef.current) return;
    if (!setOk) {
      setSubmitting(false);
      showError((setData as { message?: string })?.message || t('billing_change_error'));
      return;
    }
    const [coOk, coData] = await postWithApi('/station/subscription/checkout', { interval, locale });
    if (!mountedRef.current) return;
    const url = (coData as { data?: { url?: string } })?.data?.url;
    if (coOk && url) { window.location.href = url; return; }
    setSubmitting(false);
    showError(t('billing_checkout_error'));
  }

  const cardBase = 'rounded-2xl border border-separator/25 bg-card-surface p-4 sm:p-6 dark:border-[#1A2A14] dark:bg-[#182214]';

  if (loading) {
    return <div className={`${cardBase} animate-pulse`}><div className="h-4 w-32 rounded bg-[#F0EDE4] dark:bg-dark-bg" /></div>;
  }

  const optionCard = (value: BillingModel, label: string, hint: string) => (
    <button
      type="button"
      onClick={() => setModel(value)}
      aria-pressed={model === value}
      disabled={locked}
      className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors disabled:opacity-60 ${
        model === value ? 'border-[#DDAF3B] bg-[#DDAF3B]/10' : 'border-separator/30 bg-[#FAFAF6] hover:border-[#DDAF3B]/40 dark:border-[#001A05] dark:bg-[#151E12]'
      }`}
    >
      <span className={`text-[13px] font-bold ${model === value ? 'text-[#9A7A13] dark:text-[#DDAF3B]' : 'text-[#001201] dark:text-[#FFF9EC]'}`}>{label}</span>
      <span className="text-[11px] text-foreground/55 dark:text-[#B0BFB1]">{hint}</span>
    </button>
  );

  const selectedPlan = plans.find((p) => p.id === planId);
  const showAnnualToggle = Boolean(selectedPlan?.annual_price);

  return (
    <section className={cardBase}>
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[1.5px] text-[#DDAF3B]">{t('billing_section_title')}</h3>
      <p className="mb-4 text-[12px] leading-snug text-foreground/55 dark:text-[#B0BFB1]">{t('billing_section_hint')}</p>

      {activeSub && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#10B981]/25 bg-[#ECFDF5] p-3 dark:border-[#10B981]/20 dark:bg-[#0A1F17]">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#10B981]/15 text-[#10B981]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
          <div>
            <p className="text-[13px] font-bold text-[#047857] dark:text-[#34D399]">{t('billing_status_active', { plan: activeSub.plan_name ?? '' })}</p>
            <p className="text-[12px] text-[#065F46] dark:text-[#6EE7B7]">
              ${activeSub.amount} {activeSub.interval === 'year' ? t('billing_per_year') : t('billing_per_month')}
              {formatDate(activeSub.current_period_end, locale) ? ` — ${t('billing_renews_on', { date: formatDate(activeSub.current_period_end, locale)! })}` : ''}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {optionCard('commission', t('billing_model_commission'), t('billing_commission_hint'))}
        {optionCard('subscription', t('billing_model_subscription'), t('billing_subscription_hint'))}
      </div>

      {model === 'subscription' && (
        <div className="mt-4">
          {plans.length === 0 ? (
            <p className="rounded-lg border border-[#DDAF3B]/30 bg-[#DDAF3B]/10 px-3 py-2 text-[12px] text-[#7A5A00] dark:text-[#E0C060]">{t('billing_no_plans')}</p>
          ) : (
            <>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-foreground/55 dark:text-[#B0BFB1]">{t('billing_choose_plan')}</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((p) => {
                  const selected = planId === p.id;
                  return (
                    <button key={p.id} type="button" onClick={() => setPlanId(p.id)} aria-pressed={selected} disabled={locked}
                      className={`relative flex flex-col rounded-xl border-2 p-4 text-left transition-all disabled:opacity-60 ${selected ? 'border-[#DDAF3B] bg-[#DDAF3B]/8 shadow-sm' : 'border-separator/30 bg-[#FAFAF6] hover:border-[#DDAF3B]/40 dark:border-[#001A05] dark:bg-[#151E12]'}`}>
                      {selected && (
                        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#DDAF3B] text-[#001201]" aria-hidden="true">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </span>
                      )}
                      <span className="text-[14px] font-black text-[#001201] dark:text-[#FFF9EC]">{p.name}</span>
                      <span className="mt-1 flex items-end gap-1">
                        <span className="text-[22px] font-black leading-none text-[#001201] dark:text-[#FFF9EC]">${p.monthly_price}</span>
                        <span className="mb-0.5 text-[11px] font-semibold text-foreground/55 dark:text-[#B0BFB1]">{t('billing_per_month')}</span>
                      </span>
                      {p.annual_price != null && (
                        <span className="text-[11px] font-semibold text-[#9A7A13] dark:text-[#DDAF3B]">${p.annual_price} {t('billing_per_year')}</span>
                      )}
                      {p.features.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1">
                          {p.features.slice(0, 4).map((f, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[11.5px] text-foreground/70 dark:text-[#B0BFB1]">
                              <svg className="mt-0.5 shrink-0 text-[#16A964]" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </button>
                  );
                })}
              </div>

              {showAnnualToggle && (
                <div className="mt-4 inline-flex rounded-lg border border-[#DDAF3B]/30 bg-[#FAFAF6] p-0.5 dark:bg-[#151E12]" role="group" aria-label={t('billing_interval_label')}>
                  <button type="button" onClick={() => setInterval('month')} aria-pressed={interval === 'month'}
                    className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${interval === 'month' ? 'bg-[#DDAF3B] text-[#001201]' : 'text-foreground/60 dark:text-[#B0BFB1]'}`}>
                    {t('billing_interval_month')}
                  </button>
                  <button type="button" onClick={() => setInterval('year')} aria-pressed={interval === 'year'}
                    className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${interval === 'year' ? 'bg-[#DDAF3B] text-[#001201]' : 'text-foreground/60 dark:text-[#B0BFB1]'}`}>
                    {t('billing_interval_year')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        {model === 'commission' ? (
          <button
            type="button"
            onClick={switchToCommission}
            disabled={locked || submitting || state?.billing_model === 'commission'}
            className="rounded-xl border border-[#DDAF3B] bg-transparent px-5 py-2.5 text-[13px] font-bold text-[#9A7A13] transition-colors hover:bg-[#DDAF3B]/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#DDAF3B]"
          >
            {submitting ? t('billing_saving') : t('billing_switch_commission')}
          </button>
        ) : (
          <button
            type="button"
            onClick={subscribeAndPay}
            disabled={locked || submitting || plans.length === 0}
            className="rounded-xl bg-[#DDAF3B] px-5 py-2.5 text-[13px] font-bold text-[#001201] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? t('billing_redirecting') : t('billing_subscribe_pay')}
          </button>
        )}
      </div>
    </section>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context';
import { getFromApi, updateWithApi } from '@/services';

interface Plan { id: string; name: string; description: string; features: string[]; monthly_price: number; annual_price: number | null; is_active: boolean }
type BillingModel = 'commission' | 'subscription';

/**
 * Admin-side billing model picker for one station: pay via per-transaction
 * commission (default) or a subscription plan. Backed by GET/PUT
 * /admin/stations/:id/billing and GET /admin/subscription-plans.
 */
export function StationBillingSection({ stationId }: { stationId: string }) {
  const t = useTranslations('admin_stations');
  const { success, error: showError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [model, setModel] = useState<BillingModel>('commission');
  const [planId, setPlanId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [[bOk, bData], [pOk, pData]] = await Promise.all([
      getFromApi(`/admin/stations/${stationId}/billing`),
      getFromApi('/admin/subscription-plans'),
    ]);
    if (!mountedRef.current) return;
    if (pOk) setPlans((pData as { data?: Plan[] })?.data ?? []);
    if (bOk) {
      const b = (bData as { data?: { model?: BillingModel; plan_id?: string } })?.data;
      setModel(b?.model === 'subscription' ? 'subscription' : 'commission');
      setPlanId(b?.plan_id ?? '');
    } else {
      showError(t('billing_load_error'));
    }
    setLoading(false);
  }, [stationId, showError, t]);
  useEffect(() => { load(); }, [load]);

  const activePlans = plans.filter((p) => p.is_active);

  async function save() {
    if (model === 'subscription' && !planId) { showError(t('billing_select_plan')); return; }
    setSaving(true);
    const payload = model === 'subscription' ? { model: 'subscription', plan_id: planId } : { model: 'commission' };
    const [ok, data] = await updateWithApi(`/admin/stations/${stationId}/billing`, payload);
    if (!mountedRef.current) return;
    setSaving(false);
    if (ok) success(t('billing_save_success'));
    else showError((data as { message?: string })?.message || t('billing_save_error'));
  }

  const optionCard = (value: BillingModel, label: string, hint: string) => (
    <button
      type="button"
      onClick={() => setModel(value)}
      aria-pressed={model === value}
      className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors ${
        model === value ? 'border-[#DDAF3B] bg-[#DDAF3B]/10' : 'border-separator/30 bg-[#FAFAF6] hover:border-[#DDAF3B]/40 dark:border-[#001A05] dark:bg-[#151E12]'
      }`}
    >
      <span className={`text-[13px] font-bold ${model === value ? 'text-[#9A7A13] dark:text-[#DDAF3B]' : 'text-[#001201] dark:text-[#FFF9EC]'}`}>{label}</span>
      <span className="text-[11px] text-foreground/55 dark:text-[#B0BFB1]">{hint}</span>
    </button>
  );

  return (
    <div className="rounded-2xl border border-separator/25 bg-card-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:bg-[#001A05] dark:ring-white/[0.06]">
      <p className="mb-1 text-[11px] font-black uppercase tracking-[0.15em] text-[#DDAF3B]">{t('billing_title')}</p>
      <p className="mb-4 text-[12px] text-foreground/55 dark:text-[#B0BFB1]">{t('billing_subtitle')}</p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {optionCard('commission', t('billing_model_commission'), t('billing_commission_hint'))}
            {optionCard('subscription', t('billing_model_subscription'), t('billing_subscription_hint'))}
          </div>

          {model === 'subscription' && (
            <div className="mt-4">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-foreground/55 dark:text-[#B0BFB1]">{t('billing_select_plan')}</label>
              {activePlans.length === 0 ? (
                <p className="rounded-lg border border-[#DDAF3B]/30 bg-[#DDAF3B]/10 px-3 py-2 text-[12px] text-[#7A5A00] dark:text-[#E0C060]">{t('billing_no_plans')}</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activePlans.map((p) => {
                    const selected = planId === p.id;
                    return (
                      <button key={p.id} type="button" onClick={() => setPlanId(p.id)} aria-pressed={selected}
                        className={`relative flex flex-col rounded-xl border-2 p-4 text-left transition-all ${selected ? 'border-[#DDAF3B] bg-[#DDAF3B]/8 shadow-sm' : 'border-separator/30 bg-[#FAFAF6] hover:border-[#DDAF3B]/40 dark:border-[#001A05] dark:bg-[#151E12]'}`}>
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
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button type="button" onClick={save} disabled={saving}
              className="rounded-xl bg-[#DDAF3B] px-5 py-2 text-[13px] font-bold text-[#001201] transition-opacity hover:opacity-85 disabled:opacity-50">
              {saving ? t('billing_saving') : t('billing_save')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context';
import { getFromApi, updateWithApi } from '@/services';

interface Plan { id: string; name: string; monthly_price: number; annual_price: number | null; is_active: boolean }
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
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/55 dark:text-[#B0BFB1]">{t('billing_select_plan')}</label>
              {activePlans.length === 0 ? (
                <p className="rounded-lg border border-[#DDAF3B]/30 bg-[#DDAF3B]/10 px-3 py-2 text-[12px] text-[#7A5A00] dark:text-[#E0C060]">{t('billing_no_plans')}</p>
              ) : (
                <select
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="w-full rounded-lg border border-[#D8D4C8] bg-white px-3 py-2 text-[14px] text-[#001201] outline-none focus:border-[#DDAF3B] dark:border-[#001A05] dark:bg-dark-bg dark:text-[#FFF9EC]"
                >
                  <option value="">{t('billing_select_plan')}</option>
                  {activePlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.monthly_price}$/mois{p.annual_price != null ? ` · ${p.annual_price}$/an` : ''}
                    </option>
                  ))}
                </select>
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

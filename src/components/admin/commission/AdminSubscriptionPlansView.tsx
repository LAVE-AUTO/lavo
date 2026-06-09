'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi, updateWithApi } from '@/services';

interface ApiPlan { id: string; name: string; monthly_price: number; annual_price: number | null; is_active: boolean; }
/** Editable shape — prices kept as strings while typing. */
interface FormPlan { id: string; name: string; monthly: string; annual: string; is_active: boolean; }

function toForm(p: ApiPlan): FormPlan {
  return { id: p.id, name: p.name, monthly: String(p.monthly_price), annual: p.annual_price == null ? '' : String(p.annual_price), is_active: p.is_active };
}

function newPlan(): FormPlan {
  return { id: (typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}`), name: '', monthly: '', annual: '', is_active: true };
}

export function AdminSubscriptionPlansView() {
  const t = useTranslations('admin_commission');
  const { success, error: showError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [plans, setPlans] = useState<FormPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [ok, data] = await getFromApi('/admin/subscription-plans');
    if (!mountedRef.current) return;
    if (ok) setPlans(((data as { data?: ApiPlan[] })?.data ?? []).map(toForm));
    else showError(t('sub_load_error'));
    setLoading(false);
  }, [showError, t]);
  useEffect(() => { load(); }, [load]);

  function update(id: string, patch: Partial<FormPlan>) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function add() { setPlans((prev) => [...prev, newPlan()]); }
  function remove(id: string) { setPlans((prev) => prev.filter((p) => p.id !== id)); }

  async function save() {
    for (const p of plans) {
      if (!p.name.trim()) { showError(t('sub_error_name')); return; }
      const m = parseFloat(p.monthly);
      if (!Number.isFinite(m) || m < 0) { showError(t('sub_error_price')); return; }
    }
    setSaving(true);
    const payload = {
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name.trim(),
        monthly_price: Math.round(parseFloat(p.monthly) * 100) / 100,
        annual_price: p.annual.trim() === '' ? null : Math.round(parseFloat(p.annual) * 100) / 100,
        is_active: p.is_active,
      })),
    };
    const [ok, data] = await updateWithApi('/admin/subscription-plans', payload);
    if (!mountedRef.current) return;
    setSaving(false);
    if (ok) { setPlans(((data as { data?: ApiPlan[] })?.data ?? []).map(toForm)); success(t('sub_save_success')); }
    else showError((data as { message?: string })?.message || t('sub_save_error'));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border border-[#D8D4C8] bg-white px-3 py-2 text-[14px] text-[#001201] outline-none transition focus:border-[#DDAF3B] focus:ring-2 focus:ring-[#DDAF3B]/15 dark:border-[#001A05] dark:bg-dark-bg dark:text-[#FFF9EC]';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-foreground/60 dark:text-[#B0BFB1]">{t('sub_subtitle')}</p>
        <button type="button" onClick={add}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#DDAF3B]/50 px-3 py-2 text-[12px] font-bold text-[#9A7A13] transition-colors hover:bg-[#DDAF3B]/10 dark:text-[#DDAF3B]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          {t('sub_add')}
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-separator/40 bg-card-surface p-10 text-center text-[13px] text-foreground/55 dark:border-[#1E2E18] dark:bg-[#131E10] dark:text-[#B0BFB1]">
          {t('sub_empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-2xl border border-separator/25 bg-card-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-[#1E2E18] dark:bg-[#131E10]">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_120px]">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/55 dark:text-[#B0BFB1]">{t('sub_plan_name')}</label>
                  <input className={inputClass} value={p.name} maxLength={80} placeholder={t('sub_plan_name_ph')} onChange={(e) => update(p.id, { name: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/55 dark:text-[#B0BFB1]">{t('sub_monthly')}</label>
                  <input className={inputClass} type="number" min={0} step={0.5} value={p.monthly} placeholder="0" onChange={(e) => update(p.id, { monthly: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/55 dark:text-[#B0BFB1]">{t('sub_annual')}</label>
                  <input className={inputClass} type="number" min={0} step={1} value={p.annual} placeholder="—" onChange={(e) => update(p.id, { annual: e.target.value })} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button type="button" onClick={() => update(p.id, { is_active: !p.is_active })} aria-pressed={p.is_active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide transition-colors ${p.is_active ? 'border-[#22C47A]/40 bg-[#22C47A]/12 text-[#16A964]' : 'border-[#888]/30 bg-[#888]/10 text-foreground/55 dark:text-[#B0BFB1]'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${p.is_active ? 'bg-[#22C47A]' : 'bg-[#888]'}`} aria-hidden="true" />
                  {p.is_active ? t('sub_active') : t('sub_inactive')}
                </button>
                <button type="button" onClick={() => remove(p.id)}
                  className="rounded-lg border border-[#FF2525]/30 bg-[#FF2525]/5 px-2.5 py-1 text-[11px] font-bold text-[#FF2525] transition-colors hover:bg-[#FF2525]/10">
                  {t('sub_remove')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={save} disabled={saving}
          className="rounded-xl bg-[#DDAF3B] px-6 py-2.5 text-[13px] font-bold text-[#001201] transition-opacity hover:opacity-85 disabled:opacity-50">
          {saving ? t('sub_saving') : t('sub_save')}
        </button>
      </div>
    </div>
  );
}

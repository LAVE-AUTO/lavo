'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi, updateWithApi } from '@/services';
import { SubscriptionPlanModal, type PlanFormValue } from './SubscriptionPlanModal';

interface ApiPlan {
  id: string;
  name: string;
  description: string;
  features: string[];
  monthly_price: number;
  annual_price: number | null;
  is_active: boolean;
}

const round = (n: number) => Math.round(n * 100) / 100;

function toForm(p: ApiPlan): PlanFormValue {
  return { id: p.id, name: p.name, description: p.description ?? '', features: p.features ?? [], monthly: String(p.monthly_price), annual: p.annual_price == null ? '' : String(p.annual_price), is_active: p.is_active };
}
function toApi(p: PlanFormValue): ApiPlan {
  return {
    id: p.id, name: p.name, description: p.description, features: p.features,
    monthly_price: round(parseFloat(p.monthly) || 0),
    annual_price: p.annual.trim() === '' ? null : round(parseFloat(p.annual) || 0),
    is_active: p.is_active,
  };
}

export function AdminSubscriptionPlansView() {
  const t = useTranslations('admin_commission');
  const { success, error: showError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PlanFormValue | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [ok, data] = await getFromApi('/admin/subscription-plans');
    if (!mountedRef.current) return;
    if (ok) setPlans((data as { data?: ApiPlan[] })?.data ?? []);
    else showError(t('sub_load_error'));
    setLoading(false);
  }, [showError, t]);
  useEffect(() => { load(); }, [load]);

  const persist = useCallback(async (next: ApiPlan[]) => {
    setSaving(true);
    const [ok, data] = await updateWithApi('/admin/subscription-plans', { plans: next });
    if (!mountedRef.current) return false;
    setSaving(false);
    if (ok) { setPlans((data as { data?: ApiPlan[] })?.data ?? next); success(t('sub_save_success')); return true; }
    showError((data as { message?: string })?.message || t('sub_save_error'));
    return false;
  }, [success, showError, t]);

  function openNew() { setEditing(null); setModalOpen(true); }
  function openEdit(p: ApiPlan) { setEditing(toForm(p)); setModalOpen(true); }

  async function handleModalSave(form: PlanFormValue) {
    const api = toApi(form);
    const next = plans.some((p) => p.id === api.id) ? plans.map((p) => (p.id === api.id ? api : p)) : [...plans, api];
    setModalOpen(false);
    await persist(next);
  }
  async function handleDelete(id: string) {
    setConfirmDelete(null);
    await persist(plans.filter((p) => p.id !== id));
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-foreground/60 dark:text-[#B0BFB1]">{t('sub_subtitle')}</p>
        <button type="button" onClick={openNew} disabled={saving}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#DDAF3B] px-4 py-2.5 text-[13px] font-bold text-[#001201] transition-opacity hover:opacity-85 disabled:opacity-50">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          {t('sub_add')}
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-separator/40 bg-card-surface p-12 text-center text-[13px] text-foreground/55 dark:border-[#1E2E18] dark:bg-[#131E10] dark:text-[#B0BFB1]">
          {t('sub_empty')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className={`relative flex flex-col overflow-hidden rounded-2xl border bg-card-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all dark:bg-[#131E10] ${p.is_active ? 'border-[#DDAF3B]/40' : 'border-separator/25 opacity-75 dark:border-[#1E2E18]'}`}>
              <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full bg-[#DDAF3B]/10 blur-2xl" />
              <div className="relative mb-3 flex items-start justify-between gap-2">
                <h3 className="text-[18px] font-black text-[#001201] dark:text-[#FFF9EC]">{p.name}</h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${p.is_active ? 'bg-[#22C47A]/15 text-[#16A964]' : 'bg-[#888]/15 text-foreground/55 dark:text-[#B0BFB1]'}`}>
                  {p.is_active ? t('sub_active') : t('sub_inactive')}
                </span>
              </div>

              <div className="relative mb-1 flex items-end gap-1">
                <span className="text-[32px] font-black leading-none text-[#001201] dark:text-[#FFF9EC]">${p.monthly_price}</span>
                <span className="mb-1 text-[12px] font-semibold text-foreground/55 dark:text-[#B0BFB1]">{t('sub_per_month')}</span>
              </div>
              {p.annual_price != null && (
                <p className="mb-3 text-[12px] font-semibold text-[#9A7A13] dark:text-[#DDAF3B]">${p.annual_price} {t('sub_per_year')}</p>
              )}

              {p.description && <p className="mb-3 text-[12px] leading-relaxed text-foreground/65 dark:text-[#B0BFB1]">{p.description}</p>}

              {p.features.length > 0 && (
                <ul className="mb-4 flex flex-col gap-1.5">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] text-[#001201] dark:text-[#E8E0CC]">
                      <svg className="mt-0.5 shrink-0 text-[#16A964]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-auto flex items-center gap-2 pt-2">
                {confirmDelete === p.id ? (
                  <>
                    <button type="button" onClick={() => handleDelete(p.id)} disabled={saving} className="flex-1 rounded-lg bg-[#FF2525] px-3 py-1.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50">{t('sub_confirm')}</button>
                    <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-lg border border-[#D8D4C8] px-3 py-1.5 text-[12px] font-semibold text-foreground/65 dark:border-[#001A05] dark:text-[#B0BFB1]">{t('sub_cancel')}</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => openEdit(p)} className="flex-1 rounded-lg border border-[#DDAF3B]/50 px-3 py-1.5 text-[12px] font-bold text-[#9A7A13] transition-colors hover:bg-[#DDAF3B]/10 dark:text-[#DDAF3B]">{t('sub_edit')}</button>
                    <button type="button" onClick={() => setConfirmDelete(p.id)} aria-label={t('sub_remove')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#FF2525]/30 text-[#FF2525] transition-colors hover:bg-[#FF2525]/10">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <SubscriptionPlanModal open={modalOpen} plan={editing} onClose={() => setModalOpen(false)} onSave={handleModalSave} />
    </div>
  );
}

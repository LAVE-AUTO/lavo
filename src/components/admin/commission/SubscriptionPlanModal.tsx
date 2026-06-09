'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';

export interface PlanFormValue {
  id: string;
  name: string;
  description: string;
  features: string[];
  monthly: string;
  annual: string;
  is_active: boolean;
}

function blankId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
}

const inputClass =
  'w-full rounded-xl border border-[#D8D4C8] bg-white px-3 py-2.5 text-[14px] text-[#001201] outline-none transition focus:border-[#DDAF3B] focus:ring-2 focus:ring-[#DDAF3B]/15 dark:border-[#001A05] dark:bg-dark-bg dark:text-[#FFF9EC]';
const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-foreground/55 dark:text-[#B0BFB1]';

export function SubscriptionPlanModal({
  open, plan, onClose, onSave,
}: {
  open: boolean;
  plan: PlanFormValue | null;
  onClose: () => void;
  onSave: (p: PlanFormValue) => void;
}) {
  const t = useTranslations('admin_commission');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [monthly, setMonthly] = useState('');
  const [annual, setAnnual] = useState('');
  const [features, setFeatures] = useState<string[]>(['']);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(plan?.name ?? '');
    setDescription(plan?.description ?? '');
    setMonthly(plan?.monthly ?? '');
    setAnnual(plan?.annual ?? '');
    setFeatures(plan?.features && plan.features.length > 0 ? plan.features : ['']);
    setIsActive(plan?.is_active ?? true);
    setError(null);
  }, [open, plan]);

  function setFeature(i: number, v: string) { setFeatures((p) => p.map((f, idx) => (idx === i ? v : f))); }
  function addFeature() { setFeatures((p) => [...p, '']); }
  function removeFeature(i: number) { setFeatures((p) => (p.length === 1 ? [''] : p.filter((_, idx) => idx !== i))); }

  function submit() {
    if (!name.trim()) { setError(t('sub_error_name')); return; }
    const m = parseFloat(monthly);
    if (!Number.isFinite(m) || m < 0) { setError(t('sub_error_price')); return; }
    onSave({
      id: plan?.id ?? blankId(),
      name: name.trim(),
      description: description.trim(),
      features: features.map((f) => f.trim()).filter((f) => f.length > 0),
      monthly,
      annual,
      is_active: isActive,
    });
  }

  return (
    <Modal open={open} onClose={onClose} size="2xl" title={t(plan ? 'sub_modal_edit' : 'sub_modal_new')}>
      <div className="space-y-4 p-1">
        <div>
          <label className={labelClass}>{t('sub_plan_name')}</label>
          <input className={inputClass} value={name} maxLength={80} placeholder={t('sub_plan_name_ph')} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className={labelClass}>{t('sub_description')}</label>
          <textarea className={`${inputClass} resize-none`} rows={2} maxLength={500} value={description} placeholder={t('sub_description_ph')} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('sub_monthly')}</label>
            <div className="flex items-center overflow-hidden rounded-xl border border-[#D8D4C8] bg-white focus-within:border-[#DDAF3B] dark:border-[#001A05] dark:bg-dark-bg">
              <span className="pl-3 text-[14px] font-bold text-[#AAAAAA]">$</span>
              <input className="w-full bg-transparent px-2 py-2.5 text-[14px] text-[#001201] outline-none dark:text-[#FFF9EC]" type="number" min={0} step={0.5} value={monthly} placeholder="0" onChange={(e) => setMonthly(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('sub_annual')}</label>
            <div className="flex items-center overflow-hidden rounded-xl border border-[#D8D4C8] bg-white focus-within:border-[#DDAF3B] dark:border-[#001A05] dark:bg-dark-bg">
              <span className="pl-3 text-[14px] font-bold text-[#AAAAAA]">$</span>
              <input className="w-full bg-transparent px-2 py-2.5 text-[14px] text-[#001201] outline-none dark:text-[#FFF9EC]" type="number" min={0} step={1} value={annual} placeholder="—" onChange={(e) => setAnnual(e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('sub_features')}</label>
          <div className="flex flex-col gap-2">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#22C47A]/12 text-[#16A964]" aria-hidden="true">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                <input className={inputClass} value={f} maxLength={120} placeholder={t('sub_feature_ph')} onChange={(e) => setFeature(i, e.target.value)} />
                <button type="button" onClick={() => removeFeature(i)} aria-label={t('sub_remove')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#FF2525] transition-colors hover:bg-[#FF2525]/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            ))}
            <button type="button" onClick={addFeature} className="self-start rounded-lg border border-[#DDAF3B]/40 px-3 py-1.5 text-[12px] font-bold text-[#9A7A13] transition-colors hover:bg-[#DDAF3B]/10 dark:text-[#DDAF3B]">
              + {t('sub_add_feature')}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-separator/30 bg-[#FAFAF6] px-4 py-3 dark:border-[#001A05] dark:bg-[#151E12]">
          <span className="text-[13px] font-semibold text-[#001201] dark:text-[#FFF9EC]">{t('sub_active')}</span>
          <button type="button" onClick={() => setIsActive((v) => !v)} aria-pressed={isActive}
            className={`relative h-6 w-11 rounded-full transition-colors ${isActive ? 'bg-[#22C47A]' : 'bg-[#CCC] dark:bg-[#3A4A36]'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${isActive ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>

        {error && <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p>}
      </div>

      <div className="mt-4 flex justify-end gap-2.5 border-t border-[#F0EDE4] px-1 pt-4 dark:border-[#1A2A14]">
        <button type="button" onClick={onClose} className="rounded-xl border border-[#D8D4C8] px-4 py-2 text-[13px] font-medium text-foreground/65 transition-opacity hover:opacity-70 dark:border-[#001A05] dark:text-[#B0BFB1]">
          {t('sub_cancel')}
        </button>
        <button type="button" onClick={submit} className="rounded-xl bg-[#DDAF3B] px-5 py-2 text-[13px] font-bold text-[#001201] transition-opacity hover:opacity-85">
          {t('sub_btn_save_plan')}
        </button>
      </div>
    </Modal>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';

// TODO: connect to API once endpoint is available (GET|POST /admin/platform-settings)
const MOCK_SETTINGS = {
  penalty_rate: 15,
  admin_share: 10,
  reschedule_delay_minutes: 30,
};

const inputClass =
  'w-full rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none transition-colors duration-150 placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] dark:focus:border-[#C49A1E] dark:focus:bg-[#182214]';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-[#AAAAAA] dark:text-[#5A5A4A]">{hint}</p>}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">
      <h2 className="mb-4 text-[11px] font-black uppercase tracking-wider text-[#C49A1E]">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function AdminPlatformSettings() {
  const t = useTranslations('admin_settings');
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [penaltyRate, setPenaltyRate]         = useState(MOCK_SETTINGS.penalty_rate);
  const [adminShare, setAdminShare]           = useState(MOCK_SETTINGS.admin_share);
  const [rescheduleDelay, setRescheduleDelay] = useState(MOCK_SETTINGS.reschedule_delay_minutes);
  const [saving, setSaving]                   = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  const stationShare = 100 - adminShare;

  function validate(): string | null {
    if (penaltyRate < 0 || penaltyRate > 100)     return t('error_penalty_range');
    if (adminShare < 0 || adminShare > 100)        return t('error_share_range');
    if (rescheduleDelay < 1 || rescheduleDelay > 10080) return t('error_delay_range');
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    setError(null);
    setSaved(false);

    // TODO: connect to API once endpoint is available (POST /admin/platform-settings)
    await new Promise((r) => setTimeout(r, 600));

    if (!mountedRef.current) return;
    setSaving(false);
    setSaved(true);
    setTimeout(() => { if (mountedRef.current) setSaved(false); }, 3000);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[20px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
        <p className="mt-1 text-[13px] text-[#666] dark:text-[#8A8A7A]">{t('page_subtitle')}</p>
      </div>

      <form onSubmit={handleSave} className="flex max-w-lg flex-col gap-5">

        <SectionCard title={t('section_commission')}>
          <Field label={t('field_admin_share')} hint={t('hint_admin_share')}>
            <div className="relative">
              <input type="number" min={0} max={100} step={1}
                className={inputClass + ' pr-8'}
                value={adminShare}
                onChange={(e) => { setAdminShare(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))); }} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#888]">%</span>
            </div>
          </Field>
          <Field label={t('field_station_share')} hint={t('hint_station_share')}>
            <div className="relative">
              <input type="number" readOnly
                className={inputClass + ' cursor-not-allowed pr-8 opacity-60'}
                value={stationShare} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#888]">%</span>
            </div>
          </Field>
        </SectionCard>

        <SectionCard title={t('section_penalties')}>
          <Field label={t('field_penalty_rate')} hint={t('hint_penalty_rate')}>
            <div className="relative">
              <input type="number" min={0} max={100} step={1}
                className={inputClass + ' pr-8'}
                value={penaltyRate}
                onChange={(e) => { setPenaltyRate(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))); }} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#888]">%</span>
            </div>
          </Field>
        </SectionCard>

        <SectionCard title={t('section_reschedule')}>
          <Field label={t('field_reschedule_delay')} hint={t('hint_reschedule_delay')}>
            <div className="relative">
              <input type="number" min={1} max={10080} step={1}
                className={inputClass + ' pr-10'}
                value={rescheduleDelay}
                onChange={(e) => { setRescheduleDelay(Math.max(1, parseInt(e.target.value, 10) || 1)); }} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#888]">{t('unit_minutes')}</span>
            </div>
          </Field>
        </SectionCard>

        {error && <p className="text-[12px] font-semibold text-[#EF4444]">{error}</p>}
        {saved && (
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#00C851]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            {t('save_success')}
          </p>
        )}

        <button type="submit" disabled={saving}
          className="self-start rounded-[10px] bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50">
          {saving ? t('btn_saving') : t('btn_save')}
        </button>
      </form>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';

// TODO: connect to API once endpoint is available (GET|POST /admin/platform-settings)
const MOCK_SETTINGS = { penalty_rate: 15, admin_share: 10, reschedule_delay_minutes: 30 };

/* Styled input-group: input + right unit badge, focus ring on wrapper */
function NumericField({
  label, hint, value, unit, min, max, onChange, readOnly,
}: {
  label: string; hint?: string; value: number; unit: string;
  min?: number; max?: number; onChange?: (v: number) => void; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-black uppercase tracking-wider text-[#8A8A7A] dark:text-[#6A6A5A]">{label}</label>
      <div className={[
        'flex overflow-hidden rounded-[10px] border-2 transition-all duration-200',
        readOnly
          ? 'border-[#E8E4D8] bg-[#F5F2EB] dark:border-[#1E2E18] dark:bg-[#0F1A0C]'
          : 'border-[#D8D4C8] bg-white hover:border-[#C4A830]/60 focus-within:border-[#C49A1E] focus-within:shadow-[0_0_0_4px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:hover:border-[#3A5030] dark:focus-within:border-[#C49A1E]',
      ].join(' ')}>
        <input
          type="number" min={min} max={max} readOnly={readOnly}
          value={value}
          onChange={onChange ? (e) => onChange(Math.min(max ?? 99999, Math.max(min ?? 0, parseInt(e.target.value, 10) || (min ?? 0)))) : undefined}
          className={[
            'flex-1 bg-transparent px-4 py-3 text-[16px] font-bold outline-none',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            readOnly ? 'cursor-not-allowed text-[#9A9A8A] dark:text-[#5A5A4A]' : 'text-[#1A1A0A] dark:text-[#F0EDD4]',
          ].join(' ')}
        />
        <span className="flex items-center border-l border-[#E8E4D8] bg-[#F0EDE0] px-3.5 text-[12px] font-black text-[#8A8A6A] dark:border-[#243020] dark:bg-[#141E10] dark:text-[#5A5A4A]">
          {unit}
        </span>
      </div>
      {hint && <p className="text-[11px] leading-relaxed text-[#AAAAAA] dark:text-[#4A4A3A]">{hint}</p>}
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] transition-shadow duration-200 hover:shadow-md dark:bg-[#1A2416] dark:ring-white/[0.06]">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C49A1E]/10 text-[#C49A1E]">{icon}</div>
        <h2 className="text-[13px] font-black uppercase tracking-wider text-[#1A1A0A] dark:text-[#F0EDD4]">{title}</h2>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function AdminPlatformSettings() {
  const t          = useTranslations('admin_settings');
  const { success: toastSuccess, error: toastError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [penaltyRate, setPenaltyRate]         = useState(MOCK_SETTINGS.penalty_rate);
  const [adminShare, setAdminShare]           = useState(MOCK_SETTINGS.admin_share);
  const [rescheduleDelay, setRescheduleDelay] = useState(MOCK_SETTINGS.reschedule_delay_minutes);
  const [saving, setSaving]                   = useState(false);

  const stationShare = 100 - adminShare;

  const isDirty =
    penaltyRate !== MOCK_SETTINGS.penalty_rate ||
    adminShare  !== MOCK_SETTINGS.admin_share  ||
    rescheduleDelay !== MOCK_SETTINGS.reschedule_delay_minutes;

  function validate(): string | null {
    if (penaltyRate < 0 || penaltyRate > 100)          return t('error_penalty_range');
    if (adminShare < 0 || adminShare > 100)             return t('error_share_range');
    if (rescheduleDelay < 1 || rescheduleDelay > 10080) return t('error_delay_range');
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { toastError(err); return; }
    setSaving(true);
    // TODO: connect to API once endpoint is available (POST /admin/platform-settings)
    await new Promise((r) => setTimeout(r, 700));
    if (!mountedRef.current) return;
    setSaving(false);
    toastSuccess(t('save_success'));
  }

  return (
    <div className="p-6 pb-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
        <p className="mt-1.5 text-[13px] text-[#777] dark:text-[#7A7A6A]">{t('page_subtitle')}</p>
      </div>

      <form onSubmit={handleSave} className="flex max-w-[560px] flex-col gap-5">

        {/* Commission */}
        <SectionCard title={t('section_commission')} icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
        }>
          <NumericField label={t('field_admin_share')} hint={t('hint_admin_share')} value={adminShare} unit="%" min={0} max={100} onChange={setAdminShare} />

          {/* Split bar */}
          <div>
            <div className="overflow-hidden rounded-full bg-[#F0EDE0] dark:bg-[#0E1A0A]" style={{ height: 10 }}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#C49A1E] to-[#D4A830] transition-all duration-500 ease-out"
                style={{ width: `${Math.max(2, adminShare)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-bold">
              <span className="text-[#C49A1E]">{t('label_platform')} {adminShare}%</span>
              <span className="text-[#5A8A50] dark:text-[#7AAA6A]">{t('label_station')} {stationShare}%</span>
            </div>
          </div>

          <NumericField label={t('field_station_share')} hint={t('hint_station_share')} value={stationShare} unit="%" readOnly />
        </SectionCard>

        {/* Penalties */}
        <SectionCard title={t('section_penalties')} icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        }>
          <NumericField label={t('field_penalty_rate')} hint={t('hint_penalty_rate')} value={penaltyRate} unit="%" min={0} max={100} onChange={setPenaltyRate} />
        </SectionCard>

        {/* Reschedule delay */}
        <SectionCard title={t('section_reschedule')} icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        }>
          <NumericField label={t('field_reschedule_delay')} hint={t('hint_reschedule_delay')} value={rescheduleDelay} unit={t('unit_minutes')} min={1} max={10080} onChange={setRescheduleDelay} />
        </SectionCard>

        {/* Save */}
        <div className="flex items-center gap-4 pt-1">
          <button type="submit" disabled={saving}
            className="relative flex items-center gap-2 rounded-[10px] bg-[#C49A1E] px-7 py-3 text-[13px] font-bold text-[#0C1209] shadow-sm transition-all duration-200 hover:bg-[#D4A830] hover:shadow-md active:scale-[0.98] disabled:opacity-50">
            {saving ? (
              <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0C1209] border-t-transparent" />{t('btn_saving')}</>
            ) : t('btn_save')}
            {isDirty && !saving && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-[#EF4444] ring-2 ring-white dark:ring-[#1A2416]" />
            )}
          </button>
          {isDirty && !saving && (
            <span className="text-[11px] font-semibold text-[#AAAAAA] dark:text-[#5A5A4A]">{t('label_unsaved')}</span>
          )}
        </div>
      </form>
    </div>
  );
}

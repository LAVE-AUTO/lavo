'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi, patchWithApi } from '@/services/axios-service';

interface PlatformSettingRow {
  key: string;
  value: string | null;
}

// ─── Field components ──────────────────────────────────────────────────────────

function NumericField({
  label, hint, value, unit, min, max, step = 1, onChange, readOnly,
}: {
  label: string; hint?: string; value: number; unit: string;
  min?: number; max?: number; step?: number;
  onChange?: (v: number) => void; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[12px] font-black uppercase tracking-wider text-[#B0BFB1] dark:text-[#B0BFB1]">{label}</label>
      <div className={[
        'flex overflow-hidden rounded-[10px] border-2 transition-all duration-200',
        readOnly
          ? 'border-[#FFF9EC] bg-[#F5F2EB] dark:border-[#1E2E18] dark:bg-dark-bg'
          : 'border-[#D8D4C8] bg-white hover:border-[#C4A830]/60 focus-within:border-[#DDAF3B] focus-within:shadow-[0_0_0_4px_rgba(221, 175, 59,0.12)] dark:border-[#001A05] dark:bg-dark-bg dark:hover:border-[#3A5030] dark:focus-within:border-[#DDAF3B]',
      ].join(' ')}>
        <input
          type="number" min={min} max={max} step={step} readOnly={readOnly} value={value}
          onChange={onChange
            ? (e) => onChange(Math.min(max ?? 99999, Math.max(min ?? 0, parseFloat(e.target.value) || (min ?? 0))))
            : undefined}
          className={[
            'flex-1 bg-transparent px-4 py-3 text-[18px] font-bold outline-none',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            readOnly ? 'cursor-not-allowed text-[#B0BFB1] dark:text-[#B0BFB1]' : 'text-[#001201] dark:text-[#FFF9EC]',
          ].join(' ')}
        />
        <span className="flex items-center border-l border-[#FFF9EC] bg-[#F0EDE0] px-3.5 text-[13px] font-black text-[#8A8A6A] dark:border-[#001A05] dark:bg-[#141E10] dark:text-[#B0BFB1]">
          {unit}
        </span>
      </div>
      {hint && <p className="text-[12px] leading-relaxed text-[#AAAAAA] dark:text-[#B0BFB1]">{hint}</p>}
    </div>
  );
}

function EmailField({
  label, hint, value, onChange,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[12px] font-black uppercase tracking-wider text-[#B0BFB1] dark:text-[#B0BFB1]">{label}</label>
      <input
        type="email" value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="email@exemple.com"
        className="rounded-[10px] border-2 border-[#D8D4C8] bg-white px-4 py-3 text-[14px] font-semibold text-[#001201] outline-none transition-all hover:border-[#C4A830]/60 focus:border-[#DDAF3B] focus:shadow-[0_0_0_4px_rgba(221, 175, 59,0.12)] dark:border-[#001A05] dark:bg-dark-bg dark:text-[#FFF9EC] dark:hover:border-[#3A5030] dark:focus:border-[#DDAF3B] placeholder:text-[#CCCCBB] dark:placeholder:text-[#505040]"
      />
      {hint && <p className="text-[12px] leading-relaxed text-[#AAAAAA] dark:text-[#B0BFB1]">{hint}</p>}
    </div>
  );
}

function SectionCard({ icon, title, children, colSpan }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; colSpan?: string;
}) {
  return (
    <div className={colSpan}>
      <div className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] transition-shadow duration-200 hover:shadow-md dark:bg-[#001A05] dark:ring-white/[0.06]">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DDAF3B]/10 text-[#DDAF3B]">{icon}</div>
          <h2 className="text-[13px] font-black uppercase tracking-wider text-[#001201] dark:text-[#FFF9EC]">{title}</h2>
        </div>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS = {
  // Group A — Annulation
  cancellation_free_window_minutes: 60,
  cancellation_penalty_percent: 15,
  cancellation_penalty_platform_rate_pct: 70, // stored as 0.70, displayed as 70

  // Group B — Délais & Fenêtres
  dispute_window_days: 30,
  rating_window_days: 7,
  max_advance_booking_days: 7,

  // Group C — Notifications & Emails
  admin_notification_email: '',
  weekly_report_email: '',
  reminder_first_window_hours: 5,
  reminder_second_window_minutes: 30,

  // Group D — Limites & KYC
  max_tip_amount_xaf: 50000,
  kyc_reminder_first_threshold_days: 30,
  kyc_reminder_second_threshold_days: 7,
  admin_log_retention_days: 365,
};

type Committed = typeof DEFAULTS;

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminPlatformSettings() {
  const t = useTranslations('admin_settings');
  const { success: toastSuccess, error: toastError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ── State ──

  // Group A — Annulation
  const [freeWindow, setFreeWindow]       = useState(DEFAULTS.cancellation_free_window_minutes);
  const [penaltyRate, setPenaltyRate]     = useState(DEFAULTS.cancellation_penalty_percent);
  const [platformPct, setPlatformPct]     = useState(DEFAULTS.cancellation_penalty_platform_rate_pct);

  // Group B — Délais & Fenêtres
  const [disputeWindow, setDisputeWindow] = useState(DEFAULTS.dispute_window_days);
  const [ratingWindow, setRatingWindow]   = useState(DEFAULTS.rating_window_days);
  const [maxAdvance, setMaxAdvance]       = useState(DEFAULTS.max_advance_booking_days);

  // Group C — Notifications & Emails
  const [adminEmail, setAdminEmail]               = useState(DEFAULTS.admin_notification_email);
  const [reportEmail, setReportEmail]             = useState(DEFAULTS.weekly_report_email);
  const [reminderFirst, setReminderFirst]         = useState(DEFAULTS.reminder_first_window_hours);
  const [reminderSecond, setReminderSecond]       = useState(DEFAULTS.reminder_second_window_minutes);

  // Group D — Limites & KYC
  const [maxTip, setMaxTip]               = useState(DEFAULTS.max_tip_amount_xaf);
  const [kycFirst, setKycFirst]           = useState(DEFAULTS.kyc_reminder_first_threshold_days);
  const [kycSecond, setKycSecond]         = useState(DEFAULTS.kyc_reminder_second_threshold_days);
  const [logRetention, setLogRetention]   = useState(DEFAULTS.admin_log_retention_days);

  const [committed, setCommitted]         = useState<Committed>({ ...DEFAULTS });
  const [saving, setSaving]               = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // ── Load ──

  useEffect(() => {
    (async () => {
      try {
        const [ok, data] = await getFromApi('/admin/settings');
        if (!mountedRef.current || !ok) return;
        const rows = (data as { data: PlatformSettingRow[] }).data ?? [];
        const get = (key: string) => rows.find((r) => r.key === key)?.value ?? null;

        const p = (key: string) => { const v = parseFloat(get(key) ?? ''); return isNaN(v) ? null : v; };
        const i = (key: string) => { const v = parseInt(get(key) ?? '', 10); return isNaN(v) ? null : v; };
        const s = (key: string) => get(key) ?? null;

        const fw   = i('cancellation_free_window_minutes');
        const pr   = p('cancellation_penalty_percent');
        const ppr  = p('cancellation_penalty_platform_rate'); // fraction, convert to %
        const dw   = i('dispute_window_days');
        const rw   = i('rating_window_days');
        const ma   = i('max_advance_booking_days');
        const ae   = s('admin_notification_email');
        const re   = s('weekly_report_email');
        const rf   = i('reminder_first_window_hours');
        const rs   = i('reminder_second_window_minutes');
        const mt   = i('max_tip_amount_xaf');
        const kf   = i('kyc_reminder_first_threshold_days');
        const ks   = i('kyc_reminder_second_threshold_days');
        const lr   = i('admin_log_retention_days');

        const platformPctVal = ppr !== null ? Math.round(ppr * 100 * 10) / 10 : DEFAULTS.cancellation_penalty_platform_rate_pct;

        const next: Committed = {
          cancellation_free_window_minutes:       fw  ?? DEFAULTS.cancellation_free_window_minutes,
          cancellation_penalty_percent:           pr  ?? DEFAULTS.cancellation_penalty_percent,
          cancellation_penalty_platform_rate_pct: platformPctVal,
          dispute_window_days:                    dw  ?? DEFAULTS.dispute_window_days,
          rating_window_days:                     rw  ?? DEFAULTS.rating_window_days,
          max_advance_booking_days:               ma  ?? DEFAULTS.max_advance_booking_days,
          admin_notification_email:               ae  ?? DEFAULTS.admin_notification_email,
          weekly_report_email:                    re  ?? DEFAULTS.weekly_report_email,
          reminder_first_window_hours:            rf  ?? DEFAULTS.reminder_first_window_hours,
          reminder_second_window_minutes:         rs  ?? DEFAULTS.reminder_second_window_minutes,
          max_tip_amount_xaf:                     mt  ?? DEFAULTS.max_tip_amount_xaf,
          kyc_reminder_first_threshold_days:      kf  ?? DEFAULTS.kyc_reminder_first_threshold_days,
          kyc_reminder_second_threshold_days:     ks  ?? DEFAULTS.kyc_reminder_second_threshold_days,
          admin_log_retention_days:               lr  ?? DEFAULTS.admin_log_retention_days,
        };

        setFreeWindow(next.cancellation_free_window_minutes);
        setPenaltyRate(next.cancellation_penalty_percent);
        setPlatformPct(next.cancellation_penalty_platform_rate_pct);
        setDisputeWindow(next.dispute_window_days);
        setRatingWindow(next.rating_window_days);
        setMaxAdvance(next.max_advance_booking_days);
        setAdminEmail(next.admin_notification_email);
        setReportEmail(next.weekly_report_email);
        setReminderFirst(next.reminder_first_window_hours);
        setReminderSecond(next.reminder_second_window_minutes);
        setMaxTip(next.max_tip_amount_xaf);
        setKycFirst(next.kyc_reminder_first_threshold_days);
        setKycSecond(next.kyc_reminder_second_threshold_days);
        setLogRetention(next.admin_log_retention_days);
        setCommitted(next);
      } catch {
        // keep defaults on failure
      } finally {
        if (mountedRef.current) setLoadingSettings(false);
      }
    })();
  }, []);

  // ── Derived ──

  const stationPct = Math.round((100 - platformPct) * 10) / 10;

  const isDirty =
    freeWindow     !== committed.cancellation_free_window_minutes ||
    penaltyRate    !== committed.cancellation_penalty_percent ||
    platformPct    !== committed.cancellation_penalty_platform_rate_pct ||
    disputeWindow  !== committed.dispute_window_days ||
    ratingWindow   !== committed.rating_window_days ||
    maxAdvance     !== committed.max_advance_booking_days ||
    adminEmail     !== committed.admin_notification_email ||
    reportEmail    !== committed.weekly_report_email ||
    reminderFirst  !== committed.reminder_first_window_hours ||
    reminderSecond !== committed.reminder_second_window_minutes ||
    maxTip         !== committed.max_tip_amount_xaf ||
    kycFirst       !== committed.kyc_reminder_first_threshold_days ||
    kycSecond      !== committed.kyc_reminder_second_threshold_days ||
    logRetention   !== committed.admin_log_retention_days;

  // ── Validation ──

  function validate(): string | null {
    if (freeWindow < 0)                      return t('error_free_window_range');
    if (penaltyRate < 0 || penaltyRate > 100) return t('error_penalty_range');
    if (platformPct < 0 || platformPct > 100) return t('error_penalty_split_range');
    if (disputeWindow < 1)                   return t('error_dispute_window_range');
    if (ratingWindow < 1)                    return t('error_rating_window_range');
    if (maxAdvance < 1 || maxAdvance > 7)    return t('error_max_advance_range');
    if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) return t('error_email_invalid');
    if (reportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reportEmail)) return t('error_email_invalid');
    if (reminderFirst < 1)                   return t('error_reminder_first_range');
    if (reminderSecond < 5)                  return t('error_reminder_second_range');
    if (maxTip < 0)                          return t('error_max_tip_range');
    if (kycFirst < 1)                        return t('error_kyc_first_range');
    if (kycSecond < 1)                       return t('error_kyc_second_range');
    if (logRetention < 7 || logRetention > 3650) return t('error_log_retention_range');
    return null;
  }

  // ── Save ──

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { toastError(err); return; }
    setSaving(true);

    try {
      const payload: Record<string, string> = {
        cancellation_free_window_minutes:    String(freeWindow),
        cancellation_penalty_percent:        penaltyRate.toFixed(2),
        // backend auto-calculates cancellation_penalty_station_rate
        cancellation_penalty_platform_rate:  (platformPct / 100).toFixed(2),
        dispute_window_days:                 String(disputeWindow),
        rating_window_days:                  String(ratingWindow),
        max_advance_booking_days:            String(maxAdvance),
        admin_notification_email:            adminEmail,
        weekly_report_email:                 reportEmail,
        reminder_first_window_hours:         String(reminderFirst),
        reminder_second_window_minutes:      String(reminderSecond),
        max_tip_amount_xaf:                  String(maxTip),
        kyc_reminder_first_threshold_days:   String(kycFirst),
        kyc_reminder_second_threshold_days:  String(kycSecond),
        admin_log_retention_days:            String(logRetention),
      };

      const [ok] = await patchWithApi('/admin/settings', payload);
      if (!mountedRef.current) return;

      if (ok) {
        setCommitted({
          cancellation_free_window_minutes:       freeWindow,
          cancellation_penalty_percent:           penaltyRate,
          cancellation_penalty_platform_rate_pct: platformPct,
          dispute_window_days:                    disputeWindow,
          rating_window_days:                     ratingWindow,
          max_advance_booking_days:               maxAdvance,
          admin_notification_email:               adminEmail,
          weekly_report_email:                    reportEmail,
          reminder_first_window_hours:            reminderFirst,
          reminder_second_window_minutes:         reminderSecond,
          max_tip_amount_xaf:                     maxTip,
          kyc_reminder_first_threshold_days:      kycFirst,
          kyc_reminder_second_threshold_days:     kycSecond,
          admin_log_retention_days:               logRetention,
        });
        toastSuccess(t('save_success'));
      } else {
        toastError(t('save_error'));
      }
    } catch {
      if (mountedRef.current) toastError(t('save_error'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  // ── Icons ──

  const iconCancellation = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
  const iconWindows      = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  const iconNotif        = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
  const iconLimits       = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;

  if (loadingSettings) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex min-h-full flex-col">

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-[#FFF9EC] bg-[#FFF9EC] px-6 py-4 dark:border-[#1A2A14] dark:bg-dark-bg">
        <div>
          <h1 className="text-[18px] font-black text-[#001201] dark:text-[#FFF9EC]">{t('page_title')}</h1>
          <p className="text-[13px] text-foreground/55 dark:text-[#B0BFB1]">{t('page_subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && !saving && (
            <span className="text-[12px] font-semibold text-[#AAAAAA] dark:text-[#B0BFB1]">{t('label_unsaved')}</span>
          )}
          <button type="submit" disabled={saving || !isDirty}
            className="relative flex items-center gap-2 rounded-[10px] bg-[#DDAF3B] px-6 py-2.5 text-[13px] font-bold text-[#001201] shadow-sm transition-all duration-200 hover:bg-[#D4A830] hover:shadow-md active:scale-[0.98] disabled:opacity-50">
            {saving
              ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#001201] border-t-transparent" />{t('btn_saving')}</>
              : t('btn_save')}
            {isDirty && !saving && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-[#EF4444] ring-2 ring-white dark:ring-[#001A05]" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#FFF9EC] dark:bg-dark-bg">
      <div className="grid auto-rows-min gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">

        {/* ── Groupe A — Annulation ── */}
        <SectionCard title={t('section_cancellation')} icon={iconCancellation} colSpan="md:col-span-2 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumericField
              label={t('field_free_window')}
              hint={t('hint_free_window')}
              value={freeWindow}
              unit={t('unit_minutes')}
              min={0}
              onChange={setFreeWindow}
            />
            <NumericField
              label={t('field_penalty_rate')}
              hint={t('hint_penalty_rate')}
              value={penaltyRate}
              unit="%"
              min={0}
              max={100}
              onChange={setPenaltyRate}
            />
            <NumericField
              label={t('field_platform_penalty_share')}
              hint={t('hint_platform_penalty_share')}
              value={platformPct}
              unit="%"
              min={0}
              max={100}
              step={0.5}
              onChange={setPlatformPct}
            />
          </div>
          {/* Penalty split bar */}
          <div>
            <div className="overflow-hidden rounded-full bg-[#F0EDE0] dark:bg-[#0E1A0A]" style={{ height: 8 }}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#DDAF3B] to-[#D4A830] transition-all duration-500 ease-out"
                style={{ width: `${Math.max(1, Math.min(99, platformPct))}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[12px] font-bold">
              <span className="text-[#DDAF3B]">{t('label_platform')} · {platformPct}%</span>
              <span className="text-[#5A8A50] dark:text-[#7AAA6A]">{t('label_station')} · {stationPct}%</span>
            </div>
            <p className="mt-1 text-[11px] text-[#AAAAAA] dark:text-[#B0BFB1]">{t('hint_penalty_split_note')}</p>
          </div>
        </SectionCard>

        {/* ── Groupe B — Délais & Fenêtres ── */}
        <SectionCard title={t('section_windows')} icon={iconWindows} colSpan="xl:col-span-1">
          <NumericField
            label={t('field_dispute_window')}
            hint={t('hint_dispute_window')}
            value={disputeWindow}
            unit={t('unit_days')}
            min={1}
            onChange={setDisputeWindow}
          />
          <NumericField
            label={t('field_rating_window')}
            hint={t('hint_rating_window')}
            value={ratingWindow}
            unit={t('unit_days')}
            min={1}
            onChange={setRatingWindow}
          />
          <NumericField
            label={t('field_max_advance')}
            hint={t('hint_max_advance')}
            value={maxAdvance}
            unit={t('unit_days')}
            min={1}
            max={7}
            onChange={setMaxAdvance}
          />
        </SectionCard>

        {/* ── Groupe C — Notifications & Emails ── */}
        <SectionCard title={t('section_notifications')} icon={iconNotif} colSpan="md:col-span-2 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <EmailField
              label={t('field_admin_email')}
              hint={t('hint_admin_email')}
              value={adminEmail}
              onChange={setAdminEmail}
            />
            <EmailField
              label={t('field_report_email')}
              hint={t('hint_report_email')}
              value={reportEmail}
              onChange={setReportEmail}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumericField
              label={t('field_reminder_first')}
              hint={t('hint_reminder_first')}
              value={reminderFirst}
              unit={t('unit_hours')}
              min={1}
              onChange={setReminderFirst}
            />
            <NumericField
              label={t('field_reminder_second')}
              hint={t('hint_reminder_second')}
              value={reminderSecond}
              unit={t('unit_minutes')}
              min={5}
              onChange={setReminderSecond}
            />
          </div>
        </SectionCard>

        {/* ── Groupe D — Pourboires & KYC ── */}
        <SectionCard title={t('section_limits')} icon={iconLimits} colSpan="xl:col-span-1">
          <NumericField
            label={t('field_max_tip')}
            hint={t('hint_max_tip')}
            value={maxTip}
            unit="XAF"
            min={0}
            onChange={setMaxTip}
          />
          <NumericField
            label={t('field_kyc_first')}
            hint={t('hint_kyc_first')}
            value={kycFirst}
            unit={t('unit_days')}
            min={1}
            onChange={setKycFirst}
          />
          <NumericField
            label={t('field_kyc_second')}
            hint={t('hint_kyc_second')}
            value={kycSecond}
            unit={t('unit_days')}
            min={1}
            onChange={setKycSecond}
          />
          <NumericField
            label={t('field_log_retention')}
            hint={t('hint_log_retention')}
            value={logRetention}
            unit={t('unit_days')}
            min={7}
            max={3650}
            onChange={setLogRetention}
          />
        </SectionCard>

      </div>
      </div>
    </form>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, updateWithApi, postWithApi } from '@/services';
import { useToast } from '@/context/toast-context';

interface AdminProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  status: string;
}

const OTP_COOLDOWN_SECONDS = 60;

/* ─── Premium form primitives (mirrors the rest of the admin shell) ─── */

const inputBase =
  'w-full rounded-[12px] border bg-white/95 px-3.5 py-2.5 text-[13px] font-medium text-[#001201] outline-none transition-all dark:bg-[#0D170B] dark:text-[#FFF9EC]';
const inputIdle =
  'border-[#D8D4C8] focus:border-[#DDAF3B] focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.12)] focus:ring-0 dark:border-[#001A05] dark:focus:border-[#DDAF3B]';
const inputErr =
  'border-red-400 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.15)]';

const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#DDAF3B] px-4 py-2.5 text-[12.5px] font-black text-[#0C1209] transition-all hover:bg-[#B08A14] hover:shadow-[0_10px_20px_rgba(221, 175, 59,0.25)] disabled:cursor-not-allowed disabled:opacity-50 dark:disabled:opacity-40';
const secondaryBtn =
  'inline-flex items-center gap-1.5 rounded-[12px] border border-[#E1DBCF] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#5A554B] transition-all hover:border-[#DDAF3B]/40 hover:bg-[#FCF6E5] hover:text-[#9A7A13] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#1E2E18] dark:bg-[#0E170C] dark:text-[#A6A091] dark:hover:bg-[#1A2410] dark:hover:text-[#F0D98C]';

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]"
    >
      {children}
    </label>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
      {children}
    </div>
  );
}

interface SectionProps {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

function Section({ eyebrow, title, description, children }: SectionProps) {
  return (
    <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-6 shadow-[0_24px_80px_rgba(26,26,10,0.07)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="mb-5">
        <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-[#9A7A13] dark:text-[#F0D98C]">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 text-[18px] font-black text-[#001201] dark:text-[#FFF9EC]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[13px] text-[#6F6B5F] dark:text-[#A6A091]">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function AdminProfileView() {
  const t = useTranslations('admin_profile');
  const { success: toastSuccess, error: toastError } = useToast();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Profile data ────────────────────────────────────────────────────────
  const [profile, setProfile]         = useState<AdminProfile | null>(null);
  const [loadError, setLoadError]     = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // ─── Identity section ────────────────────────────────────────────────────
  const [firstName, setFirstName]       = useState('');
  const [lastName, setLastName]         = useState('');
  const [phone, setPhone]               = useState('');
  const [identityErrs, setIdentityErrs] = useState<Record<string, string>>({});
  const [savingIdent, setSavingIdent]   = useState(false);

  // ─── Email section ───────────────────────────────────────────────────────
  const [newEmail, setNewEmail]               = useState('');
  const [emailOtp, setEmailOtp]               = useState('');
  const [emailOtpSent, setEmailOtpSent]       = useState(false);
  const [emailCooldown, setEmailCooldown]     = useState(0);
  const [emailErrs, setEmailErrs]             = useState<Record<string, string>>({});
  const [savingEmail, setSavingEmail]         = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);

  // ─── Password section ────────────────────────────────────────────────────
  const [currentPwd, setCurrentPwd]       = useState('');
  const [newPwd, setNewPwd]               = useState('');
  const [confirmPwd, setConfirmPwd]       = useState('');
  const [pwdOtp, setPwdOtp]               = useState('');
  const [pwdOtpSent, setPwdOtpSent]       = useState(false);
  const [pwdCooldown, setPwdCooldown]     = useState(0);
  const [pwdErrs, setPwdErrs]             = useState<Record<string, string>>({});
  const [savingPwd, setSavingPwd]         = useState(false);
  const [sendingPwdOtp, setSendingPwdOtp] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    station_lifecycle: { in_app: true, push: true, email: true },
    kyc_alerts: { in_app: true, push: true, email: true },
    support_alerts: { in_app: true, push: true, email: true },
  });

  // Load profile on mount
  useEffect(() => {
    getFromApi('/admin/me')
      .then(([ok, data]) => {
        if (!mountedRef.current) return;
        if (ok) {
          const p = (data as { data: AdminProfile }).data;
          setProfile(p);
          setFirstName(p.first_name ?? '');
          setLastName(p.last_name ?? '');
          setPhone(p.phone ?? '');
        } else {
          setLoadError(true);
        }
      })
      .catch(() => { if (mountedRef.current) setLoadError(true); })
      .finally(() => { if (mountedRef.current) setLoadingData(false); });
  }, []);

  useEffect(() => {
    getFromApi('/me/notification-prefs')
      .then(([ok, data]) => {
        if (!mountedRef.current || !ok) return;
        const prefs = (data as {
          data?: {
            station_lifecycle?: { in_app?: boolean; push?: boolean; email?: boolean };
            kyc_alerts?: { in_app?: boolean; push?: boolean; email?: boolean };
            support_alerts?: { in_app?: boolean; push?: boolean; email?: boolean };
          };
        }).data;
        if (!prefs) return;
        setNotifPrefs({
          station_lifecycle: {
            in_app: prefs.station_lifecycle?.in_app !== false,
            push: prefs.station_lifecycle?.push !== false,
            email: prefs.station_lifecycle?.email !== false,
          },
          kyc_alerts: {
            in_app: prefs.kyc_alerts?.in_app !== false,
            push: prefs.kyc_alerts?.push !== false,
            email: prefs.kyc_alerts?.email !== false,
          },
          support_alerts: {
            in_app: prefs.support_alerts?.in_app !== false,
            push: prefs.support_alerts?.push !== false,
            email: prefs.support_alerts?.email !== false,
          },
        });
      })
      .catch(() => void 0);
  }, []);

  async function handleSaveNotificationPrefs() {
    setSavingNotif(true);
    const [ok, data] = await updateWithApi('/me/notification-prefs', notifPrefs);
    if (!mountedRef.current) return;
    setSavingNotif(false);
    if (!ok) {
      const errData = data as { message?: string };
      toastError(errData?.message ?? t('error_generic'));
      return;
    }
    toastSuccess(t('success_notifications_saved'));
  }

  function toggleNotif(
    section: 'station_lifecycle' | 'kyc_alerts' | 'support_alerts',
    channel: 'in_app' | 'push' | 'email',
    checked: boolean
  ) {
    setNotifPrefs((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [channel]: checked,
      },
    }));
  }

  // Cooldown countdown for email OTP
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const id = setTimeout(() => setEmailCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [emailCooldown]);

  // Cooldown countdown for password OTP
  useEffect(() => {
    if (pwdCooldown <= 0) return;
    const id = setTimeout(() => setPwdCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [pwdCooldown]);

  // ─── Identity handlers ───────────────────────────────────────────────────
  function validateIdentity(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!firstName.trim())                  errs.firstName = t('error_firstname_required');
    else if (firstName.trim().length > 100) errs.firstName = t('error_firstname_too_long');
    if (!lastName.trim())                   errs.lastName  = t('error_lastname_required');
    else if (lastName.trim().length > 100)  errs.lastName  = t('error_lastname_too_long');
    return errs;
  }

  async function handleSaveIdentity() {
    const errs = validateIdentity();
    if (Object.keys(errs).length) { setIdentityErrs(errs); return; }
    setIdentityErrs({});
    setSavingIdent(true);
    try {
      const payload: Record<string, string | null> = {
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        phone:      phone.trim() || null,
      };
      const [ok, data] = await updateWithApi('/admin/me', payload);
      if (!mountedRef.current) return;
      if (ok) {
        const updated = (data as { data: AdminProfile }).data;
        setProfile(updated);
        toastSuccess(t('success_profile_saved'));
      } else {
        const errData = data as { message?: string };
        toastError(errData?.message ?? t('error_generic'));
      }
    } catch {
      if (mountedRef.current) toastError(t('error_generic'));
    } finally {
      if (mountedRef.current) setSavingIdent(false);
    }
  }

  // ─── Email handlers ──────────────────────────────────────────────────────
  async function handleRequestEmailOtp() {
    setSendingEmailOtp(true);
    setEmailErrs({});
    try {
      const [ok, data] = await postWithApi('/admin/me/otp', { purpose: 'email_change' });
      if (!mountedRef.current) return;
      if (ok) {
        setEmailOtpSent(true);
        setEmailCooldown(OTP_COOLDOWN_SECONDS);
      } else {
        const errData = data as { message?: string };
        setEmailErrs({ general: errData?.message ?? t('error_generic') });
      }
    } catch {
      if (mountedRef.current) setEmailErrs({ general: t('error_generic') });
    } finally {
      if (mountedRef.current) setSendingEmailOtp(false);
    }
  }

  function validateEmail(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!newEmail.trim())                                          errs.email = t('error_email_required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) errs.email = t('error_email_invalid');
    else if (profile && newEmail.trim() === profile.email)         errs.email = t('error_email_same');
    if (!emailOtp.trim()) errs.otp = t('error_otp_required');
    return errs;
  }

  async function handleChangeEmail() {
    const errs = validateEmail();
    if (Object.keys(errs).length) { setEmailErrs(errs); return; }
    setEmailErrs({});
    setSavingEmail(true);
    try {
      const [ok, data] = await postWithApi('/admin/me/email', {
        new_email: newEmail.trim(),
        otp_code:  emailOtp.trim(),
      });
      if (!mountedRef.current) return;
      if (ok) {
        const updated = (data as { data: AdminProfile }).data;
        setProfile(updated);
        setNewEmail('');
        setEmailOtp('');
        setEmailOtpSent(false);
        toastSuccess(t('success_email_changed'));
      } else {
        const errData = data as { code?: string; message?: string };
        if (errData?.code === 'TOKEN_EXPIRED' || errData?.code === 'INVALID_OTP') {
          setEmailErrs({ otp: t('error_otp_invalid') });
        } else if (errData?.code === 'EMAIL_ALREADY_EXISTS') {
          setEmailErrs({ email: t('error_email_conflict') });
        } else {
          setEmailErrs({ general: errData?.message ?? t('error_generic') });
        }
      }
    } catch {
      if (mountedRef.current) setEmailErrs({ general: t('error_generic') });
    } finally {
      if (mountedRef.current) setSavingEmail(false);
    }
  }

  // ─── Password handlers ───────────────────────────────────────────────────
  async function handleRequestPwdOtp() {
    setSendingPwdOtp(true);
    setPwdErrs({});
    try {
      const [ok, data] = await postWithApi('/admin/me/otp', { purpose: 'password_change' });
      if (!mountedRef.current) return;
      if (ok) {
        setPwdOtpSent(true);
        setPwdCooldown(OTP_COOLDOWN_SECONDS);
      } else {
        const errData = data as { message?: string };
        setPwdErrs({ general: errData?.message ?? t('error_generic') });
      }
    } catch {
      if (mountedRef.current) setPwdErrs({ general: t('error_generic') });
    } finally {
      if (mountedRef.current) setSendingPwdOtp(false);
    }
  }

  function validatePassword(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!currentPwd)      errs.currentPwd = t('error_password_current_required');
    if (!newPwd)          errs.newPwd     = t('error_password_new_required');
    if (newPwd && newPwd !== confirmPwd) errs.confirmPwd = t('error_password_mismatch');
    if (!pwdOtp.trim())   errs.otp        = t('error_otp_required');
    return errs;
  }

  async function handleChangePassword() {
    const errs = validatePassword();
    if (Object.keys(errs).length) { setPwdErrs(errs); return; }
    setPwdErrs({});
    setSavingPwd(true);
    try {
      const [ok, data] = await postWithApi('/admin/me/password', {
        current_password: currentPwd,
        new_password:     newPwd,
        otp_code:         pwdOtp.trim(),
      });
      if (!mountedRef.current) return;
      if (ok) {
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
        setPwdOtp('');
        setPwdOtpSent(false);
        toastSuccess(t('success_password_changed'));
      } else {
        const errData = data as { code?: string; message?: string };
        if (errData?.code === 'TOKEN_EXPIRED' || errData?.code === 'INVALID_OTP') {
          setPwdErrs({ otp: t('error_otp_invalid') });
        } else if (errData?.code === 'WRONG_PASSWORD' || errData?.code === 'UNAUTHORIZED') {
          setPwdErrs({ currentPwd: t('error_password_wrong') });
        } else {
          setPwdErrs({ general: errData?.message ?? t('error_generic') });
        }
      }
    } catch {
      if (mountedRef.current) setPwdErrs({ general: t('error_generic') });
    } finally {
      if (mountedRef.current) setSavingPwd(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loadingData) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
    </div>
  );

  if (loadError || !profile) return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-[13px] font-semibold text-red-600 dark:text-red-300">{t('error_generic')}</p>
    </div>
  );

  const fullName  = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email;
  const initials  = `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase() || '?';
  const statusKey = (profile.status === 'active' ? 'status_active' : 'status_suspended') as Parameters<typeof t>[0];

  const metrics = [
    { label: t('metric_status'),   value: t.has(statusKey) ? t(statusKey) : profile.status, accent: '#22C55E' },
    { label: t('metric_security'), value: t('metric_security_value'),                       accent: '#3B82F6' },
    {
      label: t('metric_phone'),
      value: profile.phone ? t('metric_phone_set') : t('metric_phone_missing'),
      accent: profile.phone ? '#DDAF3B' : '#94A3B8',
    },
    { label: t('metric_sections'), value: t('metric_sections_value'),                       accent: '#94A3B8' },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(221, 175, 59,0.12),_transparent_36%),linear-gradient(180deg,#faf8f2_0%,#f2efe7_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(221, 175, 59,0.12),_transparent_32%),linear-gradient(180deg,#0C1209_0%,#091009_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1280px] flex-1 flex-col gap-5 overflow-y-auto scrollbar-none px-3 py-4 sm:px-4 lg:px-6 lg:py-6">

        {/* Page header — matches /admin/clients shell */}
        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.08)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#DDAF3B]/18 bg-[#DDAF3B]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#9A7A13] dark:border-[#DDAF3B]/25 dark:bg-[#DDAF3B]/12 dark:text-[#F0D98C]">
                {t('badge_account')}
              </span>
              <h1 className="mt-4 text-[clamp(28px,3vw,42px)] font-black leading-[1.04] text-[#001201] dark:text-[#FFF9EC]">
                {t('page_title')}
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#6F6B5F] dark:text-[#A6A091]">
                {t('page_subtitle')}
              </p>

              <div className="mt-5 inline-flex items-center gap-3 rounded-[18px] border border-[#E7E1D5] bg-[#F8F6F1]/90 px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur dark:border-[#1E2E18] dark:bg-[#0C150B]/85">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#001201]/5 text-[13px] font-black text-[#001201] ring-1 ring-inset ring-[#001201]/8 dark:bg-[#FFF9EC]/8 dark:text-[#FFF9EC] dark:ring-[#FFF9EC]/10">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-black text-[#001201] dark:text-[#FFF9EC]">{fullName}</p>
                  <p className="truncate text-[12px] text-[#9B9588] dark:text-[#7E8A75]">{profile.email}</p>
                </div>
              </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:w-[560px]">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="group relative overflow-hidden rounded-[24px] border border-[#E9E4D8] bg-[#FBFAF7] px-5 py-4 shadow-[0_10px_30px_rgba(26,26,10,0.05)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-[#1E2E18] dark:bg-[#0C150B]"
                >
                  <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: metric.accent }} />
                  <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-3xl opacity-15 transition-opacity duration-200 group-hover:opacity-25" style={{ background: metric.accent }} />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]">{metric.label}</div>
                    <div className="mt-3 truncate text-[18px] font-black leading-tight text-[#001201] dark:text-[#FFF9EC]">{metric.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Identity + security sections — single column on mobile, side-by-side on lg+ */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">

        {/* Identity section */}
        <Section eyebrow="01" title={t('section_identity')}>
          <div className="flex flex-col gap-4">
            {identityErrs.general && <ErrorBanner>{identityErrs.general}</ErrorBanner>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="profile-firstname">{t('field_firstname')}</FieldLabel>
                <input
                  id="profile-firstname" type="text" value={firstName} maxLength={100}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`${inputBase} ${identityErrs.firstName ? inputErr : inputIdle}`}
                />
                {identityErrs.firstName && (
                  <p className="text-[12px] font-semibold text-red-600 dark:text-red-300">{identityErrs.firstName}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="profile-lastname">{t('field_lastname')}</FieldLabel>
                <input
                  id="profile-lastname" type="text" value={lastName} maxLength={100}
                  onChange={(e) => setLastName(e.target.value)}
                  className={`${inputBase} ${identityErrs.lastName ? inputErr : inputIdle}`}
                />
                {identityErrs.lastName && (
                  <p className="text-[12px] font-semibold text-red-600 dark:text-red-300">{identityErrs.lastName}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="profile-phone">{t('field_phone')}</FieldLabel>
              <input
                id="profile-phone" type="tel" value={phone} maxLength={30}
                placeholder={t('field_phone_placeholder')}
                onChange={(e) => setPhone(e.target.value)}
                className={`${inputBase} ${inputIdle}`}
              />
            </div>

            <div className="flex justify-end pt-1">
              <button type="button" onClick={handleSaveIdentity} disabled={savingIdent} className={primaryBtn}>
                {savingIdent && (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                )}
                {savingIdent ? t('btn_saving') : t('btn_save')}
              </button>
            </div>
          </div>
        </Section>

        {/* Right column — security: email + password stacked */}
        <div className="flex flex-col gap-5">

        {/* Email change */}
        <Section
          eyebrow="02"
          title={t('section_email')}
          description={`${t('field_email_current')} — ${profile.email}`}
        >
          <div className="flex flex-col gap-4">
            {emailErrs.general && <ErrorBanner>{emailErrs.general}</ErrorBanner>}

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="profile-email-new">{t('field_email_new')}</FieldLabel>
              <input
                id="profile-email-new" type="email" value={newEmail} maxLength={254}
                placeholder={t('field_email_new_placeholder')}
                onChange={(e) => setNewEmail(e.target.value)}
                className={`${inputBase} ${emailErrs.email ? inputErr : inputIdle}`}
              />
              {emailErrs.email && (
                <p className="text-[12px] font-semibold text-red-600 dark:text-red-300">{emailErrs.email}</p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <FieldLabel htmlFor="profile-email-otp">{t('field_otp')}</FieldLabel>
                <input
                  id="profile-email-otp" type="text" value={emailOtp} maxLength={6}
                  placeholder={t('field_otp_placeholder')}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric" autoComplete="one-time-code"
                  className={`${inputBase} font-mono tracking-[0.32em] ${emailErrs.otp ? inputErr : inputIdle}`}
                />
                {emailErrs.otp && (
                  <p className="text-[12px] font-semibold text-red-600 dark:text-red-300">{emailErrs.otp}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleRequestEmailOtp}
                disabled={sendingEmailOtp || emailCooldown > 0}
                className={secondaryBtn}
              >
                {emailCooldown > 0
                  ? t('btn_otp_sent', { seconds: emailCooldown })
                  : sendingEmailOtp ? '…' : t('btn_request_otp')}
              </button>
            </div>
            {emailOtpSent && (
              <p className="text-[12px] text-[#9B9588] dark:text-[#7E8A75]">{t('otp_hint')}</p>
            )}

            <div className="flex justify-end pt-1">
              <button type="button" onClick={handleChangeEmail} disabled={savingEmail} className={primaryBtn}>
                {savingEmail && (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                )}
                {savingEmail ? t('btn_saving') : t('btn_change_email')}
              </button>
            </div>
          </div>
        </Section>

        {/* Password change */}
        <Section eyebrow="03" title={t('section_password')}>
          <div className="flex flex-col gap-4">
            {pwdErrs.general && <ErrorBanner>{pwdErrs.general}</ErrorBanner>}

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="profile-pwd-current">{t('field_password_current')}</FieldLabel>
              <input
                id="profile-pwd-current" type="password" value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                autoComplete="current-password"
                className={`${inputBase} ${pwdErrs.currentPwd ? inputErr : inputIdle}`}
              />
              {pwdErrs.currentPwd && (
                <p className="text-[12px] font-semibold text-red-600 dark:text-red-300">{pwdErrs.currentPwd}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="profile-pwd-new">{t('field_password_new')}</FieldLabel>
                <input
                  id="profile-pwd-new" type="password" value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputBase} ${pwdErrs.newPwd ? inputErr : inputIdle}`}
                />
                {pwdErrs.newPwd && (
                  <p className="text-[12px] font-semibold text-red-600 dark:text-red-300">{pwdErrs.newPwd}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="profile-pwd-confirm">{t('field_password_confirm')}</FieldLabel>
                <input
                  id="profile-pwd-confirm" type="password" value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputBase} ${pwdErrs.confirmPwd ? inputErr : inputIdle}`}
                />
                {pwdErrs.confirmPwd && (
                  <p className="text-[12px] font-semibold text-red-600 dark:text-red-300">{pwdErrs.confirmPwd}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <FieldLabel htmlFor="profile-pwd-otp">{t('field_otp')}</FieldLabel>
                <input
                  id="profile-pwd-otp" type="text" value={pwdOtp} maxLength={6}
                  placeholder={t('field_otp_placeholder')}
                  onChange={(e) => setPwdOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric" autoComplete="one-time-code"
                  className={`${inputBase} font-mono tracking-[0.32em] ${pwdErrs.otp ? inputErr : inputIdle}`}
                />
                {pwdErrs.otp && (
                  <p className="text-[12px] font-semibold text-red-600 dark:text-red-300">{pwdErrs.otp}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleRequestPwdOtp}
                disabled={sendingPwdOtp || pwdCooldown > 0}
                className={secondaryBtn}
              >
                {pwdCooldown > 0
                  ? t('btn_otp_sent', { seconds: pwdCooldown })
                  : sendingPwdOtp ? '…' : t('btn_request_otp')}
              </button>
            </div>
            {pwdOtpSent && (
              <p className="text-[12px] text-[#9B9588] dark:text-[#7E8A75]">{t('otp_hint')}</p>
            )}

            <div className="flex justify-end pt-1">
              <button type="button" onClick={handleChangePassword} disabled={savingPwd} className={primaryBtn}>
                {savingPwd && (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                )}
                {savingPwd ? t('btn_saving') : t('btn_change_password')}
              </button>
            </div>
          </div>
        </Section>

        </div>{/* /right column */}
        </div>{/* /grid */}

        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_12px_40px_rgba(26,26,10,0.06)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90">
          <h2 className="mb-4 text-[14px] font-black text-[#001201] dark:text-[#FFF9EC]">{t('section_notifications')}</h2>
          <p className="mb-4 text-[13px] text-[#6F6B5F] dark:text-[#A6A091]">{t('section_notifications_hint')}</p>
          {([
            ['station_lifecycle', t('notif_station_lifecycle')],
            ['kyc_alerts', t('notif_kyc_alerts')],
            ['support_alerts', t('notif_support_alerts')],
          ] as const).map(([key, label]) => (
            <div key={key} className="mb-3 rounded-2xl border border-[#E1DBCF] bg-[#FBF9F3] p-3 dark:border-[#001A05] dark:bg-[#0E170B]">
              <p className="mb-2 text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{label}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {([
                  ['in_app', t('notif_channel_in_app')],
                  ['push', t('notif_channel_push')],
                  ['email', t('notif_channel_email')],
                ] as const).map(([channel, channelLabel]) => (
                  <label key={channel} className="flex items-center gap-2 rounded-lg border border-[#E1DBCF] px-3 py-2 text-[12px] dark:border-[#001A05]">
                    <input
                      type="checkbox"
                      checked={notifPrefs[key][channel]}
                      onChange={(e) => toggleNotif(key, channel, e.target.checked)}
                      className="h-4 w-4 accent-[#DDAF3B]"
                    />
                    <span className="font-semibold text-[#4F4C40] dark:text-[#D2CEBE]">{channelLabel}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveNotificationPrefs}
              disabled={savingNotif}
              className="rounded-lg bg-[#DDAF3B] px-4 py-2 text-[13px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingNotif ? t('btn_saving') : t('btn_save_notifications')}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}

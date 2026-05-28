'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi, patchWithApi } from '@/services/axios-service';

interface SupportSettings {
  support_email: string;
  max_open_tickets_per_user: string;
  auto_close_days: string;
  welcome_message: string;
}

const DEFAULTS: SupportSettings = {
  support_email: '',
  max_open_tickets_per_user: '5',
  auto_close_days: '30',
  welcome_message: '',
};

export function AdminSupportSettings() {
  const t = useTranslations('admin_support');
  const { success: toastSuccess, error: toastError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [settings, setSettings] = useState<SupportSettings>(DEFAULTS);
  const [committed, setCommitted] = useState<SupportSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [ok, data] = await getFromApi('/admin/support/settings');
        if (!mountedRef.current) return;
        if (ok) {
          const raw = (data as { data: Record<string, string> }).data ?? {};
          const loaded: SupportSettings = {
            support_email: raw.support_email ?? DEFAULTS.support_email,
            max_open_tickets_per_user: raw.max_open_tickets_per_user ?? DEFAULTS.max_open_tickets_per_user,
            auto_close_days: raw.auto_close_days ?? DEFAULTS.auto_close_days,
            welcome_message: raw.welcome_message ?? DEFAULTS.welcome_message,
          };
          setSettings(loaded);
          setCommitted(loaded);
        }
      } catch {
        // keep defaults
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, []);

  const isDirty =
    settings.support_email !== committed.support_email ||
    settings.max_open_tickets_per_user !== committed.max_open_tickets_per_user ||
    settings.auto_close_days !== committed.auto_close_days ||
    settings.welcome_message !== committed.welcome_message;

  function validate(): string | null {
    const email = settings.support_email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return t('settings_error_email');
    }
    const maxTickets = parseInt(settings.max_open_tickets_per_user, 10);
    if (isNaN(maxTickets) || maxTickets < 0) return t('settings_error_max_tickets');
    const autoClose = parseInt(settings.auto_close_days, 10);
    if (isNaN(autoClose) || autoClose < 1) return t('settings_error_auto_close');
    if (/<[^>]*>/i.test(settings.welcome_message)) return t('settings_error_html');
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { toastError(err); return; }
    setSaving(true);
    try {
      const trimmed = { ...settings, support_email: settings.support_email.trim(), welcome_message: settings.welcome_message.trim() };
      const payload: Record<string, string> = {};
      if (trimmed.support_email !== committed.support_email) payload.support_email = trimmed.support_email;
      if (trimmed.max_open_tickets_per_user !== committed.max_open_tickets_per_user) payload.max_open_tickets_per_user = trimmed.max_open_tickets_per_user;
      if (trimmed.auto_close_days !== committed.auto_close_days) payload.auto_close_days = trimmed.auto_close_days;
      if (trimmed.welcome_message !== committed.welcome_message) payload.welcome_message = trimmed.welcome_message;

      if (Object.keys(payload).length === 0) { setSaving(false); return; }

      const [ok] = await patchWithApi('/admin/support/settings', payload);
      if (!mountedRef.current) return;
      if (ok) {
        setSettings(trimmed);
        setCommitted({ ...trimmed });
        toastSuccess(t('settings_save_success'));
      } else {
        toastError(t('settings_save_error'));
      }
    } catch {
      if (mountedRef.current) toastError(t('settings_save_error'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DDAF3B]/10 text-[#DDAF3B]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
          </div>
          <h2 className="text-[13px] font-black uppercase tracking-wider text-[#001201] dark:text-[#FFF9EC]">{t('settings_title')}</h2>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && !saving && (
            <span className="text-[12px] font-semibold text-[#AAAAAA] dark:text-[#A0A090]">{t('settings_unsaved')}</span>
          )}
          <button type="submit" disabled={saving || !isDirty}
            className="relative rounded-[10px] bg-[#DDAF3B] px-5 py-2 text-[13px] font-bold text-[#0C1209] shadow-sm transition-all hover:bg-[#D4A830] disabled:opacity-50">
            {saving ? t('settings_saving') : t('settings_save')}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Support email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="support-email" className="text-[12px] font-black uppercase tracking-wider text-[#A0A090] dark:text-[#9A9A8A]">{t('settings_email_label')}</label>
          <input id="support-email" type="email" maxLength={254} value={settings.support_email}
            onChange={(e) => setSettings((s) => ({ ...s, support_email: e.target.value }))}
            placeholder="support@Hurryline.ca"
            className="rounded-[10px] border-2 border-[#D8D4C8] bg-white px-4 py-2.5 text-[13px] text-[#001201] outline-none transition-all focus:border-[#DDAF3B] focus:shadow-[0_0_0_4px_rgba(221, 175, 59,0.12)] dark:border-[#001A05] dark:bg-[#0F1A0C] dark:text-[#FFF9EC] dark:focus:border-[#DDAF3B]" />
          <p className="text-[12px] text-[#AAAAAA] dark:text-[#A0A090]">{t('settings_email_hint')}</p>
        </div>

        {/* Max open tickets */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="max-tickets" className="text-[12px] font-black uppercase tracking-wider text-[#A0A090] dark:text-[#9A9A8A]">{t('settings_max_tickets_label')}</label>
          <input id="max-tickets" type="number" min={0} max={100} value={settings.max_open_tickets_per_user}
            onChange={(e) => setSettings((s) => ({ ...s, max_open_tickets_per_user: e.target.value }))}
            className="rounded-[10px] border-2 border-[#D8D4C8] bg-white px-4 py-2.5 text-[13px] text-[#001201] outline-none transition-all [appearance:textfield] focus:border-[#DDAF3B] focus:shadow-[0_0_0_4px_rgba(221, 175, 59,0.12)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none dark:border-[#001A05] dark:bg-[#0F1A0C] dark:text-[#FFF9EC] dark:focus:border-[#DDAF3B]" />
          <p className="text-[12px] text-[#AAAAAA] dark:text-[#A0A090]">{t('settings_max_tickets_hint')}</p>
        </div>

        {/* Auto close days */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="auto-close" className="text-[12px] font-black uppercase tracking-wider text-[#A0A090] dark:text-[#9A9A8A]">{t('settings_auto_close_label')}</label>
          <input id="auto-close" type="number" min={1} max={365} value={settings.auto_close_days}
            onChange={(e) => setSettings((s) => ({ ...s, auto_close_days: e.target.value }))}
            className="rounded-[10px] border-2 border-[#D8D4C8] bg-white px-4 py-2.5 text-[13px] text-[#001201] outline-none transition-all [appearance:textfield] focus:border-[#DDAF3B] focus:shadow-[0_0_0_4px_rgba(221, 175, 59,0.12)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none dark:border-[#001A05] dark:bg-[#0F1A0C] dark:text-[#FFF9EC] dark:focus:border-[#DDAF3B]" />
          <p className="text-[12px] text-[#AAAAAA] dark:text-[#A0A090]">{t('settings_auto_close_hint')}</p>
        </div>

        {/* Welcome message */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="welcome-msg" className="text-[12px] font-black uppercase tracking-wider text-[#A0A090] dark:text-[#9A9A8A]">{t('settings_welcome_label')}</label>
          <textarea id="welcome-msg" rows={3} maxLength={500} value={settings.welcome_message}
            onChange={(e) => setSettings((s) => ({ ...s, welcome_message: e.target.value }))}
            placeholder={t('settings_welcome_placeholder')}
            className="w-full resize-none rounded-[10px] border-2 border-[#D8D4C8] bg-white px-4 py-2.5 text-[13px] text-[#001201] outline-none transition-all focus:border-[#DDAF3B] focus:shadow-[0_0_0_4px_rgba(221, 175, 59,0.12)] dark:border-[#001A05] dark:bg-[#0F1A0C] dark:text-[#FFF9EC] dark:focus:border-[#DDAF3B]" />
          <p className="text-[12px] text-[#AAAAAA] dark:text-[#A0A090]">{t('settings_welcome_hint')}</p>
        </div>
      </div>
    </form>
  );
}

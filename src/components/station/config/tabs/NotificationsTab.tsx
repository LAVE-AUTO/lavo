'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi, patchWithApi } from '@/services';
import { PageLoader } from '@/components/ui/PageLoader';

interface Props {
  locked: boolean;
}

type NotifKey = 'queue_new' | 'no_show' | 'auto_switch' | 'stripe_transfer' | 'daily_report';

const NOTIF_KEYS: NotifKey[] = [
  'queue_new',
  'no_show',
  'auto_switch',
  'stripe_transfer',
  'daily_report',
];

type NotifPrefs = Record<NotifKey, boolean>;

const DEFAULT_PREFS: NotifPrefs = {
  queue_new: true,
  no_show: true,
  auto_switch: true,
  stripe_transfer: true,
  daily_report: false,
};

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#F0EDE4] py-3 last:border-b-0 dark:border-[#1A2A14]">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{label}</span>
        <span className="text-[12px] leading-snug text-[#888] dark:text-[#9A9A8A]">{hint}</span>
      </div>
      <label className="relative inline-flex h-6 w-11 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={`absolute inset-0 rounded-full transition-colors ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          } ${checked ? 'bg-[#C49A1E]' : 'bg-[#D8D4C8] dark:bg-[#243020]'}`}
          aria-hidden="true"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              checked ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </label>
    </div>
  );
}

export function NotificationsTab({ locked }: Props) {
  const t = useTranslations('station_config');
  const { success, error: showError } = useToast();

  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPrefs = useCallback(async () => {
    const [ok, data] = await getFromApi('/station/notification-prefs');
    if (ok) {
      const raw = (data as { data: Record<string, unknown> }).data ?? {};
      setPrefs({
        queue_new: raw.queue_new !== false,
        no_show: raw.no_show !== false,
        auto_switch: raw.auto_switch !== false,
        stripe_transfer: raw.stripe_transfer !== false,
        daily_report: raw.daily_report === true,
      });
    } else {
      showError(t('notifications_load_error'));
    }
    setLoading(false);
  }, [showError, t]);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  async function handleSave() {
    setSaving(true);
    const [ok] = await patchWithApi('/station/notification-prefs', prefs);
    if (ok) {
      success(t('notifications_save_success'));
    } else {
      showError(t('notifications_save_error'));
    }
    setSaving(false);
  }

  if (loading) {
    return <PageLoader label={t('loading')} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-[#E8E4DC] bg-white p-6 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[1.5px] text-[#C49A1E]">
          {t('notifications_card_title')}
        </h3>
        <p className="mb-4 text-[12px] leading-snug text-[#888] dark:text-[#9A9A8A]">
          {t('notifications_card_hint')}
        </p>
        <div className="flex flex-col">
          {NOTIF_KEYS.map((k) => (
            <ToggleRow
              key={k}
              label={t(`notifications_${k}_label`)}
              hint={t(`notifications_${k}_hint`)}
              checked={prefs[k]}
              disabled={locked || saving}
              onChange={(v) => setPrefs((prev) => ({ ...prev, [k]: v }))}
            />
          ))}
        </div>
      </section>

      <div
        className="rounded-xl border border-blue-300/30 bg-blue-50 px-4 py-3 text-[12px] leading-snug text-blue-900/80 dark:border-blue-500/20 dark:bg-blue-950/15 dark:text-blue-300/80"
        role="note"
      >
        {t('notifications_client_info')}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={locked || saving}
          className="flex items-center gap-2 rounded-xl bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          ) : null}
          {t('notifications_btn_save')}
        </button>
      </div>
    </div>
  );
}

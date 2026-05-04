'use client';

import { useTranslations } from 'next-intl';
import { BackendMissingBanner } from '../BackendMissingBanner';

interface Props {
  locked: boolean;
}

const NOTIF_KEYS = [
  'queue_new',
  'no_show',
  'auto_switch',
  'stripe_transfer',
  'daily_report',
] as const;

function ToggleRow({
  label,
  hint,
  defaultChecked,
  disabled,
}: {
  label: string;
  hint: string;
  defaultChecked: boolean;
  disabled: boolean;
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
          checked={defaultChecked}
          disabled={disabled}
          readOnly
          className="peer sr-only"
        />
        <span
          className={`absolute inset-0 rounded-full transition-colors ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          } ${defaultChecked ? 'bg-[#C49A1E]' : 'bg-[#D8D4C8] dark:bg-[#243020]'}`}
          aria-hidden="true"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              defaultChecked ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </label>
    </div>
  );
}

export function NotificationsTab({ locked }: Props) {
  const t = useTranslations('station_config');

  return (
    <div className="flex flex-col gap-5">
      <BackendMissingBanner
        endpoints={[
          'GET /station/notification-prefs',
          'PATCH /station/notification-prefs { queue_new, no_show, auto_switch, stripe_transfer, daily_report }',
        ]}
      />

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
              defaultChecked={false}
              disabled={true}
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
          disabled
          title={t('backend_missing_save_disabled')}
          className="flex items-center gap-2 rounded-xl bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] opacity-40 cursor-not-allowed"
        >
          {t('notifications_btn_save')}
        </button>
      </div>

      {locked && <span className="sr-only" aria-hidden="true" />}
    </div>
  );
}

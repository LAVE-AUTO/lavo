'use client';

import { useTranslations } from 'next-intl';
import { BackendMissingBanner } from '../BackendMissingBanner';

interface Props {
  locked: boolean;
}

const inputClass =
  'w-full rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none transition-colors duration-150 placeholder:text-[#BBBBAA] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#888] dark:text-[#9A9A8A]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Card({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative rounded-2xl border border-[#E8E4DC] bg-white p-6 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#C49A1E]">{title}</h3>
        {badge && (
          <span className="rounded-full border border-[#E0DCD0] bg-[#F7F6F2] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#888] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#9A9A8A]">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, disabled }: { checked: boolean; disabled: boolean }) {
  return (
    <label className="relative inline-flex h-6 w-11 shrink-0">
      <input type="checkbox" checked={checked} disabled={disabled} readOnly className="peer sr-only" />
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
  );
}

export function PaymentsTab({ locked }: Props) {
  const t = useTranslations('station_config');

  return (
    <div className="flex flex-col gap-5">
      <BackendMissingBanner
        endpoints={[
          'GET /station/payout-account',
          'PATCH /station/payout-account { institution, transit, account_number, payout_frequency }',
          'GET /station/tax-info',
          'PATCH /station/tax-info { gst_number, qst_number, province }',
          'GET /station/receipt-prefs',
          'PATCH /station/receipt-prefs { email_receipt, sms_receipt }',
        ]}
      />

      <Card title={t('payments_bank_title')} badge={t('payments_pending_label')}>
        <div className="flex flex-col gap-4">
          <Field label={t('payments_bank_institution')}>
            <input
              className={inputClass}
              type="text"
              placeholder={t('payments_bank_institution_placeholder')}
              disabled
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('payments_bank_transit')}>
              <input className={inputClass + ' font-mono'} type="text" placeholder="00000" disabled />
            </Field>
            <Field label={t('payments_bank_account')}>
              <input className={inputClass + ' font-mono'} type="text" placeholder="0000000" disabled />
            </Field>
          </div>
          <Field label={t('payments_payout_frequency')}>
            <select className={inputClass + ' appearance-none'} disabled>
              <option>{t('payments_payout_daily')}</option>
              <option>{t('payments_payout_weekly')}</option>
              <option>{t('payments_payout_monthly')}</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card title={t('payments_tax_title')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('payments_tax_gst')}>
            <input className={inputClass + ' font-mono'} type="text" placeholder="000000000RT0001" disabled />
          </Field>
          <Field label={t('payments_tax_qst')}>
            <input className={inputClass + ' font-mono'} type="text" placeholder="0000000000TQ0001" disabled />
          </Field>
          <Field label={t('payments_tax_province')}>
            <select className={inputClass + ' appearance-none'} disabled>
              <option>{t('payments_tax_province_qc')}</option>
              <option>{t('payments_tax_province_on')}</option>
            </select>
          </Field>
          <div className="flex flex-col items-center justify-center rounded-xl bg-[#F7F6F2] px-4 py-3 dark:bg-[#0F1A0C]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">
              {t('payments_tax_total_rate')}
            </span>
            <span className="font-mono text-[22px] font-black text-[#C49A1E]">—</span>
            <span className="text-[11px] text-[#888] dark:text-[#9A9A8A]">{t('payments_tax_breakdown')}</span>
          </div>
        </div>
      </Card>

      <Card title={t('payments_receipts_title')}>
        <div className="flex flex-col">
          <div className="flex items-center justify-between border-b border-[#F0EDE4] py-3 dark:border-[#1A2A14]">
            <span className="text-[13px] font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">
              {t('payments_receipts_email')}
            </span>
            <Toggle checked={false} disabled={true} />
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-[13px] font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">
              {t('payments_receipts_sms')}
            </span>
            <Toggle checked={false} disabled={true} />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          disabled
          title={t('backend_missing_save_disabled')}
          className="flex items-center gap-2 rounded-xl bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] opacity-40 cursor-not-allowed"
        >
          {t('payments_btn_save')}
        </button>
      </div>

      {locked && <span className="sr-only" aria-hidden="true" />}
    </div>
  );
}

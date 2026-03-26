'use client';

import { useTranslations } from 'next-intl';

export interface StationAccountData {
  firstName: string;
  lastName:  string;
  email:     string;
  phone:     string;
}

export interface StationAccountErrors {
  firstName?: string;
  lastName?:  string;
  email?:     string;
}

interface Props {
  data:    StationAccountData;
  errors:  StationAccountErrors;
  busy:    boolean;
  onChange: (data: StationAccountData) => void;
  onNext:  () => void;
  onClose: () => void;
}

const inputBase  = 'w-full rounded-lg border bg-transparent px-3 py-2 text-[13px] text-[#1A1A0A] outline-none transition-all dark:text-[#F0EDD4]';
const inputIdle  = 'border-[#D8D4C8] focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] dark:border-[#243020] dark:focus:border-[#C49A1E]';
const inputError = 'border-red-400 focus:border-red-400';

export function AdminAddStationAccount({ data, errors, busy, onChange, onNext, onClose }: Props) {
  const t = useTranslations('admin_add_station');

  return (
    <>
      <div className="flex flex-col gap-4 px-6 py-5">

        {/* Name row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="stn-add-firstname" className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_firstname')}</label>
            <input id="stn-add-firstname" type="text" value={data.firstName} maxLength={100}
              required aria-required="true" autoFocus
              placeholder={t('field_firstname_placeholder')}
              onChange={(e) => onChange({ ...data, firstName: e.target.value })}
              className={`${inputBase} ${errors.firstName ? inputError : inputIdle}`} />
            {errors.firstName && <p className="text-[11px] font-semibold text-red-500">{errors.firstName}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="stn-add-lastname" className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_lastname')}</label>
            <input id="stn-add-lastname" type="text" value={data.lastName} maxLength={100}
              required aria-required="true"
              placeholder={t('field_lastname_placeholder')}
              onChange={(e) => onChange({ ...data, lastName: e.target.value })}
              className={`${inputBase} ${errors.lastName ? inputError : inputIdle}`} />
            {errors.lastName && <p className="text-[11px] font-semibold text-red-500">{errors.lastName}</p>}
          </div>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="stn-add-email" className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_email')}</label>
          <input id="stn-add-email" type="email" value={data.email} maxLength={254}
            required aria-required="true"
            placeholder={t('field_email_placeholder')}
            onChange={(e) => onChange({ ...data, email: e.target.value })}
            className={`${inputBase} ${errors.email ? inputError : inputIdle}`} />
          {errors.email && <p className="text-[11px] font-semibold text-red-500">{errors.email}</p>}
        </div>

        {/* Phone (optional) */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="stn-add-phone" className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_phone')}</label>
          <input id="stn-add-phone" type="tel" value={data.phone} maxLength={20}
            placeholder={t('field_phone_placeholder')}
            onChange={(e) => onChange({ ...data, phone: e.target.value })}
            className={`${inputBase} ${inputIdle}`} />
        </div>

        {/* Password notice */}
        <div className="flex items-start gap-2 rounded-lg bg-[#F5F3EE] px-3 py-2.5 dark:bg-[#131E10]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-[11px] leading-snug text-[#666] dark:text-[#8A8A7A]">{t('password_notice')}</p>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
        <button type="button" onClick={onClose} disabled={busy}
          className="rounded-lg border border-[#D8D4C8] px-4 py-2 text-[12px] font-semibold text-[#666] transition-colors hover:bg-[#F5F3EE] disabled:opacity-50 dark:border-[#243020] dark:text-[#9A9A8A]">
          {t('btn_cancel')}
        </button>
        <button type="button" onClick={onNext} disabled={busy}
          className="rounded-lg bg-[#C49A1E] px-4 py-2 text-[12px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14] disabled:opacity-50">
          {t('btn_next')}
        </button>
      </div>
    </>
  );
}

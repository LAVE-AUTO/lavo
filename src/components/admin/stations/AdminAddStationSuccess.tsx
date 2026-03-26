'use client';

import { useTranslations } from 'next-intl';
import type { DocsMode } from './AdminAddStationDocs';

export interface StationSuccessData {
  email:      string;
  first_name: string;
  last_name:  string;
  docsMode:   DocsMode;
}

interface Props {
  data:    StationSuccessData;
  onClose: () => void;
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// NOTE: This component is preview-only. The force_password_change flag, credential email,
// and KYC document linking will only be enforced once the POST /admin/stations API endpoint is wired.
// The success screen is not reachable until then (handleSubmit in AdminAddStationModal is disabled).
export function AdminAddStationSuccess({ data, onClose }: Props) {
  const t = useTranslations('admin_add_station');

  return (
    <>
      <div className="flex flex-col items-start gap-5 px-6 py-5">

        {/* Icon + name */}
        <div className="flex w-full items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00C851]/12 text-[#00C851]">
            <CheckIcon />
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
              {data.first_name} {data.last_name}
              <span className="ml-2 inline-flex items-center rounded-full border border-[#C49A1E]/30 bg-[#C49A1E]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#C49A1E]">
                {t('role_station')}
              </span>
            </p>
            <p className="text-[12px] text-[#888] dark:text-[#6A6A5A]">{t('success_account_created')}</p>
          </div>
        </div>

        {/* Email sent */}
        <div className="flex w-full gap-2.5 rounded-xl border border-[#00C851]/20 bg-[#00C851]/6 px-4 py-3.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <div className="flex flex-col gap-0.5">
            <p className="text-[12px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('success_email_sent_title')}</p>
            <p className="text-[11px] leading-relaxed text-[#555] dark:text-[#8A8A7A]">
              {t('success_email_sent_body', { email: data.email })}
            </p>
          </div>
        </div>

        {/* KYC notice — adapts based on docs mode */}
        <div className="flex w-full gap-2.5 rounded-xl border border-[#C49A1E]/20 bg-[#C49A1E]/6 px-4 py-3.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div className="flex flex-col gap-0.5">
            <p className="text-[12px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('success_kyc_notice_title')}</p>
            <p className="text-[11px] leading-relaxed text-[#555] dark:text-[#8A8A7A]">
              {data.docsMode === 'now' ? t('success_docs_uploaded_notice') : t('success_kyc_notice_body')}
            </p>
          </div>
        </div>

        {/* Force password change */}
        <div className="flex w-full gap-2.5 rounded-xl border border-[#FF8800]/20 bg-[#FF8800]/6 px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF8800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p className="text-[11px] leading-relaxed text-[#1A1A0A] dark:text-[#F0EDD4]">{t('success_force_change_notice')}</p>
        </div>
      </div>

      <div className="flex justify-end border-t border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
        <button type="button" onClick={onClose}
          className="rounded-lg bg-[#C49A1E] px-4 py-2 text-[12px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14]">
          {t('btn_close')}
        </button>
      </div>
    </>
  );
}

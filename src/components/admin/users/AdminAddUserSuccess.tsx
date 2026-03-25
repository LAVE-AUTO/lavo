'use client';

import { useTranslations } from 'next-intl';
import type { Role } from './AdminAddUserForm';

interface SuccessData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: Role;
}

interface Props {
  data: SuccessData;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

export function AdminAddUserSuccess({ data, copied, onCopy, onClose }: Props) {
  const t = useTranslations('admin_add_user');

  return (
    <>
      <div className="flex flex-col items-start gap-5 px-6 py-5">

        {/* Icon + confirmation */}
        <div className="flex w-full items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00C851]/12 text-[#00C851]">
            <CheckIcon />
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
              {data.first_name} {data.last_name}
              <span className="ml-2 inline-flex items-center rounded-full border border-[#C49A1E]/30 bg-[#C49A1E]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#C49A1E]">
                {t(`role_${data.role}`)}
              </span>
            </p>
            <p className="text-[12px] text-[#888] dark:text-[#6A6A5A]">{t('success_account_created')}</p>
          </div>
        </div>

        {/* Credentials box */}
        <div className="w-full overflow-hidden rounded-xl border border-[#E8E4DC] dark:border-[#1E2E18]">
          <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-4 py-2.5 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{t('success_credentials_title')}</span>
          </div>
          <div className="flex flex-col gap-0 divide-y divide-[#F0EDE6] dark:divide-[#1A2A14]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[11px] font-semibold text-[#888] dark:text-[#6A6A5A]">{t('success_email_label')}</span>
              <span className="font-mono text-[12px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{data.email}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[11px] font-semibold text-[#888] dark:text-[#6A6A5A]">{t('success_password_label')}</span>
              <span className="font-mono text-[12px] font-bold tracking-wider text-[#1A1A0A] dark:text-[#F0EDD4]">{data.password}</span>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex w-full gap-2.5 rounded-xl border border-[#00C851]/20 bg-[#00C851]/6 px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-[11px] leading-relaxed text-[#1A1A0A] dark:text-[#F0EDD4]">{t('success_info')}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
        <button type="button" onClick={onCopy}
          className="flex items-center gap-1.5 rounded-lg border border-[#D8D4C8] px-4 py-2 text-[12px] font-semibold text-[#666] transition-colors hover:bg-[#F5F3EE] dark:border-[#243020] dark:text-[#9A9A8A]">
          <CopyIcon />
          {copied ? t('btn_copied') : t('copy_credentials')}
        </button>
        <button type="button" onClick={onClose}
          className="rounded-lg bg-[#C49A1E] px-4 py-2 text-[12px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14]">
          {t('btn_close')}
        </button>
      </div>
    </>
  );
}

'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

export type Role = 'client' | 'admin';

interface Props {
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  errors: Record<string, string>;
  busy: boolean;
  onRoleChange: (r: Role) => void;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onRegenerate: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

const inputBase =
  'w-full rounded-lg border bg-transparent px-3 py-2 text-[13px] text-[#1A1A0A] outline-none transition-all dark:text-[#F0EDD4]';
const inputIdle =
  'border-[#D8D4C8] focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] dark:border-[#243020] dark:focus:border-[#C49A1E]';
const inputError = 'border-red-400 focus:border-red-400';

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

export function AdminAddUserForm({
  role, firstName, lastName, email, password, errors, busy,
  onRoleChange, onFirstNameChange, onLastNameChange, onEmailChange,
  onRegenerate, onSubmit, onClose,
}: Props) {
  const t = useTranslations('admin_add_user');

  const handleCopyPassword = useCallback(async () => {
    try { await navigator.clipboard.writeText(password); } catch { /* silent */ }
  }, [password]);

  return (
    <>
      <div className="flex flex-col gap-4 px-6 py-5">

        {/* Role toggle */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_role')}</span>
          <div className="flex overflow-hidden rounded-[10px] border border-[#D8D4C8] bg-[#F5F3EE] p-0.5 dark:border-[#243020] dark:bg-[#0F1A0C]">
            {(['client', 'admin'] as Role[]).map((r) => (
              <button key={r} type="button" onClick={() => onRoleChange(r)}
                className={[
                  'flex-1 rounded-[8px] py-2 text-[12px] font-bold transition-all duration-150',
                  role === r
                    ? 'bg-[#C49A1E] text-[#0C1209] shadow-sm'
                    : 'text-[#888] hover:text-[#555] dark:text-[#6A6A5A] dark:hover:text-[#9A9A8A]',
                ].join(' ')}>
                {t(`role_${r}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_firstname')}</label>
            <input type="text" value={firstName} onChange={(e) => onFirstNameChange(e.target.value)}
              placeholder={t('field_firstname_placeholder')}
              className={`${inputBase} ${errors.first_name ? inputError : inputIdle}`} />
            {errors.first_name && <p className="text-[11px] font-semibold text-red-500">{errors.first_name}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_lastname')}</label>
            <input type="text" value={lastName} onChange={(e) => onLastNameChange(e.target.value)}
              placeholder={t('field_lastname_placeholder')}
              className={`${inputBase} ${errors.last_name ? inputError : inputIdle}`} />
            {errors.last_name && <p className="text-[11px] font-semibold text-red-500">{errors.last_name}</p>}
          </div>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_email')}</label>
          <input type="email" value={email} onChange={(e) => onEmailChange(e.target.value)}
            placeholder={t('field_email_placeholder')}
            className={`${inputBase} ${errors.email ? inputError : inputIdle}`} />
          {errors.email && <p className="text-[11px] font-semibold text-red-500">{errors.email}</p>}
        </div>

        {/* Generated password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_password')}</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input type="text" readOnly value={password}
                className="w-full cursor-default rounded-lg border border-[#D8D4C8] bg-[#F9F8F5] px-3 py-2 font-mono text-[12px] text-[#444] dark:border-[#243020] dark:bg-[#131E10] dark:text-[#B0ADA0]" />
              <button type="button" onClick={handleCopyPassword} tabIndex={-1}
                title={t('btn_copy')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#BBBBAA] hover:text-[#555] dark:hover:text-[#9A9A8A]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
              </button>
            </div>
            <button type="button" onClick={onRegenerate} title={t('btn_regenerate')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D8D4C8] text-[#888] transition-colors hover:border-[#C49A1E] hover:text-[#C49A1E] dark:border-[#243020] dark:text-[#6A6A5A]">
              <RefreshIcon />
            </button>
          </div>
          <p className="text-[11px] leading-snug text-[#BBBBAA] dark:text-[#4A4A3A]">{t('field_password_hint')}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
        <button type="button" onClick={onClose} disabled={busy}
          className="rounded-lg border border-[#D8D4C8] px-4 py-2 text-[12px] font-semibold text-[#666] transition-colors hover:bg-[#F5F3EE] disabled:opacity-50 dark:border-[#243020] dark:text-[#9A9A8A]">
          {t('btn_cancel')}
        </button>
        <button type="button" onClick={onSubmit} disabled={busy}
          className="rounded-lg bg-[#C49A1E] px-4 py-2 text-[12px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14] disabled:opacity-50">
          {busy ? t('btn_creating') : t('btn_create')}
        </button>
      </div>
    </>
  );
}

'use client';

import { useTranslations } from 'next-intl';

export type Role = 'client' | 'admin';

interface Props {
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  errors: Record<string, string>;
  busy: boolean;
  onRoleChange: (r: Role) => void;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const inputBase =
  'w-full rounded-lg border bg-transparent px-3 py-2 text-[13px] text-[#001201] outline-none transition-all dark:text-[#FFF9EC]';
const inputIdle =
  'border-[#D8D4C8] focus:border-[#DDAF3B] focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.10)] dark:border-[#001A05] dark:focus:border-[#DDAF3B]';
const inputError = 'border-red-400 focus:border-red-400';

export function AdminAddUserForm({
  role, firstName, lastName, email, errors, busy,
  onRoleChange, onFirstNameChange, onLastNameChange, onEmailChange,
  onSubmit, onClose,
}: Props) {
  const t = useTranslations('admin_add_user');

  return (
    <>
      <div className="flex flex-col gap-4 px-6 py-5">

        {/* Role toggle */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_role')}</span>
          <div className="flex overflow-hidden rounded-[10px] border border-[#D8D4C8] bg-[#F5F3EE] p-0.5 dark:border-[#001A05] dark:bg-[#001201]">
            {(['client', 'admin'] as Role[]).map((r) => (
              <button key={r} type="button" onClick={() => onRoleChange(r)}
                className={[
                  'flex-1 rounded-[8px] py-2 text-[13px] font-bold transition-all duration-150',
                  role === r
                    ? 'bg-[#DDAF3B] text-[#0C1209] shadow-sm'
                    : 'text-foreground/55 hover:text-foreground/70 dark:text-[#9A9A8A] dark:hover:text-[#9A9A8A]',
                ].join(' ')}>
                {t(`role_${r}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Name row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-firstname" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_firstname')}</label>
            <input id="add-user-firstname" type="text" value={firstName} onChange={(e) => onFirstNameChange(e.target.value)}
              placeholder={t('field_firstname_placeholder')} maxLength={100}
              className={`${inputBase} ${errors.first_name ? inputError : inputIdle}`} />
            {errors.first_name && <p className="text-[12px] font-semibold text-red-500">{errors.first_name}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-lastname" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_lastname')}</label>
            <input id="add-user-lastname" type="text" value={lastName} onChange={(e) => onLastNameChange(e.target.value)}
              placeholder={t('field_lastname_placeholder')} maxLength={100}
              className={`${inputBase} ${errors.last_name ? inputError : inputIdle}`} />
            {errors.last_name && <p className="text-[12px] font-semibold text-red-500">{errors.last_name}</p>}
          </div>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="add-user-email" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_email')}</label>
          <input id="add-user-email" type="email" value={email} onChange={(e) => onEmailChange(e.target.value)}
            placeholder={t('field_email_placeholder')} maxLength={254}
            className={`${inputBase} ${errors.email ? inputError : inputIdle}`} />
          {errors.email && <p className="text-[12px] font-semibold text-red-500">{errors.email}</p>}
        </div>

        {/* Info notice */}
        <div className="flex items-start gap-2 rounded-lg bg-[#F5F3EE] px-3 py-2.5 dark:bg-[#131E10]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-[12px] leading-snug text-foreground/65 dark:text-[#A0A090]">{t('form_password_notice')}</p>
        </div>

      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
        <button type="button" onClick={onClose} disabled={busy}
          className="rounded-lg border border-[#D8D4C8] px-4 py-2 text-[13px] font-semibold text-foreground/65 transition-colors hover:bg-[#F5F3EE] disabled:opacity-50 dark:border-[#001A05] dark:text-[#9A9A8A]">
          {t('btn_cancel')}
        </button>
        <button type="button" onClick={onSubmit} disabled={busy}
          className="rounded-lg bg-[#DDAF3B] px-4 py-2 text-[13px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14] disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? t('btn_creating') : t('btn_create')}
        </button>
      </div>
    </>
  );
}

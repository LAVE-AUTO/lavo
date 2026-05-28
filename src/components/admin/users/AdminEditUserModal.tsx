'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { updateWithApi } from '@/services';

interface UserData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string;
}

interface Props {
  open:    boolean;
  user:    UserData | null;
  onClose: () => void;
  onSaved: (updated: UserData) => void;
}

const STATUS_VALUES = ['active', 'suspended', 'blocked', 'pending_verification'] as const;

const inputBase  = 'w-full rounded-lg border bg-transparent px-3 py-2 text-[13px] text-[#1A1A0A] outline-none transition-all dark:text-[#F0EDD4]';
const inputIdle  = 'border-[#D8D4C8] focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] dark:border-[#243020] dark:focus:border-[#C49A1E]';
const inputError = 'border-red-400 focus:border-red-400';

/**
 * Slide-over modal for editing an existing user's basic fields.
 * PUTs /api/v1/admin/users/:id on submit.
 */
export function AdminEditUserModal({ open, user, onClose, onSaved }: Props) {
  const t = useTranslations('admin_edit_user');

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [status,    setStatus]    = useState('active');
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [busy,      setBusy]      = useState(false);

  useEffect(() => {
    if (open && user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
      setPhone(user.phone ?? '');
      setStatus(user.status);
      setErrors({});
      setBusy(false);
    }
  }, [open, user]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [busy, onClose]);

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!firstName.trim())                  errs.first_name = t('error_firstname_required');
    else if (firstName.trim().length > 100) errs.first_name = t('error_firstname_too_long');
    if (!lastName.trim())                   errs.last_name  = t('error_lastname_required');
    else if (lastName.trim().length > 100)  errs.last_name  = t('error_lastname_too_long');
    return errs;
  }

  async function handleSubmit() {
    if (!user) return;
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setBusy(true);
    try {
      const payload: Record<string, string> = {
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        status,
      };
      if (phone.trim()) payload.phone = phone.trim();

      const [ok, data] = await updateWithApi(`/admin/users/${user.id}`, payload);
      if (ok) {
        onSaved((data as { data: UserData }).data);
        onClose();
      } else {
        const errData = data as { message?: string };
        setErrors({ general: errData?.message ?? t('error_generic') });
      }
    } catch {
      setErrors({ general: t('error_generic') });
    } finally {
      setBusy(false);
    }
  }

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />

      <div className="relative z-10 w-full max-w-[480px] animate-fade-in-up overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-2xl dark:border-[#1E2E18] dark:bg-[#0F1A0C]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
          <h2 className="text-[15px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('modal_title')}</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('btn_close')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#BBBBAA] transition-colors hover:bg-[#F0EDE6] hover:text-foreground/70 disabled:opacity-40 dark:hover:bg-[#1A2A14]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-6 py-5">

          {errors.general && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
              {errors.general}
            </div>
          )}

          {/* Name */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-user-firstname" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_firstname')}</label>
              <input id="edit-user-firstname" type="text" value={firstName} maxLength={100}
                onChange={(e) => setFirstName(e.target.value)}
                className={`${inputBase} ${errors.first_name ? inputError : inputIdle}`} />
              {errors.first_name && <p className="text-[12px] font-semibold text-red-500">{errors.first_name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-user-lastname" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_lastname')}</label>
              <input id="edit-user-lastname" type="text" value={lastName} maxLength={100}
                onChange={(e) => setLastName(e.target.value)}
                className={`${inputBase} ${errors.last_name ? inputError : inputIdle}`} />
              {errors.last_name && <p className="text-[12px] font-semibold text-red-500">{errors.last_name}</p>}
            </div>
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-phone" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_phone')}</label>
            <input id="edit-user-phone" type="tel" value={phone} maxLength={30}
              placeholder={t('field_phone_placeholder')}
              onChange={(e) => setPhone(e.target.value)}
              className={`${inputBase} ${inputIdle}`} />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-status" className="text-[13px] font-bold text-foreground/70 dark:text-[#9A9A8A]">{t('field_status')}</label>
            <select id="edit-user-status" value={status} onChange={(e) => setStatus(e.target.value)}
              className={`${inputBase} ${inputIdle} cursor-pointer`}>
              {STATUS_VALUES.map((s) => (
                <option key={s} value={s}>{t(`status_${s}`)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
          <button type="button" onClick={onClose} disabled={busy}
            className="rounded-lg border border-[#D8D4C8] px-4 py-2 text-[13px] font-semibold text-foreground/65 transition-colors hover:bg-[#F5F3EE] disabled:opacity-50 dark:border-[#243020] dark:text-[#9A9A8A]">
            {t('btn_cancel')}
          </button>
          <button type="button" onClick={handleSubmit} disabled={busy}
            className="rounded-lg bg-[#C49A1E] px-4 py-2 text-[13px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14] disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? t('btn_saving') : t('btn_save')}
          </button>
        </div>
      </div>
    </div>
  );
}

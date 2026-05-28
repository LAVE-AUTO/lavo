'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { postWithApi } from '@/services';
import { AdminAddUserForm, type Role } from './AdminAddUserForm';
import { AdminAddUserSuccess } from './AdminAddUserSuccess';
type Step = 'form' | 'success';

interface SuccessData {
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdminAddUserModal({ open, onClose }: Props) {
  const t = useTranslations('admin_add_user');

  const [step,      setStep]      = useState<Step>('form');
  const [role,      setRole]      = useState<Role>('client');
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [busy,      setBusy]      = useState(false);
  const [success,   setSuccess]   = useState<SuccessData | null>(null);

  useEffect(() => {
    if (open) {
      setStep('form'); setRole('client');
      setFirstName(''); setLastName(''); setEmail('');
      setErrors({}); setBusy(false); setSuccess(null);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [busy, onClose]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!firstName.trim())                  errs.first_name = t('error_firstname_required');
    else if (firstName.trim().length > 100) errs.first_name = t('error_firstname_too_long');
    if (!lastName.trim())                   errs.last_name  = t('error_lastname_required');
    else if (lastName.trim().length > 100)  errs.last_name  = t('error_lastname_too_long');
    if (!email.trim())                      errs.email = t('error_email_required');
    else if (email.trim().length > 254)     errs.email = t('error_email_too_long');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = t('error_email_invalid');
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setBusy(true);
    try {
      const [ok, data] = await postWithApi('/admin/users', {
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email:      email.trim(),
        role,
      });
      if (ok) {
        const created = (data as { data: SuccessData }).data;
        setSuccess(created);
        setStep('success');
      } else {
        const errData = data as { code?: string; message?: string };
        if (errData?.code === 'EMAIL_ALREADY_EXISTS') {
          setErrors({ email: t('error_email_conflict') });
        } else {
          setErrors({ email: errData?.message ?? t('error_generic') });
        }
      }
    } catch {
      setErrors({ email: t('error_generic') });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />

      <div className="relative z-10 w-full max-w-[480px] animate-fade-in-up overflow-hidden rounded-2xl border border-[#FFF9EC] bg-white shadow-2xl dark:border-[#1E2E18] dark:bg-[#001201]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
          <h2 className="text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]">
            {step === 'form' ? t('modal_title') : t('modal_success_title')}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('btn_close')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#BBBBAA] transition-colors hover:bg-[#F0EDE6] hover:text-foreground/70 disabled:opacity-40 dark:hover:bg-[#1A2A14]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {step === 'form' ? (
          <AdminAddUserForm
            role={role} firstName={firstName} lastName={lastName} email={email}
            errors={errors} busy={busy}
            onRoleChange={setRole}
            onFirstNameChange={setFirstName}
            onLastNameChange={setLastName}
            onEmailChange={setEmail}
            onSubmit={handleSubmit}
            onClose={onClose}
          />
        ) : success ? (
          <AdminAddUserSuccess data={success} onClose={onClose} />
        ) : null}
      </div>
    </div>
  );
}

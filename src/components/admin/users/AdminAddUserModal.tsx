'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AdminAddUserForm, type Role } from './AdminAddUserForm';
import { AdminAddUserSuccess } from './AdminAddUserSuccess';

type Step = 'form' | 'success';

interface SuccessData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: Role;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function generatePassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '!@#$%&*';
  const all     = upper + lower + digits + special;

  const rand = (max: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  };

  const pick = (src: string) => src[rand(src.length)];
  const base = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  const raw  = [...base, ...rest];

  for (let i = raw.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }
  return raw.join('');
}

export function AdminAddUserModal({ open, onClose }: Props) {
  const t = useTranslations('admin_add_user');

  const [step,      setStep]      = useState<Step>('form');
  const [role,      setRole]      = useState<Role>('client');
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState(generatePassword);
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [busy,      setBusy]      = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [success,   setSuccess]   = useState<SuccessData | null>(null);

  useEffect(() => {
    if (open) {
      setStep('form'); setRole('client');
      setFirstName(''); setLastName(''); setEmail('');
      setPassword(generatePassword());
      setErrors({}); setBusy(false); setCopied(false); setSuccess(null);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [busy, onClose]);

  const regenerate = useCallback(() => setPassword(generatePassword()), []);

  function validate() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.first_name = t('error_firstname_required');
    if (!lastName.trim())  errs.last_name  = t('error_lastname_required');
    if (!email.trim())     errs.email      = t('error_email_required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = t('error_email_invalid');
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setBusy(true);

    // TODO: connect to API once endpoint is available (POST /admin/users)
    await new Promise<void>((r) => setTimeout(r, 900));

    setSuccess({ email: email.trim(), password, first_name: firstName.trim(), last_name: lastName.trim(), role });
    setStep('success');
    setBusy(false);
  }

  async function handleCopyCredentials() {
    if (!success) return;
    const text = `${t('copy_email_label')}: ${success.email}\n${t('copy_password_label')}: ${success.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />

      <div className="relative z-10 w-full max-w-[480px] animate-fade-in-up overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-2xl dark:border-[#1E2E18] dark:bg-[#0F1A0C]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
          <h2 className="text-[15px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
            {step === 'form' ? t('modal_title') : t('modal_success_title')}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('btn_close')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#BBBBAA] transition-colors hover:bg-[#F0EDE6] hover:text-[#555] disabled:opacity-40 dark:hover:bg-[#1A2A14]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {step === 'form' ? (
          <AdminAddUserForm
            role={role} firstName={firstName} lastName={lastName} email={email}
            password={password} errors={errors} busy={busy}
            onRoleChange={setRole}
            onFirstNameChange={setFirstName}
            onLastNameChange={setLastName}
            onEmailChange={setEmail}
            onRegenerate={regenerate}
            onSubmit={handleSubmit}
            onClose={onClose}
          />
        ) : (
          <AdminAddUserSuccess
            data={success!}
            copied={copied}
            onCopy={handleCopyCredentials}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

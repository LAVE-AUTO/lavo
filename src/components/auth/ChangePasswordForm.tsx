'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import { postWithApi } from '@/services/axios-service';
import { isPasswordValid } from '@/helpers/validators';
import { HTTP_STATUS } from '@/helpers/constants';
import { Spinner } from '@/components/ui/Spinner';
import { FormField } from './FormField';
import { PasswordRules } from './PasswordRules';

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export function ChangePasswordForm() {
  const t = useTranslations('change_password');
  const { error: showError, success: showSuccess } = useToast();
  const auth = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ currentPassword?: string; newPassword?: string; confirmPassword?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!auth.isAuthenticated) {
    return (
      <div className="px-8 pb-8 text-center animate-fade-in">
        <p className="text-[15px] text-[#555] dark:text-lavo-muted mb-6">
          {t('error_generic')}
        </p>
        <Link
          href="/login"
          className="btn-shine block w-full py-3.5 bg-gold hover:bg-gold-hover rounded-[10px] text-[16px] font-bold text-dark-bg tracking-wide transition-colors duration-150 text-center"
        >
          {t('back_to_home')}
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="px-8 pb-8 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-lavo-success/10 border border-lavo-success/20 flex items-center justify-center mx-auto mb-6">
          <SuccessIcon />
        </div>
        <h2 className="text-[22px] font-bold text-dark-bg dark:text-white mb-3">
          {t('success_title')}
        </h2>
        <p className="text-[15px] text-[#555] dark:text-lavo-muted leading-relaxed mb-8">
          {t('success_message')}
        </p>
        <Link
          href="/"
          className="btn-shine block w-full py-3.5 bg-gold hover:bg-gold-hover rounded-[10px] text-[16px] font-bold text-dark-bg tracking-wide transition-colors duration-150 text-center"
        >
          {t('back_to_home')}
        </Link>
      </div>
    );
  }

  const handleBlurConfirm = () => {
    if (confirmPassword && newPassword !== confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: t('error_password_mismatch') }));
    }
  };

  const validate = (): boolean => {
    const next: { currentPassword?: string; newPassword?: string; confirmPassword?: string } = {};
    if (!currentPassword) next.currentPassword = t('error_required');
    if (!newPassword) {
      next.newPassword = t('error_required');
    } else if (!isPasswordValid(newPassword)) {
      next.newPassword = t('error_password_invalid');
    }
    if (!confirmPassword) {
      next.confirmPassword = t('error_required');
    } else if (newPassword !== confirmPassword) {
      next.confirmPassword = t('error_password_mismatch');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const [ok, response] = await postWithApi('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      }, { successStatus: HTTP_STATUS.OK });

      if (ok) {
        await auth.refetchUser();
        showSuccess(t('toast_success'));
        setSuccess(true);
        return;
      }

      const data = response as { code?: string };
      if (data?.code === 'UNAUTHORIZED') {
        setErrors((prev) => ({ ...prev, currentPassword: t('error_current_password_incorrect') }));
      } else {
        showError(t('error_generic'));
      }
    } catch {
      showError(t('error_generic'));
    } finally {
      setIsLoading(false);
    }
  };

  const eyeBtn = (visible: boolean, toggle: () => void, label: string) => (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className="text-[#888] hover:text-[#555] dark:hover:text-[#ccc] transition-colors"
    >
      <EyeIcon open={visible} />
    </button>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="px-8 pb-8">
      <FormField
        label={t('current_password')}
        required
        type={showCurrent ? 'text' : 'password'}
        placeholder={t('current_password_placeholder')}
        value={currentPassword}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setCurrentPassword(e.target.value);
          if (errors.currentPassword) setErrors((prev) => ({ ...prev, currentPassword: undefined }));
        }}
        error={errors.currentPassword}
        autoComplete="current-password"
        autoFocus
        rightIcon={eyeBtn(showCurrent, () => setShowCurrent((v) => !v), showCurrent ? 'Hide' : 'Show')}
      />

      <FormField
        label={t('new_password')}
        required
        type={showNew ? 'text' : 'password'}
        placeholder={t('new_password_placeholder')}
        value={newPassword}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setNewPassword(e.target.value);
          if (errors.newPassword) setErrors((prev) => ({ ...prev, newPassword: undefined }));
        }}
        error={errors.newPassword}
        autoComplete="new-password"
        rightIcon={eyeBtn(showNew, () => setShowNew((v) => !v), showNew ? 'Hide' : 'Show')}
      />
      <PasswordRules password={newPassword} namespace="change_password" />

      <FormField
        label={t('confirm_password')}
        required
        type={showConfirm ? 'text' : 'password'}
        placeholder={t('confirm_password_placeholder')}
        value={confirmPassword}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setConfirmPassword(e.target.value);
          if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
        }}
        onBlur={handleBlurConfirm}
        error={errors.confirmPassword}
        autoComplete="new-password"
        rightIcon={eyeBtn(showConfirm, () => setShowConfirm((v) => !v), showConfirm ? 'Hide' : 'Show')}
      />

      <button
        type="submit"
        disabled={isLoading}
        className="btn-shine w-full py-3.5 mt-2 bg-gold hover:bg-gold-hover active:scale-[0.98] disabled:opacity-70 rounded-[10px] text-[16px] font-bold text-dark-bg tracking-wide transition-all duration-150 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Spinner size="sm" />
            {t('loading')}
          </>
        ) : (
          t('submit')
        )}
      </button>
    </form>
  );
}

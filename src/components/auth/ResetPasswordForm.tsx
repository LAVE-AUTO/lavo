'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useToast } from '@/context/toast-context';
import { postWithApi } from '@/services/axios-service';
import { isPasswordValid } from '@/helpers/validators';
import { HTTP_STATUS } from '@/helpers/constants';
import { Button } from '@/components/ui/Button';
import { FormField } from './FormField';
import { PasswordRules } from './PasswordRules';

interface ResetPasswordFormProps {
  /** Token extracted from the URL search params by the server page. */
  token: string | null;
}

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

/**
 * Reset password form.
 * Reads token from props (passed by the server page via searchParams).
 * Shows an invalid-token card if token is missing.
 * Shows a success card after a successful reset.
 */
export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations('reset_password');
  const { error: showError, success: showSuccess } = useToast();

  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors]                 = useState<{ password?: string; confirmPassword?: string }>({});
  const [isLoading, setIsLoading]           = useState(false);
  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [success, setSuccess]               = useState(false);

  // No token → invalid link
  if (!token) {
    return (
      <div className="px-8 pb-8 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-Hurryline-error/10 border border-Hurryline-error/20 flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8472A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-[16px] text-dark-bg dark:text-white font-semibold mb-2">
          {t('error_invalid_token')}
        </p>
        <div className="mt-6">
          <Link
            href="/forgot-password"
            className="btn-shine block w-full py-3.5 bg-gold hover:bg-gold-hover rounded-[10px] text-[16px] font-bold text-dark-bg tracking-wide transition-colors duration-150 text-center"
          >
            {t('back_to_login')}
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="px-8 pb-8 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-Hurryline-success/10 border border-Hurryline-success/20 flex items-center justify-center mx-auto mb-6">
          <SuccessIcon />
        </div>
        <h2 className="text-[22px] font-bold text-dark-bg dark:text-white mb-3">
          {t('success_title')}
        </h2>
        <p className="text-[15px] text-foreground/70 dark:text-Hurryline-muted leading-relaxed mb-8">
          {t('success_message')}
        </p>
        <Link
          href="/login"
          className="btn-shine block w-full py-3.5 bg-gold hover:bg-gold-hover rounded-[10px] text-[16px] font-bold text-dark-bg tracking-wide transition-colors duration-150 text-center"
        >
          {t('back_to_login')}
        </Link>
      </div>
    );
  }

  const handleBlurConfirm = () => {
    if (confirmPassword && password !== confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: t('error_password_mismatch') }));
    }
  };

  const validate = (): boolean => {
    const next: { password?: string; confirmPassword?: string } = {};
    if (!password) {
      next.password = t('error_required');
    } else if (!isPasswordValid(password)) {
      next.password = t('error_password_invalid');
    }
    if (!confirmPassword) next.confirmPassword  = t('error_required');
    else if (password !== confirmPassword) next.confirmPassword = t('error_password_mismatch');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const [ok, response] = await postWithApi('/auth/reset-password', {
        token,
        new_password: password,
        confirm_new_password: confirmPassword,
      }, { successStatus: HTTP_STATUS.OK });

      if (ok) {
        showSuccess(t('toast_success'));
        setSuccess(true);
        return;
      }

      const data = response as { code?: string };
      if (data?.code === 'TOO_MANY_REQUESTS') {
        showError(t('error_rate_limit'));
      } else if (data?.code === 'TOKEN_EXPIRED') {
        showError(t('error_invalid_token'));
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
      className="text-foreground/55 hover:text-foreground/70 dark:hover:text-[#ccc] transition-colors"
    >
      <EyeIcon open={visible} />
    </button>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="px-8 pb-8">
      <FormField
        label={t('password')}
        required
        type={showPassword ? 'text' : 'password'}
        placeholder={t('password_placeholder')}
        value={password}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setPassword(e.target.value);
          if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
        }}
        error={errors.password}
        autoComplete="new-password"
        autoFocus
        rightIcon={eyeBtn(showPassword, () => setShowPassword((v) => !v), showPassword ? 'Hide password' : 'Show password')}
      />
      <PasswordRules password={password} namespace="reset_password" />

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
        rightIcon={eyeBtn(showConfirm, () => setShowConfirm((v) => !v), showConfirm ? 'Hide password' : 'Show password')}
      />

      <Button type="submit" fullWidth loading={isLoading} className="mt-2">
        {isLoading ? t('loading') : t('submit')}
      </Button>
    </form>
  );
}

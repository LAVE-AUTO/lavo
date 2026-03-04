'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useToast } from '@/context/toast-context';
import { postWithApi } from '@/services/axios-service';
import { validateEmail } from '@/helpers/validators';
import { Spinner } from '@/components/ui/Spinner';
import { FormField } from './FormField';
import { PasswordRules } from './PasswordRules';
import { SocialButtons } from './SocialButtons';

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

type FormErrors = Partial<Record<keyof RegisterFormData, string>>;

const INITIAL_DATA: RegisterFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

/**
 * Eye toggle icon for password visibility.
 */
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

/**
 * Complete registration form with client-side validation and API submission.
 * On success, redirects to /register/confirmation.
 */
export function RegisterForm() {
  const t = useTranslations('register');
  const router = useRouter();
  const { error: showError } = useToast();

  const [formData, setFormData] = useState<RegisterFormData>(INITIAL_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange =
    (field: keyof RegisterFormData) => (e: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!formData.firstName.trim()) next.firstName = t('error_required');
    if (!formData.lastName.trim()) next.lastName = t('error_required');

    if (!formData.email.trim()) {
      next.email = t('error_required');
    } else if (!validateEmail(formData.email)) {
      next.email = t('error_email_invalid');
    }

    if (!formData.password) {
      next.password = t('error_required');
    }

    if (!formData.confirmPassword) {
      next.confirmPassword = t('error_required');
    } else if (formData.password !== formData.confirmPassword) {
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
      const [success, response] = await postWithApi('/auth/register', {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        password: formData.password,
      });

      if (success) {
        router.push('/register/confirmation');
        return;
      }

      const data = response as { code?: string };
      if (
        data?.code === 'EMAIL_ALREADY_EXISTS' ||
        data?.code === 'CONFLICT'
      ) {
        showError(t('error_email_exists'));
      } else {
        showError(t('error_generic'));
      }
    } catch {
      showError(t('error_generic'));
    } finally {
      setIsLoading(false);
    }
  };

  const eyeButton = (visible: boolean, toggle: () => void, ariaLabel: string) => (
    <button
      type="button"
      onClick={toggle}
      aria-label={ariaLabel}
      className="text-[#888] hover:text-[#555] dark:hover:text-[#ccc] transition-colors"
    >
      <EyeIcon open={visible} />
    </button>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="px-6 pb-8">
      <FormField
        label={t('first_name')}
        required
        placeholder={t('first_name_placeholder')}
        value={formData.firstName}
        onChange={handleChange('firstName')}
        error={errors.firstName}
        autoComplete="given-name"
      />
      <FormField
        label={t('last_name')}
        required
        placeholder={t('last_name_placeholder')}
        value={formData.lastName}
        onChange={handleChange('lastName')}
        error={errors.lastName}
        autoComplete="family-name"
      />
      <FormField
        label={t('email')}
        required
        type="email"
        placeholder={t('email_placeholder')}
        value={formData.email}
        onChange={handleChange('email')}
        error={errors.email}
        autoComplete="email"
      />
      <FormField
        label={t('phone')}
        type="tel"
        placeholder={t('phone_placeholder')}
        value={formData.phone}
        onChange={handleChange('phone')}
        autoComplete="tel"
      />
      <FormField
        label={t('password')}
        required
        type={showPassword ? 'text' : 'password'}
        placeholder={t('password_placeholder')}
        value={formData.password}
        onChange={handleChange('password')}
        error={errors.password}
        autoComplete="new-password"
        rightIcon={eyeButton(
          showPassword,
          () => setShowPassword((v) => !v),
          showPassword ? 'Hide password' : 'Show password'
        )}
      />
      <PasswordRules password={formData.password} />
      <FormField
        label={t('confirm_password')}
        required
        type={showConfirm ? 'text' : 'password'}
        placeholder={t('confirm_password_placeholder')}
        value={formData.confirmPassword}
        onChange={handleChange('confirmPassword')}
        error={errors.confirmPassword}
        autoComplete="new-password"
        rightIcon={eyeButton(
          showConfirm,
          () => setShowConfirm((v) => !v),
          showConfirm ? 'Hide password' : 'Show password'
        )}
      />

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3.5 mt-4 bg-gold hover:bg-gold-hover active:scale-[0.98] disabled:opacity-70 rounded-[10px] text-[15px] font-extrabold text-[#1A2116] tracking-wide transition-all duration-150 font-rajdhani flex items-center justify-center gap-2"
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

      <SocialButtons />
    </form>
  );
}

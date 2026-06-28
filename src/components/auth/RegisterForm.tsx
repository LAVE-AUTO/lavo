'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import { getFromApi, postWithApi } from '@/services/axios-service';
import { validateEmail, validateName, validatePhone, isPasswordValid, joinPhoneNumber } from '@/helpers/validators';
import { Button } from '@/components/ui/Button';
import { FormField } from './FormField';
import { PhoneInput, type PhoneInputValue } from './PhoneInput';
import { PasswordRules } from './PasswordRules';
import { SocialButtons } from './SocialButtons';

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: PhoneInputValue;
  password: string;
  confirmPassword: string;
}

type FormErrors = Partial<Record<keyof RegisterFormData, string>>;

interface PromoReferralInfo {
  station_name: string;
  city: string;
  promo_commission_rate_percent: number | null;
  promo_ref_code: string;
}

interface RegisterFormProps {
  promoCode?: string | null;
}

const INITIAL_DATA: RegisterFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: { country: 'CA', localNumber: '' },
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
export function RegisterForm({ promoCode }: RegisterFormProps) {
  const t = useTranslations('register');
  const router = useRouter();
  const { error: showError, success: showSuccess } = useToast();
  const auth = useAuth();

  const [formData, setFormData] = useState<RegisterFormData>(INITIAL_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  /* The promo referral is resolved silently: the client never sees promo/commission
   * details on their registration page. We only keep `promoInfo` to gate sending
   * `promo_ref_code` with a valid code; the concerned merchant is notified server-side
   * once the account is created. */
  const [promoInfo, setPromoInfo] = useState<PromoReferralInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!promoCode) {
      setPromoInfo(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const [ok, data] = await getFromApi<PromoReferralInfo>(`/promo/referrals/${encodeURIComponent(promoCode)}`);
      if (cancelled) return;
      setPromoInfo(ok ? ((data as { data?: PromoReferralInfo })?.data ?? null) : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [promoCode]);

  const handleChange =
    (field: keyof RegisterFormData) => (e: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  /** Validate specific fields on blur for immediate inline feedback. */
  const handleBlur = (field: keyof RegisterFormData) => () => {
    if (field === 'firstName' && formData.firstName && !validateName(formData.firstName)) {
      setErrors((prev) => ({ ...prev, firstName: t('error_name_invalid') }));
    }
    if (field === 'lastName' && formData.lastName && !validateName(formData.lastName)) {
      setErrors((prev) => ({ ...prev, lastName: t('error_name_invalid') }));
    }
    if (field === 'email' && formData.email && !validateEmail(formData.email)) {
      setErrors((prev) => ({ ...prev, email: t('error_email_invalid') }));
    }
    if (field === 'confirmPassword' && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: t('error_password_mismatch') }));
    }
  };

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!formData.firstName.trim()) {
      next.firstName = t('error_required');
    } else if (!validateName(formData.firstName)) {
      next.firstName = t('error_name_invalid');
    }

    if (!formData.lastName.trim()) {
      next.lastName = t('error_required');
    } else if (!validateName(formData.lastName)) {
      next.lastName = t('error_name_invalid');
    }

    if (!formData.email.trim()) {
      next.email = t('error_required');
    } else if (!validateEmail(formData.email)) {
      next.email = t('error_email_invalid');
    }

    // Phone is optional for client registration; validate format only if filled.
    if (formData.phone.localNumber.trim() &&
        !validatePhone(joinPhoneNumber(formData.phone.country, formData.phone.localNumber))) {
      next.phone = t('error_phone_invalid');
    }

    if (!formData.password) {
      next.password = t('error_required');
    } else if (!isPasswordValid(formData.password)) {
      next.password = t('error_password_invalid');
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
      const trimmedLocal = formData.phone.localNumber.trim();
      const payload: Record<string, string> = {
        first_name: formData.firstName.trim(),
        last_name:  formData.lastName.trim(),
        email:      formData.email.trim().toLowerCase(),
        password:   formData.password,
        confirm_password: formData.confirmPassword,
      };
      if (trimmedLocal) {
        payload.phone = joinPhoneNumber(formData.phone.country, trimmedLocal);
      }
      if (promoInfo && promoCode) {
        payload.promo_ref_code = promoCode;
      }
      const [success, response] = await postWithApi('/auth/register', payload);

      if (success) {
        const body = response as { data?: { user: { id: string; email: string; role: string }; access_token: string } };
        const data = body.data;
        if (data && data.user && data.access_token) {
          auth.login(data.access_token, { ...data.user, role: data.user.role as 'client' | 'station' | 'admin' });
        }
        showSuccess(t('toast_success'));
        router.push('/register/confirmation');
        return;
      }

      const data = response as { code?: string; errors?: Array<{ field: string; message: string }> };
      if (data?.code === 'TOO_MANY_REQUESTS') {
        showError(t('error_rate_limit'));
      } else if (data?.code === 'EMAIL_ALREADY_EXISTS' || data?.code === 'CONFLICT') {
        showError(t('error_email_exists'));
      } else if (data?.code === 'VALIDATION_FAILED' && data.errors && data.errors.length > 0) {
        const fieldMap: Record<string, keyof RegisterFormData> = {
          first_name: 'firstName',
          last_name: 'lastName',
          email: 'email',
          phone: 'phone',
          password: 'password',
          confirm_password: 'confirmPassword',
        };
        const serverErrors: FormErrors = {};
        for (const err of data.errors) {
          const formField = fieldMap[err.field];
          if (formField) {
            const translationKey = `error_${formField === 'phone' ? 'phone_invalid'
              : formField === 'email' ? 'email_invalid'
              : formField === 'password' ? 'password_invalid'
              : 'required'}` as const;
            serverErrors[formField] = t(translationKey);
          }
        }
        if (Object.keys(serverErrors).length > 0) {
          setErrors(serverErrors);
        }
        showError(t('error_validation'));
      } else {
        showError(t('error_generic'));
      }
    } catch {
      showError(t('error_generic'));
    } finally {
      setIsLoading(false);
    }
  };

  const eyeButton = (visible: boolean, toggle: () => void, label: string) => (
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
      {/* Name row - side by side on larger screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <FormField
          label={t('first_name')}
          required
          placeholder={t('first_name_placeholder')}
          value={formData.firstName}
          onChange={handleChange('firstName')}
          onBlur={handleBlur('firstName')}
          error={errors.firstName}
          autoComplete="given-name"
          autoFocus
        />
        <FormField
          label={t('last_name')}
          required
          placeholder={t('last_name_placeholder')}
          value={formData.lastName}
          onChange={handleChange('lastName')}
          onBlur={handleBlur('lastName')}
          error={errors.lastName}
          autoComplete="family-name"
        />
      </div>

      {/* Email */}
      <FormField
        label={t('email')}
        required
        type="email"
        placeholder={t('email_placeholder')}
        value={formData.email}
        onChange={handleChange('email')}
        onBlur={handleBlur('email')}
        error={errors.email}
        autoComplete="email"
      />

      {/* Phone - optional for client sign-up */}
      <PhoneInput
        label={t('phone')}
        placeholder={t('phone_placeholder')}
        value={formData.phone}
        onChange={(val) => {
          setFormData((prev) => ({ ...prev, phone: val }));
          if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
        }}
        error={errors.phone}
      />

      {/* Password */}
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

      {/* Confirm password */}
      <FormField
        label={t('confirm_password')}
        required
        type={showConfirm ? 'text' : 'password'}
        placeholder={t('confirm_password_placeholder')}
        value={formData.confirmPassword}
        onChange={handleChange('confirmPassword')}
        onBlur={handleBlur('confirmPassword')}
        error={errors.confirmPassword}
        autoComplete="new-password"
        rightIcon={eyeButton(
          showConfirm,
          () => setShowConfirm((v) => !v),
          showConfirm ? 'Hide password' : 'Show password'
        )}
      />

      {/* Submit */}
      <Button type="submit" fullWidth loading={isLoading} className="mt-2">
        {isLoading ? t('loading') : t('submit')}
      </Button>

      <SocialButtons />
    </form>
  );
}

'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { useToast } from '@/context/toast-context';
import { useAuth, type AuthUser, type UserRole } from '@/context/auth-context';
import { postWithApi } from '@/services/axios-service';
import { validateEmail } from '@/helpers/validators';
import { HTTP_STATUS } from '@/helpers/constants';
import { Button } from '@/components/ui/Button';
import { FormField } from './FormField';
import { SocialButtons } from './SocialButtons';

interface LoginFormData {
  email: string;
  password: string;
}

type FormErrors = Partial<Record<keyof LoginFormData, string>>;

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

interface LoginFormProps {
  /** Override the forgot-password link destination (e.g. /station/forgot-password). Defaults to /forgot-password. */
  forgotPasswordHref?: string;
  /** Local path to redirect to after successful login (e.g. /stations/abc). Ignored if not a safe relative path. */
  callbackUrl?: string;
}

/**
 * Login form — email + password + remember me + forgot-password link + social buttons.
 * On success: persists session via AuthContext and redirects by role.
 */
export function LoginForm({ forgotPasswordHref = '/forgot-password', callbackUrl }: LoginFormProps) {
  const t = useTranslations('login');
  const router = useRouter();
  const { error: showError, success: showSuccess } = useToast();
  const auth = useAuth();

  const [formData, setFormData]         = useState<LoginFormData>({ email: '', password: '' });
  const [errors, setErrors]             = useState<FormErrors>({});
  const [rememberMe, setRememberMe]     = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange =
    (field: keyof LoginFormData) => (e: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const handleBlurEmail = () => {
    if (formData.email && !validateEmail(formData.email)) {
      setErrors((prev) => ({ ...prev, email: t('error_invalid_credentials') }));
    }
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!formData.email.trim() || !validateEmail(formData.email)) {
      next.email = t('error_invalid_credentials');
    }
    if (!formData.password) {
      next.password = t('error_invalid_credentials');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const [success, response] = await postWithApi('/auth/login', {
        email:       formData.email.trim(),
        password:    formData.password,
        remember_me: rememberMe,
      }, { successStatus: HTTP_STATUS.OK });

      if (success) {
        const body = response as { data?: { user: Record<string, unknown>; access_token: string } };
        const data = body.data;
        if (!data?.user || !data?.access_token) {
          showError(t('error_generic'));
          return;
        }

        const userRole = String(data.user.role || 'client') as UserRole;
        const authUser: AuthUser = { ...data.user, role: userRole } as AuthUser;

        auth.login(data.access_token, authUser);
        showSuccess(t('toast_success'));

        if (authUser.force_password_change) {
          router.push('/change-password');
          return;
        }

        const safeCallback =
          callbackUrl &&
          callbackUrl.startsWith('/') &&
          !callbackUrl.startsWith('//');

        if (safeCallback) {
          router.push(callbackUrl as string);
          return;
        }

        if (userRole === 'station')      router.push('/station');
        else if (userRole === 'admin')   router.push('/admin');
        else                             router.push('/stations');
        return;
      }

      const data = response as { code?: string };
      if (data?.code === 'TOO_MANY_REQUESTS') {
        showError(t('error_rate_limit'));
      } else if (data?.code === 'FORBIDDEN') {
        showError(t('error_account_suspended'));
      } else if (data?.code === 'INVALID_CREDENTIALS' || data?.code === 'UNAUTHORIZED') {
        setErrors({
          email:    t('error_invalid_credentials'),
          password: t('error_invalid_credentials'),
        });
      } else {
        showError(t('error_generic'));
      }
    } catch {
      showError(t('error_generic'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="px-8 pt-6 pb-8">
      <FormField
        label={t('email')}
        required
        type="email"
        placeholder={t('email_placeholder')}
        value={formData.email}
        onChange={handleChange('email')}
        onBlur={handleBlurEmail}
        error={errors.email}
        autoComplete="email"
        autoFocus
      />

      <FormField
        label={t('password')}
        required
        type={showPassword ? 'text' : 'password'}
        placeholder={t('password_placeholder')}
        value={formData.password}
        onChange={handleChange('password')}
        error={errors.password}
        autoComplete="current-password"
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="text-[#888] hover:text-[#555] dark:hover:text-[#ccc] transition-colors"
          >
            <EyeIcon open={showPassword} />
          </button>
        }
      />

      <div className="flex items-center justify-between mb-5 -mt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            id="remember-me"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-[#CCCCCC] dark:border-tab-inactive accent-gold cursor-pointer"
          />
          <span className="text-[14px] text-[#555] dark:text-lavo-muted">
            {t('remember_me')}
          </span>
        </label>

        <Link
          href={forgotPasswordHref}
          className="text-[14px] font-semibold text-gold hover:text-gold-hover transition-colors"
        >
          {t('forgot_password')}
        </Link>
      </div>

      <Button type="submit" fullWidth loading={isLoading}>
        {isLoading ? t('loading') : t('submit')}
      </Button>

      <SocialButtons namespace="login" />
    </form>
  );
}

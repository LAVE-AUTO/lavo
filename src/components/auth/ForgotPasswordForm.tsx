'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { postWithApi } from '@/services/axios-service';
import { validateEmail } from '@/helpers/validators';
import { Spinner } from '@/components/ui/Spinner';
import { FormField } from './FormField';

function MailSentIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#C49A1E"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

/**
 * Forgot password form.
 * Submits email and always shows the success card (prevents email enumeration).
 */
export function ForgotPasswordForm() {
  const t = useTranslations('forgot_password');

  const [email, setEmail]       = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [sent, setSent]             = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) setEmailError('');
  };

  const handleBlur = () => {
    if (email && !validateEmail(email)) {
      setEmailError(t('error_generic'));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !validateEmail(email)) {
      setEmailError(t('error_generic'));
      return;
    }

    setIsLoading(true);
    try {
      await postWithApi('/auth/forgot-password', { email: email.trim() });
      // Always show success regardless of API response (prevent email enumeration)
      setSent(true);
    } catch {
      // Still show success to prevent email enumeration
      setSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="px-8 pb-8 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-gold/10 border border-gold/25 flex items-center justify-center mx-auto mb-6">
          <MailSentIcon />
        </div>
        <h2 className="text-[22px] font-bold text-[#1A2116] dark:text-white mb-3">
          {t('success_title')}
        </h2>
        <p className="text-[15px] text-[#555] dark:text-lavo-muted leading-relaxed mb-2">
          {t('success_message')}
        </p>
        <p className="text-[13px] text-[#888] dark:text-lavo-muted mb-8">
          {t('success_spam')}
        </p>
        <Link
          href="/login"
          className="block w-full py-3.5 bg-gold hover:bg-gold-hover rounded-[10px] text-[16px] font-bold text-[#1A2116] tracking-wide transition-colors duration-150 text-center btn-shine"
        >
          {t('back_to_login')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="px-8 pb-8">
      <FormField
        label={t('email')}
        required
        type="email"
        placeholder={t('email_placeholder')}
        value={email}
        onChange={handleChange}
        onBlur={handleBlur}
        error={emailError}
        autoComplete="email"
        autoFocus
      />

      <button
        type="submit"
        disabled={isLoading}
        className="btn-shine w-full py-3.5 mt-2 bg-gold hover:bg-gold-hover active:scale-[0.98] disabled:opacity-70 rounded-[10px] text-[16px] font-bold text-[#1A2116] tracking-wide transition-all duration-150 flex items-center justify-center gap-2"
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

      <div className="mt-5 text-center">
        <Link
          href="/login"
          className="text-[14px] font-semibold text-gold hover:text-gold-hover transition-colors"
        >
          ← {t('back_to_login')}
        </Link>
      </div>
    </form>
  );
}

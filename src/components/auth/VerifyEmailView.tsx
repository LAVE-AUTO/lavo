'use client';

import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { postWithApi } from '@/services/axios-service';
import { validateEmail } from '@/helpers/validators';
import { HTTP_STATUS } from '@/helpers/constants';
import { Spinner } from '@/components/ui/Spinner';
import { FormField } from './FormField';

interface VerifyEmailViewProps {
  token: string | null;
}

type ViewState = 'loading' | 'success' | 'expired' | 'resent';

function CheckIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8472A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

/**
 * Client view for the /verify-email page.
 * Auto-calls POST /auth/verify-email on mount.
 * Shows success, expired (with resend form), or resent state.
 */
export function VerifyEmailView({ token }: VerifyEmailViewProps) {
  const t = useTranslations('verify_email');

  const [view, setView] = useState<ViewState>(() => (!token ? 'expired' : 'loading'));
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    postWithApi('/auth/verify-email', { token }).then(([ok]) => {
      if (cancelled) return;
      setView(ok ? 'success' : 'expired');
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) setEmailError('');
  };

  const handleResend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim() || !validateEmail(email)) {
      setEmailError(t('error_email_invalid'));
      return;
    }

    setResending(true);
    const [ok, response] = await postWithApi('/auth/resend-verification-email', { email: email.trim() }, { successStatus: HTTP_STATUS.OK });
    setResending(false);

    if (ok) {
      setView('resent');
    } else {
      const data = response as { code?: string };
      if (data?.code === 'TOO_MANY_REQUESTS') {
        setEmailError(t('error_rate_limit'));
      } else if (data?.code === 'CONFLICT') {
        setEmailError(t('error_already_verified'));
      } else if (data?.code === 'NOT_FOUND') {
        setEmailError(t('error_email_not_found'));
      } else {
        setEmailError(t('error_generic'));
      }
    }
  };

  if (view === 'loading') {
    return (
      <div className="px-8 pb-8 pt-4 flex flex-col items-center gap-4 text-center animate-fade-in">
        <Spinner size="md" />
        <p className="text-[15px] text-[#555] dark:text-lavo-muted">{t('loading')}</p>
      </div>
    );
  }

  if (view === 'success') {
    return (
      <div className="px-8 pb-8 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-lavo-success/10 border border-lavo-success/20 flex items-center justify-center mx-auto mb-6">
          <CheckIcon />
        </div>
        <h2 className="text-[22px] font-bold text-dark-bg dark:text-white mb-3">
          {t('success_title')}
        </h2>
        <p className="text-[15px] text-[#555] dark:text-lavo-muted leading-relaxed mb-8">
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

  if (view === 'resent') {
    return (
      <div className="px-8 pb-8 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-gold/10 border border-gold/25 flex items-center justify-center mx-auto mb-6">
          <MailIcon />
        </div>
        <h2 className="text-[22px] font-bold text-dark-bg dark:text-white mb-3">
          {t('resend_success_title')}
        </h2>
        <p className="text-[15px] text-[#555] dark:text-lavo-muted leading-relaxed mb-8">
          {t('resend_success_message')}
        </p>
        <Link
          href="/login"
          className="text-[14px] font-semibold text-gold hover:text-gold-hover transition-colors"
        >
          {t('back_to_login')}
        </Link>
      </div>
    );
  }

  /* expired state */
  return (
    <div className="px-8 pb-8 animate-fade-in">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-lavo-error/10 border border-lavo-error/20 flex items-center justify-center mx-auto mb-5">
          <AlertIcon />
        </div>
        <h2 className="text-[20px] font-bold text-dark-bg dark:text-white mb-2">
          {t('error_title')}
        </h2>
        <p className="text-[14px] text-[#555] dark:text-lavo-muted leading-relaxed">
          {t('error_message')}
        </p>
      </div>

      <form onSubmit={handleResend} noValidate>
        <FormField
          label={t('resend_label')}
          required
          type="email"
          placeholder={t('resend_email_placeholder')}
          value={email}
          onChange={handleEmailChange}
          error={emailError}
          autoComplete="email"
        />

        <button
          type="submit"
          disabled={resending}
          className="btn-shine w-full py-3.5 mt-2 bg-gold hover:bg-gold-hover active:scale-[0.98] disabled:opacity-70 rounded-[10px] text-[16px] font-bold text-dark-bg tracking-wide transition-all duration-150 flex items-center justify-center gap-2"
        >
          {resending ? (
            <>
              <Spinner size="sm" />
              {t('resend_loading')}
            </>
          ) : (
            t('resend_submit')
          )}
        </button>
      </form>

      <div className="mt-5 text-center">
        <Link
          href="/login"
          className="text-[14px] font-semibold text-gold hover:text-gold-hover transition-colors"
        >
          {t('back_to_login')}
        </Link>
      </div>
    </div>
  );
}

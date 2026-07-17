'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context';
import { useToast } from '@/context/toast-context';
import { postWithApi } from '@/services/axios-service';
import { HTTP_STATUS } from '@/helpers/constants';

/**
 * Slim top banner shown to signed-in clients whose email is still unverified.
 * Unverified clients keep access during their grace logins; this banner nags
 * them to verify and offers a one-click resend of the verification email.
 */
export function UnverifiedEmailBanner() {
  const t = useTranslations('unverified_banner');
  const { user, isClient, isLoading } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const unverified = !!user && isClient && !user.email_verified_at;
  if (isLoading || !unverified) return null;

  const handleResend = async () => {
    if (sending || sent || !user?.email) return;
    setSending(true);
    const [ok, response] = await postWithApi(
      '/auth/resend-verification-email',
      { email: user.email.trim().toLowerCase() },
      { successStatus: HTTP_STATUS.OK },
    );
    setSending(false);
    if (ok) {
      setSent(true);
      showSuccess(t('toast_sent'));
    } else {
      const data = response as { code?: string };
      showError(data?.code === 'TOO_MANY_REQUESTS' ? t('error_rate_limit') : t('error_generic'));
    }
  };

  /* Static (not sticky): the public/station navbars are sticky top-0
   * themselves and would collide with a sticky banner on scroll. */
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-[#4A3A08] px-4 py-2 text-center dark:bg-[#3A2E06]"
    >
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#FFEECA]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        {t('message')}
      </span>
      <button
        type="button"
        onClick={handleResend}
        disabled={sending || sent}
        className="rounded-full bg-[#DDAF3B] px-3.5 py-1 text-[12px] font-black text-[#001201] transition-colors hover:bg-gold-hover disabled:opacity-60 cursor-pointer disabled:cursor-default"
      >
        {sent ? t('cta_sent') : sending ? t('cta_sending') : t('cta_resend')}
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context';
import { useToast } from '@/context/toast-context';
import { postWithApi } from '@/services/axios-service';
import { HTTP_STATUS } from '@/helpers/constants';

/** Height (px) of the banner strip — the navbar spacer grows by this much. */
export const UNVERIFIED_BANNER_HEIGHT = 40;

/**
 * True when the signed-in user is a client whose email is still unverified.
 * Shared by the banner itself and the navbar spacer that offsets the page.
 */
export function useUnverifiedEmailBanner(): boolean {
  const { user, isClient, isLoading } = useAuth();
  return !isLoading && !!user && isClient && !user.email_verified_at;
}

/**
 * Compact single-line strip shown to signed-in clients whose email is still
 * unverified. Rendered inside the fixed PublicNavbar header (above the nav
 * row) so it is always visible at the top and never hidden behind it.
 * Unverified clients keep access during their grace logins; this banner nags
 * them to verify and offers a one-click resend of the verification email.
 */
export function UnverifiedEmailBanner() {
  const t = useTranslations('unverified_banner');
  const { user } = useAuth();
  const visible = useUnverifiedEmailBanner();
  const { success: showSuccess, error: showError } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!visible) return null;

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

  return (
    <div
      role="status"
      style={{ height: UNVERIFIED_BANNER_HEIGHT }}
      className="flex items-center justify-center gap-3 bg-[#4A3A08] px-3 dark:bg-[#3A2E06]"
    >
      <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-[#FFEECA]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        <span className="truncate">{t('message')}</span>
      </span>
      <button
        type="button"
        onClick={handleResend}
        disabled={sending || sent}
        className="shrink-0 whitespace-nowrap rounded-full bg-[#DDAF3B] px-3.5 py-1 text-[12px] font-black text-[#001201] transition-colors hover:bg-gold-hover disabled:opacity-60 cursor-pointer disabled:cursor-default"
      >
        {sent ? t('cta_sent') : sending ? t('cta_sending') : t('cta_resend')}
      </button>
    </div>
  );
}

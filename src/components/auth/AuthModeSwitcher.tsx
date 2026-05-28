'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

interface AuthModeSwitcherProps {
  /** 'client' means we are on a client auth page - show the merchant switch */
  mode: 'client' | 'merchant';
}

/**
 * Contextual banner on auth pages to switch between client and merchant spaces.
 * Client pages show a "Do you own a station?" prompt linking to /station/login.
 * Station pages show a "Are you a customer?" prompt linking to /login.
 */
export function AuthModeSwitcher({ mode }: AuthModeSwitcherProps) {
  const t      = useTranslations('auth_switch');
  const locale = useLocale();

  const isMerchantPrompt = mode === 'client';

  return (
    <div className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[10px] bg-[#F5F5F0] dark:bg-[#1A2416] border border-[#E0E0D0] dark:border-[#2A3826] mb-5">
      <span className="text-[13px] text-foreground/70 dark:text-Hurryline-muted font-medium leading-snug">
        {isMerchantPrompt ? t('merchant_label') : t('client_label')}
      </span>
      <Link
        href={isMerchantPrompt ? '/station/login' : '/login'}
        locale={locale}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold text-gold text-[13px] font-semibold hover:bg-gold hover:text-dark-bg transition-colors duration-150 whitespace-nowrap"
      >
        {isMerchantPrompt ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            {t('merchant_action')}
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            {t('client_action')}
          </>
        )}
      </Link>
    </div>
  );
}

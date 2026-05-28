'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function ClientNewReservationPage() {
  const t = useTranslations('coupons');

  return (
    <main className="min-h-screen bg-background pb-24 sm:pb-8">
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-gold">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>

        <h1 className="text-[22px] font-black text-foreground">
          {t('new_title')}
        </h1>
        <p className="mt-2 text-[14px] font-semibold text-foreground/70">
          {t('new_subtitle')}
        </p>
        <p className="mt-4 max-w-md text-[13px] leading-relaxed text-foreground/65 dark:text-[#A0A090]">
          {t('new_help')}
        </p>

        <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
          <Link
            href="/stations"
            className="flex items-center justify-center gap-2 rounded-xl bg-gold py-3.5 text-[15px] font-black text-dark-bg transition-colors hover:bg-gold-hover"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {t('new_cta_browse')}
          </Link>
          <Link
            href="/client/dashboard"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-gold/40 py-3.5 text-[14px] font-bold text-gold transition-colors hover:bg-gold/10 hover:border-gold/60"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {t('new_cta_favorites')}
          </Link>
        </div>
      </div>
    </main>
  );
}

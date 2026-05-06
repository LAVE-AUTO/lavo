'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function StripeReturnPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('station_config');

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(`/${locale}/station/config?tab=payments`);
    }, 3000);
    return () => clearTimeout(timer);
  }, [router, locale]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F7F6F2] px-4 dark:bg-[#0C1209]">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#E8E4DC] bg-white p-8 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E6F9EF] dark:bg-[#0A2010]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2ECC71" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-[16px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
          {t('stripe_return_title')}
        </h1>
        <p className="text-center text-[13px] text-[#666] dark:text-[#9A9A8A]">
          {t('stripe_return_desc')}
        </p>
        <p className="text-[11px] text-[#AAAAAA] dark:text-[#4A4A3A]">
          {t('stripe_return_redirect')}
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { postWithApi } from '@/services';

export default function StripeRefreshPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('station_config');
  const [error, setError] = useState(false);

  useEffect(() => {
    async function refresh() {
      const [ok, data] = await postWithApi('/station/stripe/onboarding', {});
      if (ok) {
        const url = (data as { data: { url: string } }).data.url;
        window.location.href = url;
      } else {
        setError(true);
      }
    }
    refresh();
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F7F6F2] px-4 dark:bg-[#0C1209]">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#E8E4DC] bg-white p-8 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FEE2E2] dark:bg-[#1A0A0A]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-[16px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
            {t('stripe_refresh_error_title')}
          </h1>
          <p className="text-center text-[13px] text-foreground/65 dark:text-[#9A9A8A]">
            {t('stripe_refresh_error_desc')}
          </p>
          <a
            href={`/${locale}/station/config?tab=payments`}
            className="mt-1 rounded-xl bg-[#C49A1E] px-5 py-2.5 text-[13px] font-bold text-[#0C1209] hover:opacity-90"
          >
            {t('stripe_refresh_back_btn')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F7F6F2] px-4 dark:bg-[#0C1209]">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#E8E4DC] bg-white p-8 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8E4DC] border-t-[#C49A1E] dark:border-[#243020] dark:border-t-[#C49A1E]" aria-hidden="true" />
        <p className="text-[13px] text-foreground/65 dark:text-[#9A9A8A]">
          {t('stripe_refresh_loading')}
        </p>
      </div>
    </div>
  );
}

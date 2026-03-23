'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

/* ------------------------------------------------------------------ */
/* Écran de succès affiché après un report confirmé                    */
/* ------------------------------------------------------------------ */

export default function RescheduleSuccessView() {
  const t = useTranslations('reschedule');

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] flex items-center justify-center px-4 pb-24 sm:pb-8">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Icône de validation */}
        <div className="w-20 h-20 rounded-full bg-lavo-success/15 flex items-center justify-center mx-auto">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00C851"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-[22px] font-black text-[#0A0A14] dark:text-white">
            {t('success_title')}
          </h1>
          <p className="text-[14px] text-[#666] dark:text-[#B0B0A0] leading-relaxed">
            {t('success_desc')}
          </p>
        </div>

        <Link
          href="/client/reservations"
          className="block w-full py-3.5 rounded-[10px] bg-gold hover:bg-gold-hover text-dark-bg text-[15px] font-black text-center transition-colors"
        >
          {t('btn_view_reservation')}
        </Link>
      </div>
    </main>
  );
}

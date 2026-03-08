'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFoundPage() {
  const t = useTranslations('not_found');

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-[#F8F7F2] dark:bg-dark-bg transition-colors overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-gold/6 blur-3xl animate-float-orb" />
      <div className="absolute bottom-1/4 -right-20 w-64 h-64 rounded-full bg-gold/5 blur-3xl animate-float-orb" style={{ animationDelay: '3s' }} />

      <div className="relative z-10 text-center px-4 sm:px-6 max-w-lg mx-auto animate-fade-in-up">
        {/* 404 number */}
        <p className="text-[120px] sm:text-[160px] font-black leading-none text-gold/20 select-none">
          {t('title')}
        </p>

        {/* Heading */}
        <h1 className="text-[28px] sm:text-[36px] font-black text-[#0A0A14] dark:text-white -mt-6 sm:-mt-10">
          {t('heading')}
        </h1>

        {/* Description */}
        <p className="mt-4 text-[17px] text-[#666] dark:text-[#C0C0B0] leading-relaxed max-w-sm mx-auto">
          {t('description')}
        </p>

        {/* Back home */}
        <div className="mt-10">
          <Link
            href="/"
            className="btn-shine inline-flex items-center gap-2 px-8 py-3.5 bg-gold hover:bg-gold-hover rounded-xl text-[16px] font-bold text-dark-bg transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            {t('back_home')}
          </Link>
        </div>
      </div>
    </section>
  );
}

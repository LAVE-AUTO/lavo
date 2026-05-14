'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';

export function CtaSection() {
  const t = useTranslations('home.cta');
  const locale = useLocale();
  const [email, setEmail] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmail('');
  }

  return (
    <section className="relative overflow-hidden bg-[#c8980a] px-6 py-24 text-center lg:px-16" id="download">
      {/* Ghost brand text */}
      <div
        className="font-playfair pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap text-[280px] font-black text-black/[0.05]"
        aria-hidden
      >
        Hurryline
      </div>

      <div className="relative z-10">
        <div className="font-dm-mono mb-4 text-[11px] uppercase tracking-[3px] text-[rgba(13,31,15,0.55)]">
          {t('eyebrow')}
        </div>

        <h2 className="font-playfair mx-auto mb-4 text-[clamp(38px,5vw,60px)] font-black leading-[1.05] text-[#0d1f0f]">
          {t('title')}
        </h2>

        <p className="mx-auto mb-11 max-w-[480px] text-[17px] text-[rgba(13,31,15,0.65)]">
          {t('desc')}
        </p>

        {/* Email form */}
        <form
          onSubmit={handleSubmit}
          className="mx-auto mb-4 flex max-w-[440px] overflow-hidden rounded-md shadow-[0_16px_48px_rgba(0,0,0,0.2)]"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('input_placeholder')}
            className="flex-1 bg-[#0d1f0f] px-4 py-4 font-rajdhani text-[14px] text-[#fef9e7] placeholder:text-[#7a9a7d] outline-none"
            required
          />
          <button
            type="submit"
            className="bg-[#0d1f0f] px-6 font-rajdhani text-[12px] font-bold uppercase tracking-[1px] text-[#c8980a] transition-colors duration-300 hover:bg-[#162218]"
          >
            {t('btn_submit')} →
          </button>
        </form>

        <p className="mb-7 text-[12px] text-[rgba(13,31,15,0.45)]">{t('note')}</p>

        {/* App store badges */}
        <div className="flex justify-center gap-3">
          <Link
            href={`/${locale}/register`}
            className="flex items-center gap-2 rounded-[8px] bg-[#0d1f0f] px-5 py-2.5 text-[12px] font-semibold text-[#fef9e7] transition-all duration-300 hover:bg-[#162218] hover:-translate-y-0.5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.15-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04l-.08.27zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            {t('app_store')}
          </Link>
          <Link
            href={`/${locale}/register`}
            className="flex items-center gap-2 rounded-[8px] bg-[#0d1f0f] px-5 py-2.5 text-[12px] font-semibold text-[#fef9e7] transition-all duration-300 hover:bg-[#162218] hover:-translate-y-0.5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.18 23.64c.41.23.88.2 1.28-.04l11.93-6.88-2.75-2.77-10.46 9.69zm14.66-8.48L5.37 8.28 3.18.36c-.07.19-.11.4-.11.62v22c0 .22.04.43.11.62l.08.07 12.58-8.51zm2.8-7.27L16.7 5.67 3.18.36C2.77.13 2.3.11 1.88.32L14.5 12.93l5.14-2.96c.62-.35.77-1.04.5-1.67l.5.62zm-2.8 15.27l-3.95-3.99-.12.07L6.45 22.7c.45.26.98.26 1.43.01l10.96-6.31-.96-.93L3.95 8.27l10.58 6.93 3.31 8.96z" />
            </svg>
            {t('google_play')}
          </Link>
        </div>
      </div>
    </section>
  );
}

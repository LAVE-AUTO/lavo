'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { RevealOnScroll } from '@/components/home/RevealOnScroll';

const PROBLEM_ICONS = [
  /* Clock / queue */
  <svg key="clock" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>,
  /* Chart down */
  <svg key="chart" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
  </svg>,
  /* Eye off */
  <svg key="eye" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>,
  /* Users */
  <svg key="users" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>,
];

export function MerchantProblemSection() {
  const t = useTranslations('merchant.problem');

  const cards = [
    { title: t('card_1_title'), desc: t('card_1_desc') },
    { title: t('card_2_title'), desc: t('card_2_desc') },
    { title: t('card_3_title'), desc: t('card_3_desc') },
    { title: t('card_4_title'), desc: t('card_4_desc') },
  ];

  return (
    <RevealOnScroll>
      <section className="px-6 py-16 lg:px-16 lg:py-20" id="problem">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-20 items-center">
            {/* Left */}
            <div>
              <div className="font-dm-mono mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[3px] text-[#c8980a]">
                {t('tag')}
                <span className="h-px w-9 bg-[#c8980a] opacity-50" />
              </div>
              <h2 className="font-playfair mb-5 text-[clamp(32px,3.6vw,50px)] font-bold leading-[1.1] text-[#1a1a1a] dark:text-[#fef9e7]">
                {t('title')}{' '}
                <em className="italic text-[#c8980a]">{t('title_accent')}</em>
              </h2>
              <p className="mb-8 text-[16px] leading-[1.8] text-[#4a6a4d] dark:text-[#7a9a7d] max-w-[420px]">
                {t('desc')}
              </p>
              <Link
                href="/station/apply"
                className="btn-shine inline-block rounded-md bg-[#c8980a] px-9 py-[15px] text-[13px] font-bold uppercase tracking-[1.5px] text-[#0d1f0f] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(200,152,10,0.45)]"
              >
                {t('btn')}
              </Link>
            </div>

            {/* Right - problem cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cards.map((card, i) => (
                <div
                  key={card.title}
                  className="group rounded-sm border border-[rgba(254,249,231,0.07)] border-l-[3px] border-l-[rgba(200,152,10,0.35)] bg-[rgba(254,249,231,0.04)] p-[18px_22px] transition-all duration-300 hover:-translate-y-1 hover:border-l-[#c8980a] hover:bg-[rgba(200,152,10,0.05)]"
                >
                  <div className="mb-2.5">{PROBLEM_ICONS[i]}</div>
                  <div className="mb-1.5 text-[14px] font-semibold text-[#1a1a1a] dark:text-[#fef9e7]">{card.title}</div>
                  <div className="text-[13px] leading-[1.65] text-[#4a6a4d] dark:text-[#7a9a7d]">{card.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </RevealOnScroll>
  );
}

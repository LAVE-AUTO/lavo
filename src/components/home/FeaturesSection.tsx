'use client';

import { useTranslations } from 'next-intl';
import { RevealOnScroll } from './RevealOnScroll';

const FEATURE_ICONS = [
  /* clock */ (
    <svg key="clock" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  /* credit card */
  (
    <svg key="card" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  /* bell */
  (
    <svg key="bell" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  /* star */
  (
    <svg key="star" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  /* map */
  (
    <svg key="map" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  /* refresh */
  (
    <svg key="refresh" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
];

export function FeaturesSection() {
  const t = useTranslations('home.features');

  const features = [
    { title: t('item_1_title'), desc: t('item_1_desc') },
    { title: t('item_2_title'), desc: t('item_2_desc') },
    { title: t('item_3_title'), desc: t('item_3_desc') },
    { title: t('item_4_title'), desc: t('item_4_desc') },
    { title: t('item_5_title'), desc: t('item_5_desc') },
    { title: t('item_6_title'), desc: t('item_6_desc') },
  ];

  return (
    <section className="px-6 py-16 lg:px-16 lg:py-20" id="features">
      <div className="mx-auto max-w-[1280px]">
        <RevealOnScroll className="mb-2 text-center">
          <div className="font-dm-mono mb-3 flex items-center justify-center gap-3 text-[11px] uppercase tracking-[3px] text-[#DDAF3B]">
            {t('tag')}
            <span className="h-px w-9 bg-[#DDAF3B] opacity-50" />
          </div>
          <h2 className="font-playfair mx-auto text-[clamp(34px,3.8vw,52px)] font-bold leading-[1.1] text-[#001201] dark:text-[#FFEECA]">
            {t('title')}<br />
            <em className="italic text-[#DDAF3B]">{t('title_accent')}</em>
          </h2>
        </RevealOnScroll>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feat, i) => (
            <RevealOnScroll key={feat.title}>
              <div className="group rounded-[12px] p-7 transition-all duration-300 cursor-default hover:-translate-y-1.5 hover:shadow-[0_24px_48px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_24px_48px_rgba(0,0,0,0.35)] bg-[#FFF9EC] dark:bg-[#f5edd6]">
                <div className="mb-3.5">{FEATURE_ICONS[i]}</div>
                <div className="mb-2 text-[16px] font-bold text-[#3d2a10]">{feat.title}</div>
                <div className="text-[13px] leading-[1.7] text-[rgba(61,42,16,0.65)]">{feat.desc}</div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

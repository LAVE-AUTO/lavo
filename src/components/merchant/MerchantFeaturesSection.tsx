'use client';

import { useTranslations } from 'next-intl';
import { RevealOnScroll } from '@/components/home/RevealOnScroll';

const FEATURE_ICONS = [
  <svg key="bar" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
  </svg>,
  <svg key="card" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>,
  <svg key="bell" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>,
  <svg key="star" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>,
  <svg key="cal" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>,
  <svg key="trend" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>,
];

export function MerchantFeaturesSection() {
  const t = useTranslations('merchant.features');

  const features = [
    { title: t('item_1_title'), desc: t('item_1_desc') },
    { title: t('item_2_title'), desc: t('item_2_desc') },
    { title: t('item_3_title'), desc: t('item_3_desc') },
    { title: t('item_4_title'), desc: t('item_4_desc') },
    { title: t('item_5_title'), desc: t('item_5_desc') },
    { title: t('item_6_title'), desc: t('item_6_desc') },
  ];

  return (
    <RevealOnScroll>
      <section className="px-6 py-16 lg:px-16 lg:py-20" id="features">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-20 items-start">
            {/* Left */}
            <div>
              <div className="font-dm-mono mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[3px] text-[#DDAF3B]">
                {t('tag')}
                <span className="h-px w-9 bg-[#DDAF3B] opacity-50" />
              </div>
              <h2 className="font-playfair mb-5 text-[clamp(32px,3.6vw,50px)] font-bold leading-[1.1] text-[#001201] dark:text-[#FFEECA]">
                {t('title')}{' '}
                <em className="italic text-[#DDAF3B]">{t('title_accent')}</em>
              </h2>
              <p className="mb-8 text-[15px] leading-[1.8] text-[var(--foreground)] dark:text-[#B0BFB1]">
                {t('desc')}
              </p>

              {/* Revenue model card */}
              <div className="rounded-xl border border-[rgba(221,175,59,0.28)] bg-[rgba(221,175,59,0.07)] p-7">
                <div className="font-dm-mono mb-5 text-[10px] uppercase tracking-[2px] text-[#DDAF3B]">
                  {t('rev_label')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Commission box - highlighted */}
                  <div className="rounded-lg border border-[#DDAF3B] bg-[rgba(221,175,59,0.1)] p-4">
                    <div className="font-dm-mono mb-1 text-[10px] uppercase tracking-[1px] text-[#DDAF3B]">{t('rev_commission_name')}</div>
                    <div className="font-rajdhani text-[30px] font-bold leading-none text-[#DDAF3B]">{t('rev_commission_price')}</div>
                    <div className="mt-2 text-[11px] leading-[1.6] text-[var(--foreground)] dark:text-[#B0BFB1]">{t('rev_commission_desc')}</div>
                  </div>
                  {/* Subscription box */}
                  <div className="rounded-lg border border-[rgba(221,175,59,0.2)] bg-[rgba(254,249,231,0.04)] p-4">
                    <div className="font-dm-mono mb-1 text-[10px] uppercase tracking-[1px] text-[#B0BFB1]">{t('rev_sub_name')}</div>
                    <div className="font-rajdhani text-[24px] font-bold leading-none text-[#001201] dark:text-[#FFEECA]">{t('rev_sub_price')}</div>
                    <div className="mt-2 text-[11px] leading-[1.6] text-[var(--foreground)] dark:text-[#B0BFB1]">{t('rev_sub_desc')}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - 2x3 feature cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {features.map((feat, i) => (
                <div
                  key={feat.title}
                  className="group rounded-xl border border-[rgba(221,175,59,0.1)] bg-[rgba(254,249,231,0.03)] p-[22px] transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(221,175,59,0.35)] hover:shadow-[0_16px_40px_rgba(221, 175, 59,0.08)]"
                >
                  <div className="mb-3">{FEATURE_ICONS[i]}</div>
                  <div className="mb-1.5 text-[14px] font-bold text-[#001201] dark:text-[#FFEECA]">{feat.title}</div>
                  <div className="text-[12px] leading-[1.7] text-[var(--foreground)] dark:text-[#B0BFB1]">{feat.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </RevealOnScroll>
  );
}

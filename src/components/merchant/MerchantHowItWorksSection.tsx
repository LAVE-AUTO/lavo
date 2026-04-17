'use client';

import { useTranslations } from 'next-intl';
import { RevealOnScroll } from '@/components/home/RevealOnScroll';

const STEP_ICONS = [
  <svg key="file" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>,
  <svg key="settings" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>,
  <svg key="dollar" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>,
];

export function MerchantHowItWorksSection() {
  const t = useTranslations('merchant.steps');

  const steps = [
    { n: '01', title: t('step_1_title'), desc: t('step_1_desc') },
    { n: '02', title: t('step_2_title'), desc: t('step_2_desc') },
    { n: '03', title: t('step_3_title'), desc: t('step_3_desc') },
  ];

  return (
    <section className="landing-alt-bg px-6 py-28 lg:px-16" id="how-it-works">
      <div className="mx-auto max-w-[1280px]">
        <RevealOnScroll className="text-center">
          <div className="font-dm-mono mb-4 flex items-center justify-center gap-3 text-[11px] uppercase tracking-[3px] text-[#c8980a]">
            {t('tag')}
            <span className="h-px w-9 bg-[#c8980a] opacity-50" />
          </div>
          <h2 className="font-playfair text-[clamp(34px,3.8vw,52px)] font-bold leading-[1.1] text-[#1a1a1a] dark:text-[#fef9e7]">
            {t('title')}{' '}
            <em className="italic text-[#c8980a]">{t('title_accent')}</em>
          </h2>
        </RevealOnScroll>

        <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-12">
          {steps.map((step, i) => (
            <RevealOnScroll key={step.n} className="relative">
              {i < 2 && (
                <div className="absolute top-[26px] right-[-30px] hidden text-[22px] text-[rgba(200,152,10,0.3)] lg:block">
                  →
                </div>
              )}
              <div className="font-playfair mb-3 text-[52px] font-black leading-none text-[rgba(200,152,10,0.1)]">
                {step.n}
              </div>
              <div className="mb-3.5 flex h-[46px] w-[46px] items-center justify-center rounded-[8px] border border-[rgba(200,152,10,0.3)] bg-[rgba(200,152,10,0.1)]">
                {STEP_ICONS[i]}
              </div>
              <div className="mb-2 text-[17px] font-bold text-[#1a1a1a] dark:text-[#fef9e7]">{step.title}</div>
              <div className="text-[13px] leading-[1.7] text-[#4a6a4d] dark:text-[#7a9a7d]">{step.desc}</div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

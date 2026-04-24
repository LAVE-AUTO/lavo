'use client';

import { useTranslations } from 'next-intl';
import { RevealOnScroll } from './RevealOnScroll';

const STEP_ICONS = [
  <svg key="search" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>,
  <svg key="calendar" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>,
  <svg key="check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>,
];

export function HowItWorksSection() {
  const t = useTranslations('home.steps');

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
              {/* Arrow connector — desktop only, not on last item */}
              {i < 2 && (
                <div className="absolute top-[26px] right-[-30px] hidden text-[22px] text-[rgba(200,152,10,0.3)] lg:block">
                  →
                </div>
              )}

              <div className="font-playfair mb-3 text-[52px] font-black leading-none text-[#c8980a]">
                {step.n}
              </div>

              <div className="mb-3.5 flex h-[46px] w-[46px] items-center justify-center rounded-[8px] border border-[rgba(200,152,10,0.3)] bg-[rgba(200,152,10,0.1)]">
                {STEP_ICONS[i]}
              </div>

              <div className="mb-2 text-[17px] font-bold text-[#1a1a1a] dark:text-[#fef9e7]">
                {step.title}
              </div>
              <div className="text-[13px] leading-[1.7] text-[#4a6a4d] dark:text-[#7a9a7d]">
                {step.desc}
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { ScrollReveal } from './ScrollReveal';

const STEPS = [
  {
    key: 'step_1',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    color: 'bg-blue-500/10 text-blue-500 dark:bg-blue-400/10 dark:text-blue-400',
    numColor: 'bg-blue-500 dark:bg-blue-400',
  },
  {
    key: 'step_2',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    color: 'bg-gold/10 text-gold',
    numColor: 'bg-gold',
  },
  {
    key: 'step_3',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    color: 'bg-lavo-success/10 text-lavo-success',
    numColor: 'bg-lavo-success',
  },
] as const;

export function HowItWorks() {
  const t = useTranslations('landing');

  return (
    <section className="py-16 sm:py-28 bg-white dark:bg-dark-bg transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <ScrollReveal className="text-center mb-12 sm:mb-16">
          <h2 className="text-[32px] sm:text-[40px] font-black text-[#0A0A14] dark:text-white leading-tight">
            {t('how_title')}
          </h2>
          <p className="mt-3 text-[17px] text-[#666] dark:text-[#C0C0B0] max-w-md mx-auto">
            {t('how_subtitle')}
          </p>
        </ScrollReveal>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-8 lg:gap-12">
          {STEPS.map((step, i) => (
            <ScrollReveal key={step.key} delay={i * 0.12}>
              <div className="relative text-center group">
                {/* Horizontal connector line — desktop (not on last) */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-[#E0E0D0] to-transparent dark:from-tab-inactive dark:to-transparent" />
                )}

                {/* Step number + icon */}
                <div className={`relative mx-auto w-20 h-20 rounded-2xl ${step.color} flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-105 transition-transform`}>
                  {step.icon}
                  <span className={`absolute -top-2 -right-2 w-7 h-7 rounded-full ${step.numColor} text-white text-[13px] font-black flex items-center justify-center shadow-md`}>
                    {i + 1}
                  </span>
                </div>

                <h3 className="text-[18px] sm:text-[19px] font-bold text-[#0A0A14] dark:text-white mb-2">
                  {t(`${step.key}_title`)}
                </h3>
                <p className="text-[14px] sm:text-[15px] text-[#666] dark:text-[#C0C0B0] leading-relaxed max-w-xs mx-auto">
                  {t(`${step.key}_desc`)}
                </p>

                {/* Vertical connector — mobile only (not on last) */}
                {i < STEPS.length - 1 && (
                  <div className="flex md:hidden justify-center py-5">
                    <div className="w-px h-8 bg-gradient-to-b from-[#D0D0C0] to-transparent dark:from-tab-inactive dark:to-transparent" />
                  </div>
                )}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

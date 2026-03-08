'use client';

import { useTranslations } from 'next-intl';
import { ScrollReveal } from './ScrollReveal';

const TESTIMONIALS = [
  { key: '1', initials: 'SM', color: 'bg-blue-500' },
  { key: '2', initials: 'TR', color: 'bg-gold' },
  { key: '3', initials: 'AK', color: 'bg-purple-500' },
] as const;

type Testimonial = (typeof TESTIMONIALS)[number];

function TestimonialCard({
  item,
  t,
}: {
  item: Testimonial;
  t: ReturnType<typeof useTranslations<'landing'>>;
}) {
  return (
    <div className="rounded-2xl bg-[#FAFAF6] dark:bg-dark-card border border-[#E8E8D8] dark:border-tab-inactive p-6 sm:p-7 h-full flex flex-col hover:shadow-md transition-shadow">
      {/* Stars */}
      <div className="flex gap-0.5 mb-4">
        {Array.from({ length: 5 }).map((_, s) => (
          <svg
            key={s}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="#af8408"
            aria-hidden="true"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}
      </div>

      {/* Quote */}
      <p className="text-[14px] sm:text-[15px] text-[#444] dark:text-[#C0C0B0] leading-relaxed flex-1 italic">
        &laquo; {t(`testimonial_${item.key}_text`)} &raquo;
      </p>

      {/* Author */}
      <div className="flex items-center gap-3 mt-5 pt-4 sm:mt-6 sm:pt-5 border-t border-[#E8E8D8] dark:border-tab-inactive">
        <div
          className={`w-10 h-10 rounded-full ${item.color} flex items-center justify-center text-[13px] font-bold text-white`}
        >
          {item.initials}
        </div>
        <div>
          <p className="text-[14px] font-bold text-[#0A0A14] dark:text-white leading-tight">
            {t(`testimonial_${item.key}_name`)}
          </p>
          <p className="text-[12px] text-[#888] dark:text-[#999]">
            {t(`testimonial_${item.key}_role`)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LandingTestimonials() {
  const t = useTranslations('landing');

  return (
    <section className="py-16 sm:py-28 bg-white dark:bg-dark-bg transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <ScrollReveal className="text-center mb-10 sm:mb-14">
          <h2 className="text-[28px] sm:text-[40px] font-black text-[#0A0A14] dark:text-white leading-tight">
            {t('testimonials_title')}
          </h2>
        </ScrollReveal>

        {/* Desktop: grid / Mobile: horizontal scroll */}
        <div className="hidden md:grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((item, i) => (
            <ScrollReveal key={item.key} delay={i * 0.1}>
              <TestimonialCard item={item} t={t} />
            </ScrollReveal>
          ))}
        </div>

        <div className="flex md:hidden gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 scrollbar-hide">
          {TESTIMONIALS.map((item) => (
            <div key={item.key} className="min-w-[280px] snap-center flex-shrink-0">
              <TestimonialCard item={item} t={t} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

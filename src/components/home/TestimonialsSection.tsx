'use client';

import { useTranslations } from 'next-intl';
import { RevealOnScroll } from './RevealOnScroll';

export function TestimonialsSection() {
  const t = useTranslations('home.testimonials');

  const testimonials = [
    {
      quote: t('t1_quote'),
      name: t('t1_name'),
      role: t('t1_role'),
      initials: 'AL',
    },
    {
      quote: t('t2_quote'),
      name: t('t2_name'),
      role: t('t2_role'),
      initials: 'MB',
    },
    {
      quote: t('t3_quote'),
      name: t('t3_name'),
      role: t('t3_role'),
      initials: 'KT',
    },
  ];

  return (
    <section className="px-6 py-16 lg:px-16 lg:py-20" id="testimonials">
      <div className="mx-auto max-w-[1280px]">
        <RevealOnScroll className="text-center mb-2">
          <div className="font-dm-mono mb-3 flex items-center justify-center gap-3 text-[11px] uppercase tracking-[3px] text-[#DDAF3B]">
            {t('tag')}
            <span className="h-px w-9 bg-[#DDAF3B] opacity-50" />
          </div>
          <h2 className="font-playfair text-[clamp(34px,3.8vw,52px)] font-bold leading-[1.1] text-[#001201] dark:text-[#FFEECA]">
            {t('title')}{' '}
            <em className="italic text-[#DDAF3B]">{t('title_accent')}</em>
          </h2>
        </RevealOnScroll>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((item) => (
            <RevealOnScroll key={item.name}>
              <div className="group flex flex-col rounded-[12px] border border-[rgba(245,237,214,0.07)] bg-[rgba(245,237,214,0.03)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(221,175,59,0.3)]">
                <div className="mb-3.5 text-[13px] text-[#DDAF3B]">★★★★★</div>
                <p className="mb-4 flex-1 text-[13px] italic leading-[1.75] text-[var(--foreground)] dark:text-[#ede0c4]">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full border border-[rgba(221,175,59,0.3)] bg-[#001A05] text-[13px] font-bold text-[#DDAF3B]">
                    {item.initials}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#001201] dark:text-[#FFEECA]">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-[#B0BFB1]">{item.role}</div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { RevealOnScroll } from '@/components/home/RevealOnScroll';

export function MerchantTestimonialsSection() {
  const t = useTranslations('merchant.testimonials');

  const testimonials = [
    { quote: t('t1_quote'), name: t('t1_name'), role: t('t1_role'), initials: 'MK' },
    { quote: t('t2_quote'), name: t('t2_name'), role: t('t2_role'), initials: 'SL' },
    { quote: t('t3_quote'), name: t('t3_name'), role: t('t3_role'), initials: 'JB' },
  ];

  return (
    <section className="px-6 py-28 lg:px-16" id="testimonials">
      <div className="mx-auto max-w-[1280px]">
        <RevealOnScroll className="text-center mb-2">
          <div className="font-dm-mono mb-4 flex items-center justify-center gap-3 text-[11px] uppercase tracking-[3px] text-[#c8980a]">
            {t('tag')}
            <span className="h-px w-9 bg-[#c8980a] opacity-50" />
          </div>
          <h2 className="font-playfair text-[clamp(34px,3.8vw,52px)] font-bold leading-[1.1] text-[#1a1a1a] dark:text-[#fef9e7]">
            {t('title')}{' '}
            <em className="italic text-[#c8980a]">{t('title_accent')}</em>
          </h2>
        </RevealOnScroll>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((item) => (
            <RevealOnScroll key={item.name}>
              <div className="group flex flex-col rounded-[12px] border border-[rgba(245,237,214,0.07)] bg-[rgba(245,237,214,0.03)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(200,152,10,0.3)]">
                <div className="mb-3.5 text-[13px] text-[#c8980a]">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                <p className="mb-4 flex-1 text-[13px] italic leading-[1.75] text-[#4a6a4d] dark:text-[#ede0c4]">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full border border-[rgba(200,152,10,0.3)] bg-[#162218] text-[13px] font-bold text-[#c8980a]">
                    {item.initials}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#1a1a1a] dark:text-[#fef9e7]">{item.name}</div>
                    <div className="text-[11px] text-[#7a9a7d]">{item.role}</div>
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

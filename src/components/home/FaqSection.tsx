'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RevealOnScroll } from './RevealOnScroll';

interface FaqItemProps {
  question: string;
  answer: string;
}

function FaqItem({ question, answer }: FaqItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      className="w-full rounded-[10px] border border-[rgba(200,152,10,0.1)] bg-[rgba(245,237,214,0.03)] px-5 py-5 text-left transition-all duration-300 hover:border-[rgba(200,152,10,0.35)] hover:bg-[rgba(200,152,10,0.04)] cursor-pointer"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-[15px] font-semibold text-[#1a1a1a] dark:text-[#fef9e7]">{question}</span>
        <span className="flex-shrink-0 text-[20px] font-light text-[#c8980a] transition-transform duration-300"
          style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>
          +
        </span>
      </div>
      {open && (
        <div className="mt-3 text-[13px] leading-[1.7] text-[#4a6a4d] dark:text-[#7a9a7d]">
          {answer}
        </div>
      )}
    </button>
  );
}

export function FaqSection() {
  const t = useTranslations('home.faq');

  const items = [
    { q: t('q1'), a: t('a1') },
    { q: t('q2'), a: t('a2') },
    { q: t('q3'), a: t('a3') },
    { q: t('q4'), a: t('a4') },
    { q: t('q5'), a: t('a5') },
    { q: t('q6'), a: t('a6') },
  ];

  return (
    <section className="landing-alt-bg px-6 py-16 lg:px-16 lg:py-20" id="faq">
      <div className="mx-auto max-w-[1280px]">
        <RevealOnScroll className="text-center mb-2">
          <div className="font-dm-mono mb-3 flex items-center justify-center gap-3 text-[11px] uppercase tracking-[3px] text-[#c8980a]">
            {t('tag')}
            <span className="h-px w-9 bg-[#c8980a] opacity-50" />
          </div>
          <h2 className="font-playfair text-[clamp(34px,3.8vw,52px)] font-bold leading-[1.1] text-[#1a1a1a] dark:text-[#fef9e7]">
            {t('title')}{' '}
            <em className="italic text-[#c8980a]">{t('title_accent')}</em>
          </h2>
        </RevealOnScroll>

        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <FaqItem key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

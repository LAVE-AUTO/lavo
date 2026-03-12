'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

interface FaqItem {
  q: string;
  a: string;
}

function AccordionItem({ item, index }: { item: FaqItem; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className={`rounded-xl border transition-all duration-200 ${open ? 'border-gold/40 bg-gold/3' : 'border-[rgba(200,152,10,0.12)] bg-transparent hover:border-gold/25'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer"
        aria-expanded={open}
      >
        <span className={`text-[15px] sm:text-[16px] font-bold leading-snug pr-4 ${open ? 'text-[#1a1a1a] dark:text-white' : 'text-[#2a2a2a] dark:text-[#d0d0c0]'}`}>
          {item.q}
        </span>
        <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${open ? 'bg-gold text-dark-bg rotate-45' : 'bg-[rgba(200,152,10,0.1)] text-[#c8980a]'}`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="px-6 pb-5 text-[14px] sm:text-[15px] text-[#555] dark:text-[#A0A090] leading-[1.75] animate-fade-in">
          {item.a}
        </div>
      )}
    </div>
  );
}

export function FaqPageContent() {
  const t = useTranslations('faq_page');

  const items: FaqItem[] = Array.from({ length: 10 }, (_, i) => ({
    q: t(`q${i + 1}`),
    a: t(`a${i + 1}`),
  }));

  return (
    <div className="max-w-[1440px] mx-auto px-6 lg:px-16 pt-12 pb-20">

      {/* Header */}
      <div className="max-w-2xl mb-12">
        <p className="text-[12px] font-bold tracking-[3px] uppercase text-[#c8980a] mb-3">{t('eyebrow')}</p>
        <h1 className="font-playfair text-[36px] sm:text-[48px] font-black text-[#1a1a1a] dark:text-white leading-tight mb-4">
          {t('title')} <span className="text-[#c8980a]">{t('title_accent')}</span>
        </h1>
        <p className="text-[15px] sm:text-[16px] text-[#555] dark:text-[#A0A090] leading-relaxed">{t('subtitle')}</p>
      </div>

      {/* Two-column grid on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-14">
        {items.map((item, i) => (
          <AccordionItem key={i} item={item} index={i} />
        ))}
      </div>

      {/* Still have questions */}
      <div className="border border-[rgba(200,152,10,0.2)] rounded-2xl p-8 sm:p-10 text-center max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8980a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <h2 className="text-[20px] font-black text-[#1a1a1a] dark:text-white mb-2">{t('cta_title')}</h2>
        <p className="text-[14px] text-[#555] dark:text-[#A0A090] mb-5">{t('cta_desc')}</p>
        <Link
          href="/nous-contacter"
          className="inline-block px-6 py-3 bg-gold hover:bg-gold-hover text-dark-bg text-[14px] font-bold rounded-xl transition-colors btn-shine"
        >
          {t('cta_btn')}
        </Link>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

interface FaqItem {
  q: string;
  a: string;
}

function MiniAccordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border transition-all duration-150 ${open ? 'border-gold/30' : 'border-[rgba(200,152,10,0.1)] hover:border-gold/20'}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer" aria-expanded={open}>
        <span className={`text-[14px] font-semibold pr-4 ${open ? 'text-[#c8980a]' : 'text-[#1a1a1a] dark:text-[#d0d0c0]'}`}>{item.q}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`shrink-0 text-[#888] transition-transform duration-150 ${open ? 'rotate-180 text-gold' : ''}`} aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 text-[13px] text-[#555] dark:text-[#A0A090] leading-[1.7]">{item.a}</div>
      )}
    </div>
  );
}

export function SupportContent() {
  const t = useTranslations('support_page');

  const faqItems: FaqItem[] = Array.from({ length: 6 }, (_, i) => ({
    q: t(`q${i + 1}`),
    a: t(`a${i + 1}`),
  }));

  const channels = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      ),
      label: t('channel_chat'),
      desc: t('channel_chat_desc'),
      href: '/nous-contacter',
      cta: t('channel_chat_cta'),
      highlight: true,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
      label: t('channel_email'),
      desc: 'support@slowtime.ca',
      href: 'mailto:support@slowtime.ca',
      cta: t('channel_email_cta'),
      highlight: false,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      label: t('channel_faq'),
      desc: t('channel_faq_desc'),
      href: '/faq',
      cta: t('channel_faq_cta'),
      highlight: false,
    },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-6 lg:px-16 pt-12 pb-20">

      {/* Header */}
      <div className="max-w-2xl mb-12">
        <p className="text-[12px] font-bold tracking-[3px] uppercase text-[#c8980a] mb-3">{t('eyebrow')}</p>
        <h1 className="font-playfair text-[36px] sm:text-[44px] font-black text-[#1a1a1a] dark:text-white leading-tight mb-4">
          {t('title')}
        </h1>
        <p className="text-[15px] text-[#555] dark:text-[#A0A090] leading-relaxed">{t('subtitle')}</p>
      </div>

      {/* Support channels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
        {channels.map(({ icon, label, desc, href, cta, highlight }) => (
          <Link
            key={label}
            href={href as Parameters<typeof Link>[0]['href']}
            className={`flex flex-col gap-3 p-6 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${
              highlight
                ? 'bg-gold text-dark-bg border-gold hover:bg-gold-hover'
                : 'bg-[#E8E8D8] dark:bg-dark-card border-[rgba(200,152,10,0.15)] hover:border-gold/30'
            }`}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${highlight ? 'bg-dark-bg/20' : 'bg-gold/10 text-[#c8980a]'}`}>
              {icon}
            </div>
            <div>
              <div className={`text-[15px] font-black mb-1 ${highlight ? 'text-dark-bg' : 'text-[#1a1a1a] dark:text-white'}`}>{label}</div>
              <div className={`text-[13px] ${highlight ? 'text-dark-bg/70' : 'text-[#555] dark:text-[#A0A090]'}`}>{desc}</div>
            </div>
            <span className={`text-[12px] font-bold mt-auto flex items-center gap-1 ${highlight ? 'text-dark-bg' : 'text-[#c8980a]'}`}>
              {cta}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            </span>
          </Link>
        ))}
      </div>

      {/* Quick FAQ */}
      <div>
        <h2 className="text-[20px] font-black text-[#1a1a1a] dark:text-white mb-5">{t('faq_title')}</h2>
        <div className="space-y-3 max-w-3xl">
          {faqItems.map((item, i) => (
            <MiniAccordion key={i} item={item} />
          ))}
        </div>
        <div className="mt-6">
          <Link href="/faq" className="inline-flex items-center gap-2 text-[14px] font-bold text-[#c8980a] hover:text-gold-hover transition-colors">
            {t('all_faq')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

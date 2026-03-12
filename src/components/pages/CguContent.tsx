'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

function Article({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <article className="space-y-3">
      <h2 className="text-[17px] sm:text-[19px] font-black text-[#1a1a1a] dark:text-white">
        <span className="text-[#c8980a] mr-2">Art. {num}</span>
        {title}
      </h2>
      <div className="text-[14px] sm:text-[15px] text-[#555] dark:text-[#A0A090] leading-[1.8] space-y-2 pl-2 border-l-2 border-[rgba(200,152,10,0.2)]">
        {children}
      </div>
    </article>
  );
}

export function CguContent() {
  const t = useTranslations('cgu_page');

  return (
    <div className="max-w-[1440px] mx-auto px-6 lg:px-16 pt-12 pb-20">
      <div className="max-w-3xl">

        {/* Header */}
        <p className="text-[12px] font-bold tracking-[3px] uppercase text-[#c8980a] mb-3">{t('eyebrow')}</p>
        <h1 className="font-playfair text-[36px] sm:text-[44px] font-black text-[#1a1a1a] dark:text-white leading-tight mb-3">
          {t('title')}
        </h1>
        <p className="text-[13px] text-[#888] dark:text-[#666] mb-10">{t('updated')}</p>

        {/* Intro */}
        <div className="rounded-xl border border-[rgba(200,152,10,0.2)] bg-gold/3 px-6 py-5 mb-10 text-[14px] text-[#555] dark:text-[#A0A090] leading-relaxed">
          {t('intro')}
        </div>

        <div className="space-y-9 divide-y divide-[rgba(200,152,10,0.1)]">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="pt-9 first:pt-0">
              <Article num={i + 1} title={t(`a${i + 1}_title`)}>
                <p>{t(`a${i + 1}_body`)}</p>
              </Article>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-[rgba(200,152,10,0.15)] flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <p className="text-[14px] text-[#555] dark:text-[#A0A090]">{t('questions')}</p>
          <Link href="/nous-contacter" className="shrink-0 px-5 py-2.5 bg-gold hover:bg-gold-hover text-dark-bg text-[13px] font-bold rounded-xl transition-colors">
            {t('contact_btn')}
          </Link>
        </div>
      </div>
    </div>
  );
}

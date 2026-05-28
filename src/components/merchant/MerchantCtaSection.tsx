'use client';

import { useTranslations } from 'next-intl';

export function MerchantCtaSection() {
  const t = useTranslations('merchant.cta');

  return (
    <section className="relative overflow-hidden bg-[#DDAF3B] px-6 py-16 lg:px-16 lg:py-20">
      {/* Ghost text behind */}
      <div className="absolute inset-0 flex items-center justify-center font-playfair text-[220px] font-black text-[#001201] opacity-[0.05] pointer-events-none leading-none select-none">
        MARCHANDS
      </div>

      <div className="relative z-10 mx-auto max-w-[1280px] text-center">
        <div className="font-dm-mono mb-4 text-[11px] uppercase tracking-[3px] text-[rgba(13,31,15,0.55)]">
          {t('eyebrow')}
        </div>
        <h2 className="font-playfair mb-4 text-[clamp(36px,5vw,60px)] font-black leading-[1.05] text-[#001201]">
          {t('title')}
        </h2>
        <p className="mx-auto mb-8 max-w-[520px] text-[17px] leading-[1.7] text-[rgba(13,31,15,0.65)]">
          {t('desc')}
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); (e.currentTarget as HTMLFormElement).reset(); }}
          className="mx-auto max-w-[460px]"
        >
          <div className="flex rounded-md overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.2)]">
            <input
              type="email"
              required
              placeholder={t('placeholder')}
              className="flex-1 px-[18px] py-[15px] text-[14px] bg-[#001201] text-[#FFEECA] border-none outline-none placeholder:text-[#B0BFB1]"
            />
            <button
              type="submit"
              className="bg-[#001201] text-[#DDAF3B] px-[26px] py-[15px] text-[12px] font-bold uppercase tracking-[1px] cursor-pointer whitespace-nowrap transition-colors duration-300 hover:bg-[#1a2f1a]"
            >
              {t('btn')}
            </button>
          </div>
        </form>

        <p className="mt-5 text-[12px] text-[rgba(13,31,15,0.45)]">
          {t('note')}
        </p>
      </div>
    </section>
  );
}

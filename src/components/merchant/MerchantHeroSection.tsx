'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MerchantAgendaMockup } from './MerchantAgendaMockup';

export function MerchantHeroSection() {
  const t = useTranslations('merchant.hero');

  return (
    <section className="landing-hero-bg relative min-h-screen overflow-hidden">
      <div
        className="absolute top-0 bottom-0 left-[52%] hidden w-px lg:block"
        style={{ background: 'linear-gradient(to bottom, transparent, rgba(221,175,59,0.25) 30%, rgba(221,175,59,0.25) 70%, transparent)' }}
      />

      <div className="mx-auto grid max-w-[1280px] min-h-screen grid-cols-1 lg:grid-cols-[55%_45%] px-6 lg:px-16">
        {/* Left column */}
        <div className="relative z-10 flex flex-col justify-center pb-12 pt-6 lg:pb-20 lg:pt-[120px] lg:pr-14">
          <div className="font-dm-mono mb-5 flex animate-fade-in-up items-center gap-2.5 text-[11px] uppercase tracking-[3px] text-[#DDAF3B]">
            <span className="h-px w-7 bg-[#DDAF3B]" />
            {t('eyebrow')}
          </div>

          <h1 className="font-playfair animate-fade-in-up animation-delay-200 mb-4 text-[clamp(42px,5vw,70px)] font-black leading-[1.06] text-[#001201] dark:text-[#FFEECA]">
            {t('title_line1')}{' '}
            <em className="italic text-[#DDAF3B]">{t('title_accent1')}</em>
            <br />
            {t('title_line2')}{' '}
            <em className="italic text-[#DDAF3B]">{t('title_accent2')}</em>
          </h1>

          <p className="animate-fade-in-up animation-delay-300 mb-7 max-w-[440px] text-[17px] font-light leading-[1.75] text-[var(--foreground)] dark:text-[#B0BFB1]">
            {t('desc')}
          </p>

          <div className="animate-fade-in-up animation-delay-400 mb-10 flex flex-wrap gap-3.5">
            <Link
              href="/station/apply"
              className="btn-shine inline-block rounded-md bg-[#DDAF3B] px-9 py-[15px] text-[13px] font-bold uppercase tracking-[1.5px] text-[#001201] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(221,175,59,0.45)]"
            >
              {t('btn_primary')}
            </Link>
            <a
              href="#how-it-works"
              className="inline-block rounded-md border border-[rgba(221,175,59,0.4)] px-9 py-[15px] text-[13px] font-semibold uppercase tracking-[1px] text-[#DDAF3B] transition-all duration-300 hover:border-[#DDAF3B] hover:bg-[rgba(221,175,59,0.08)]"
            >
              {t('btn_secondary')}
            </a>
          </div>

          <div className="animate-fade-in-up animation-delay-500 flex gap-10 border-t border-[rgba(221,175,59,0.13)] pt-6">
            {[
              { val: t('kpi_1_val'), label: t('kpi_1_label') },
              { val: t('kpi_2_val'), label: t('kpi_2_label') },
              { val: t('kpi_3_val'), label: t('kpi_3_label') },
            ].map(({ val, label }) => (
              <div key={label}>
                <div className="font-rajdhani text-[40px] font-bold leading-none text-[#DDAF3B]">{val}</div>
                <div className="font-dm-mono mt-1 text-[11px] uppercase tracking-[1px] text-[var(--foreground)] dark:text-[#B0BFB1]">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column - agenda mockup */}
        <div className="animate-fade-in animation-delay-500 relative z-10 hidden lg:flex items-center justify-center px-8 pb-12 pt-20">
          <MerchantAgendaMockup />
        </div>
      </div>
    </section>
  );
}

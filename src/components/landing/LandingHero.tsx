'use client';

import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useTheme } from '@/context/theme-context';

export function LandingHero() {
  const t = useTranslations('landing');
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';

  return (
    <section className="relative overflow-hidden min-h-[92vh] flex items-center">
      {/* Background */}
      <div className="absolute inset-0 bg-[#F8F7F2] dark:bg-dark-bg transition-colors" />

      {/* Decorative orbs */}
      <div className="absolute top-20 -left-32 w-96 h-96 rounded-full bg-gold/8 blur-3xl animate-float-orb" />
      <div className="absolute bottom-20 -right-32 w-80 h-80 rounded-full bg-gold/6 blur-3xl animate-float-orb" style={{ animationDelay: '3s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gold/4 blur-3xl" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 w-full py-20 sm:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left content */}
          <div className="space-y-8 animate-fade-in-up">
            {/* Logo */}
            <div className="mb-2">
              {isDark ? (
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/95 p-1 border border-gold/25 shadow-sm">
                    <Image src="/logo/frame2.png" alt="" width={36} height={36} className="w-9 h-9 object-contain" aria-hidden="true" />
                  </div>
                  <span className="text-[22px] font-bold text-white tracking-wide">Slowtime</span>
                </div>
              ) : (
                <Image src={lightLogoSrc} alt="Slowtime" width={150} height={40} className="h-10 w-auto object-contain" priority />
              )}
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 border border-gold/20">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <span className="text-[13px] font-bold text-gold tracking-wide uppercase">{t('hero_badge')}</span>
            </div>

            {/* Title */}
            <h1 className="text-[42px] sm:text-[56px] lg:text-[64px] font-black leading-[1.05] tracking-tight text-[#0A0A14] dark:text-white">
              {t('hero_title_1')}<br />
              <span className="hero-title-gradient">{t('hero_title_accent')}</span>
            </h1>

            {/* Subtitle */}
            <p className="text-[17px] sm:text-[19px] leading-relaxed text-[#555] dark:text-[#C0C0B0] max-w-lg">
              {t('hero_subtitle')}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/stations"
                className="btn-shine inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gold hover:bg-gold-hover rounded-xl text-[16px] font-bold text-dark-bg transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {t('cta_client')}
              </Link>
              <Link
                href="/merchant"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border-2 border-[#D0D0C0] dark:border-tab-inactive text-[16px] font-bold text-[#1A1A1A] dark:text-white hover:border-gold hover:text-gold dark:hover:border-gold dark:hover:text-gold transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                </svg>
                {t('cta_merchant')}
              </Link>
            </div>
          </div>

          {/* Right visual — abstract illustration */}
          <div className="hidden lg:flex items-center justify-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="relative w-full max-w-md aspect-square">
              {/* Floating cards */}
              <div className="absolute top-8 right-4 w-56 rounded-2xl bg-white dark:bg-dark-card border border-[#E0E0D0] dark:border-tab-inactive p-5 shadow-lg animate-float-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-lavo-success/15 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[#0A0A14] dark:text-white leading-tight">Cr&eacute;neau confirm&eacute;</p>
                    <p className="text-[12px] text-[#888] dark:text-[#999]">14h30 &ndash; 15h00</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-[#E8E8D8] dark:bg-tab-inactive overflow-hidden">
                  <div className="h-full w-3/4 rounded-full bg-gold animate-progress-fill" />
                </div>
              </div>

              <div className="absolute bottom-16 left-0 w-52 rounded-2xl bg-white dark:bg-dark-card border border-[#E0E0D0] dark:border-tab-inactive p-5 shadow-lg animate-float-card" style={{ animationDelay: '2s' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center">
                    <span className="text-[18px]">&#9733;</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[#0A0A14] dark:text-white leading-tight">4.9 / 5</p>
                    <p className="text-[12px] text-[#888] dark:text-[#999]">2,400+ avis</p>
                  </div>
                </div>
              </div>

              <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-48 rounded-2xl bg-white dark:bg-dark-card border border-[#E0E0D0] dark:border-tab-inactive p-5 shadow-lg animate-float-card" style={{ animationDelay: '4s' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#af8408" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[#0A0A14] dark:text-white leading-tight">0 min</p>
                    <p className="text-[12px] text-[#888] dark:text-[#999]">Temps d&rsquo;attente</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

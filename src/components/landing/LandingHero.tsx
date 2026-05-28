'use client';

import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useTheme } from '@/context/theme-context';
import { PhoneMockup } from './PhoneMockup';

export function LandingHero() {
  const t = useTranslations('landing');
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const lightLogoSrc =
    locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';

  return (
    <section className="relative overflow-hidden min-h-[80vh] lg:min-h-[92vh] flex items-center">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#F8F7F2] via-[#F2F0E8] to-[#EBE8DC] dark:from-dark-bg dark:via-[#1E2A1A] dark:to-dark-bg transition-colors" />

      {/* Decorative orbs */}
      <div className="absolute top-20 -left-32 w-96 h-96 rounded-full bg-gold/8 blur-3xl animate-float-orb" />
      <div
        className="absolute bottom-20 -right-32 w-80 h-80 rounded-full bg-gold/6 blur-3xl animate-float-orb"
        style={{ animationDelay: '3s' }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gold/4 blur-3xl" />

      {/* Grid pattern (subtle) */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 w-full py-20 sm:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left content */}
          <div className="space-y-7 animate-fade-in-up text-center lg:text-left">
            {/* Logo */}
            <div className="mb-2 flex justify-center lg:justify-start">
              {isDark ? (
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/95 p-1 border border-gold/25 shadow-sm">
                    <Image
                      src="/logo/frame2.png"
                      alt=""
                      width={36}
                      height={36}
                      className="w-9 h-9 object-contain"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-[22px] font-bold text-white tracking-wide">
                    Hurryline
                  </span>
                </div>
              ) : (
                <Image
                  src={lightLogoSrc}
                  alt="Hurryline"
                  width={150}
                  height={40}
                  className="h-10 w-auto object-contain"
                  priority
                />
              )}
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 border border-gold/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-gold animate-pulse-ring" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
              </span>
              <span className="text-[13px] font-bold text-gold tracking-wide uppercase">
                {t('hero_badge')}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-[34px] sm:text-[48px] lg:text-[64px] font-black leading-[1.05] tracking-tight text-foreground">
              {t('hero_title_1')}
              <br />
              <span className="hero-title-gradient">
                {t('hero_title_accent')}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-[16px] sm:text-[19px] leading-relaxed text-foreground/70 max-w-lg mx-auto lg:mx-0">
              {t('hero_subtitle')}
            </p>

            {/* Highlight -- current service */}
            <p className="inline-flex items-center gap-2 text-[15px] font-semibold text-gold">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t('hero_highlight')}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1 items-center lg:items-start sm:justify-center lg:justify-start">
              <Link
                href="/stations"
                className="btn-shine inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gold hover:bg-gold-hover rounded-xl text-[16px] font-bold text-dark-bg transition-colors shadow-lg shadow-gold/20"
              >
                {t('cta_client')}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/merchant"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border-2 border-border text-[16px] font-bold text-[#1A1A1A] dark:text-white hover:border-gold hover:text-gold dark:hover:border-gold dark:hover:text-gold transition-colors"
              >
                {t('cta_merchant')}
              </Link>
            </div>
          </div>

          {/* Right: Phone mockup - desktop */}
          <div
            className="hidden lg:flex items-center justify-center animate-fade-in"
            style={{ animationDelay: '0.35s' }}
          >
            <PhoneMockup />
          </div>

          {/* Phone mockup - mobile (scaled down, centered below text) */}
          <div
            className="flex lg:hidden items-center justify-center animate-fade-in mt-4"
            style={{ animationDelay: '0.3s' }}
          >
            <div className="scale-[0.82] origin-top">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

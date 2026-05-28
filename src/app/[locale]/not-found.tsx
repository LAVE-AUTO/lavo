'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Branded 404 page - Hurryline hero language (gold orbs, dot pattern,
 * shimmer line, gradient 404 numerals) with two CTAs and a support hint.
 */
export default function NotFoundPage() {
  const t = useTranslations('not_found');

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-[#F8F7F2] dark:bg-[#001201] transition-colors overflow-hidden">

      {/* ── Animated glow orbs ── */}
      <div
        className="absolute -top-32 -right-32 w-[580px] h-[580px] rounded-full bg-gold/[0.10] blur-[100px] animate-float-orb pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-40 -left-24 w-[480px] h-[480px] rounded-full bg-gold/[0.07] blur-[120px] animate-float-orb pointer-events-none"
        style={{ animationDelay: '-5s' }}
        aria-hidden="true"
      />

      {/* Dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23C49A1E' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Gold shimmer line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-gold to-transparent animate-gold-shimmer" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-2xl mx-auto px-6 sm:px-8 py-16 text-center animate-fade-in-up">

        {/* Eyebrow */}
        <div className="font-dm-mono mb-7 inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[3px] text-[#DDAF3B]">
          <span className="h-px w-7 bg-[#DDAF3B]" />
          {t('eyebrow')}
          <span className="h-px w-7 bg-[#DDAF3B]" />
        </div>

        {/* 404 numerals - gradient + soft glow */}
        <div className="relative">
          <p
            className="font-playfair text-[140px] sm:text-[200px] font-black leading-none select-none bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(180deg, rgba(221, 175, 59,0.85) 0%, rgba(221, 175, 59,0.25) 100%)',
            }}
          >
            {t('title')}
          </p>
          <div
            className="absolute inset-0 mx-auto w-1/2 h-1/2 top-1/4 rounded-full bg-gold/20 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
        </div>

        {/* Heading */}
        <h1 className="font-playfair text-[32px] sm:text-[44px] font-black leading-[1.1] text-[#001201] dark:text-[#FFEECA] -mt-4">
          {t('heading')}{' '}
          <em className="italic text-[#DDAF3B]">{t('heading_accent')}</em>
        </h1>

        {/* Description */}
        <p className="mt-5 text-[16px] sm:text-[17px] text-[var(--foreground)] dark:text-[#a0c0a3] leading-[1.75] max-w-xl mx-auto">
          {t('description')}
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="btn-shine inline-flex items-center gap-2 px-7 py-3.5 bg-[#DDAF3B] hover:bg-[#DDAF3B] rounded-md text-[14px] font-bold uppercase tracking-[1px] text-[#001201] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(221, 175, 59,0.45)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            {t('back_home')}
          </Link>

          <Link
            href="/stations"
            className="inline-flex items-center gap-2 px-7 py-3.5 border border-[rgba(221,175,59,0.4)] hover:border-[#DDAF3B] hover:bg-[rgba(221,175,59,0.08)] rounded-md text-[14px] font-semibold uppercase tracking-[0.8px] text-[#DDAF3B] transition-all duration-300"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {t('browse_stations')}
          </Link>
        </div>

        {/* Support hint */}
        <p className="mt-10 pt-7 border-t border-[rgba(221,175,59,0.18)] text-[13px] text-[var(--foreground)] dark:text-[#B0BFB1]">
          {t('support_hint')}{' '}
          <Link href="/nous-contacter" className="font-semibold text-[#DDAF3B] hover:text-[#DDAF3B] transition-colors">
            {t('support_link')}
          </Link>
        </p>
      </div>
    </section>
  );
}

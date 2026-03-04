'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from '@/context/theme-context';

const INTERVAL_MS = 3500;

/* ------------------------------------------------------------------ */
/* Feature icons                                                        */
/* ------------------------------------------------------------------ */

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

const FEATURE_ICONS: ReactNode[] = [
  <CalendarIcon key="calendar" />,
  <CardIcon key="card" />,
  <ShieldIcon key="shield" />,
  <StarIcon key="star" />,
];

const FEATURE_KEYS = [
  { label: 'feature_booking_label',  sub: 'feature_booking_sub' },
  { label: 'feature_payment_label',  sub: 'feature_payment_sub' },
  { label: 'feature_stations_label', sub: 'feature_stations_sub' },
  { label: 'feature_reviews_label',  sub: 'feature_reviews_sub' },
] as const;

/* ------------------------------------------------------------------ */
/* Car illustration                                                     */
/* ------------------------------------------------------------------ */

function CarIllustration({ isDark }: { isDark: boolean }) {
  return (
    <svg viewBox="0 0 280 160" fill="none" className="w-full max-w-[280px] animate-float" aria-hidden="true">
      <path d="M30 110 L50 70 Q60 55 80 55 L200 55 Q220 55 230 70 L250 110 Z" fill={isDark ? '#1E2A1A' : '#243020'} stroke="#C49A1E" strokeWidth="2" />
      <path d="M80 55 L100 25 Q110 15 130 15 L160 15 Q175 15 185 25 L200 55 Z" fill={isDark ? '#243020' : '#2C3828'} stroke="#C49A1E" strokeWidth="1.5" />
      <path d="M95 52 L110 25 Q116 18 128 18 L155 18 Q166 18 172 25 L184 52 Z" fill={isDark ? '#2C3828' : '#3A4A36'} stroke="#C49A1E" strokeWidth="1" opacity="0.8" />
      <line x1="140" y1="55" x2="140" y2="108" stroke="#C49A1E" strokeWidth="1" opacity="0.5" />
      <circle cx="80"  cy="115" r="22" fill={isDark ? '#1A2116' : '#1E2A1A'} stroke="#C49A1E" strokeWidth="2.5" />
      <circle cx="80"  cy="115" r="10" fill="#C49A1E" opacity="0.25" />
      <circle cx="80"  cy="115" r="4"  fill="#C49A1E" />
      <circle cx="200" cy="115" r="22" fill={isDark ? '#1A2116' : '#1E2A1A'} stroke="#C49A1E" strokeWidth="2.5" />
      <circle cx="200" cy="115" r="10" fill="#C49A1E" opacity="0.25" />
      <circle cx="200" cy="115" r="4"  fill="#C49A1E" />
      <ellipse cx="140" cy="140" rx="120" ry="8" fill={isDark ? '#0D1A0D' : '#1A2116'} opacity="0.4" />
      <ellipse cx="60"  cy="40" rx="3"   ry="5" fill="#C49A1E" opacity="0.4"  className="animate-gold-shimmer" />
      <ellipse cx="130" cy="10" rx="2.5" ry="4" fill="#C49A1E" opacity="0.3"  className="animate-gold-shimmer animation-delay-300" />
      <ellipse cx="220" cy="35" rx="2"   ry="4" fill="#C49A1E" opacity="0.35" className="animate-gold-shimmer animation-delay-500" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* BrandPanel                                                           */
/* ------------------------------------------------------------------ */

/**
 * Left-side branding panel for auth pages on desktop.
 *
 * Logo strategy:
 *   Dark + any locale → frame2.png badge + "Slowtime" text
 *   Light + FR        → logo2_2.png       (full FR wordmark)
 *   Light + EN        → logo_anglais_1.png (full EN wordmark)
 *
 * Feature carousel auto-cycles every 3.5 s; clicking a dot resets the timer.
 */
export function BrandPanel() {
  const t      = useTranslations('brand_panel');
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';

  const [activeIdx, setActiveIdx]     = useState(0);
  const [progressKey, setProgressKey] = useState(0);
  const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null);

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % FEATURE_KEYS.length);
      setProgressKey((prev) => prev + 1);
    }, INTERVAL_MS);
  }, []);

  useEffect(() => {
    startInterval();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [startInterval]);

  const handleDotClick = (idx: number) => {
    setActiveIdx(idx);
    setProgressKey((prev) => prev + 1);
    startInterval();
  };

  const textPrimary   = isDark ? 'text-white'             : 'text-[#1A2116]';
  const textSecondary = isDark ? 'text-lavo-muted'         : 'text-[#5A6B54]';
  const trackColor    = isDark ? 'bg-white/10'             : 'bg-black/10';
  const inactiveDot   = isDark ? 'bg-white/20 hover:bg-white/40' : 'bg-black/20 hover:bg-black/40';
  const featureCardBg = isDark ? 'bg-white/5 border border-white/8' : 'bg-black/5 border border-black/6';

  return (
    <div
      className="relative w-full h-full flex flex-col justify-between overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(160deg, #0D1A0D 0%, #1A2116 45%, #243020 100%)'
          : 'linear-gradient(160deg, #F8F4EC 0%, #EEE8D4 45%, #E8DFCA 100%)',
      }}
    >
      {/* Dot-pattern overlay */}
      <div
        className={`absolute inset-0 ${isDark ? 'opacity-[0.07]' : 'opacity-[0.15]'}`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C49A1E' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Gold shimmer top bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gold animate-gold-shimmer" />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14">

        {/* ── Logo ── */}
        <div className="animate-fade-in">
          {isDark ? (
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-white/95 p-1 border border-gold/25 shadow-sm shrink-0">
                <Image
                  src="/logo/frame2.png"
                  alt=""
                  width={36}
                  height={36}
                  className="w-9 h-9 object-contain"
                  aria-hidden="true"
                />
              </div>
              <span className="text-xl font-bold text-white tracking-wide">
                Slowtime
              </span>
            </div>
          ) : (
            <Image
              src={lightLogoSrc}
              alt="Slowtime"
              width={180}
              height={48}
              className="object-contain h-10 w-auto"
            />
          )}
        </div>

        {/* ── Car illustration + headline ── */}
        <div className="flex flex-col items-center text-center gap-6">
          <CarIllustration isDark={isDark} />

          <div>
            <h2 className={`text-3xl xl:text-4xl font-bold leading-tight animate-fade-in-up animation-delay-100 ${textPrimary}`}>
              {t('headline')}{' '}
              <span className="text-gold">{t('headline_accent')}</span>
            </h2>
            <p className={`mt-3 text-[15px] leading-relaxed animate-fade-in-up animation-delay-200 ${textSecondary}`}>
              {t('subtitle')}
            </p>
          </div>
        </div>

        {/* ── Feature carousel ── */}
        <div className="flex flex-col gap-4">
          {/* Active feature card */}
          <div
            key={activeIdx}
            className={`flex items-start gap-4 animate-fade-in-up rounded-xl p-4 ${featureCardBg}`}
          >
            <div className="mt-0.5 w-11 h-11 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold shrink-0">
              {FEATURE_ICONS[activeIdx]}
            </div>
            <div>
              <p className={`text-[17px] font-bold leading-snug ${textPrimary}`}>
                {t(FEATURE_KEYS[activeIdx].label)}
              </p>
              <p className={`text-[13px] mt-0.5 leading-snug ${textSecondary}`}>
                {t(FEATURE_KEYS[activeIdx].sub)}
              </p>
            </div>
          </div>

          {/* Progress bar + dot navigation */}
          <div className="flex flex-col gap-2.5">
            <div className={`w-full h-[2px] rounded-full ${trackColor}`}>
              <div
                key={progressKey}
                className="h-full bg-gold rounded-full animate-progress-fill"
                style={{ animationDuration: `${INTERVAL_MS}ms` }}
              />
            </div>

            <div className="flex items-center gap-2">
              {FEATURE_KEYS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDotClick(i)}
                  aria-label={`Feature ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === activeIdx ? 'w-5 h-2 bg-gold' : `w-2 h-2 ${inactiveDot}`
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

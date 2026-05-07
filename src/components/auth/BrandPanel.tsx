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
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
/* Brand emblem - premium animated mark replacing the legacy car       */
/* ------------------------------------------------------------------ */

/**
 * Quiet, premium illustration that ties to the car-wash service without
 * resorting to a literal vehicle: a soft gold halo with concentric rings,
 * a centered water droplet and a few gentle shimmer accents. All motion
 * is subtle (slow scale + opacity), no bounce.
 */
function BrandEmblem({ isDark }: { isDark: boolean }) {
  const gold = '#C49A1E';
  const goldStrong = '#D4AA2E';
  const ringStroke = isDark ? 'rgba(196,154,30,0.28)' : 'rgba(196,154,30,0.32)';
  const dropFill = isDark ? '#1A2518' : '#FFFCF1';
  const dropStroke = goldStrong;

  return (
    <div className="relative flex w-full max-w-[260px] items-center justify-center">
      {/* Outer halo glow */}
      <div
        className="absolute inset-0 -z-10 m-auto h-56 w-56 rounded-full opacity-60 blur-3xl"
        style={{
          background: `radial-gradient(circle, ${gold} 0%, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      <svg viewBox="0 0 240 240" fill="none" className="w-full" aria-hidden="true">
        <defs>
          <linearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={goldStrong} stopOpacity="0.95" />
            <stop offset="100%" stopColor={gold} stopOpacity="0.65" />
          </linearGradient>
          <radialGradient id="dropHighlight" cx="0.35" cy="0.35" r="0.4">
            <stop offset="0%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <filter id="emblemGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Concentric pulse rings - 3 staggered for a calm rhythm */}
        <g stroke={ringStroke} fill="none">
          <circle
            cx="120"
            cy="120"
            r="100"
            strokeWidth="1.2"
            className="origin-center animate-emblem-pulse"
            style={{ animationDelay: '0s' }}
          />
          <circle
            cx="120"
            cy="120"
            r="80"
            strokeWidth="1.4"
            className="origin-center animate-emblem-pulse"
            style={{ animationDelay: '1s' }}
          />
          <circle
            cx="120"
            cy="120"
            r="60"
            strokeWidth="1.6"
            className="origin-center animate-emblem-pulse"
            style={{ animationDelay: '2s' }}
          />
        </g>

        {/* Central disc - gold ring with subtle inner bevel */}
        <circle cx="120" cy="120" r="48" fill={isDark ? 'rgba(15,26,12,0.6)' : 'rgba(255,253,245,0.7)'} stroke={gold} strokeWidth="1.5" />
        <circle cx="120" cy="120" r="44" fill="none" stroke={gold} strokeWidth="0.6" strokeDasharray="2 4" opacity="0.5" />

        {/* Water droplet at the heart of the emblem */}
        <g filter="url(#emblemGlow)" className="origin-center animate-float">
          <path
            d="M120 82 C100 110 92 124 92 138 a28 28 0 0 0 56 0 c0 -14 -8 -28 -28 -56 z"
            fill="url(#dropGrad)"
            stroke={dropStroke}
            strokeWidth="1.5"
          />
          {/* Inner droplet body so it sits on the dark background cleanly */}
          <path
            d="M120 92 C104 116 98 126 98 138 a22 22 0 0 0 44 0 c0 -12 -6 -22 -22 -46 z"
            fill={dropFill}
            opacity="0.18"
          />
          {/* Glossy highlight on the upper-left of the droplet */}
          <ellipse
            cx="111"
            cy="118"
            rx="6"
            ry="14"
            fill="url(#dropHighlight)"
            transform="rotate(-18 111 118)"
          />
        </g>

        {/* Sparkle accents around the rings */}
        <g filter="url(#emblemGlow)">
          <circle cx="50" cy="60" r="2" fill={gold} opacity="0.6" className="animate-gold-shimmer" />
          <circle cx="200" cy="70" r="2.5" fill={gold} opacity="0.55" className="animate-gold-shimmer animation-delay-300" />
          <circle cx="60" cy="180" r="1.8" fill={gold} opacity="0.5" className="animate-gold-shimmer animation-delay-500" />
          <circle cx="190" cy="180" r="2.2" fill={gold} opacity="0.55" className="animate-gold-shimmer animation-delay-200" />
          <circle cx="120" cy="30" r="1.6" fill={gold} opacity="0.45" className="animate-gold-shimmer animation-delay-400" />
        </g>
      </svg>
    </div>
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

  const textPrimary   = isDark ? 'text-white'             : 'text-dark-bg';
  const textSecondary = isDark ? 'text-lavo-muted'         : 'text-[#5A6B54]';
  const trackColor    = isDark ? 'bg-white/10'             : 'bg-black/10';
  const inactiveDot   = isDark ? 'bg-white/20 hover:bg-white/40' : 'bg-black/20 hover:bg-black/40';
  const featureCardBg = isDark ? 'bg-white/5 border border-white/8' : 'bg-black/5 border border-black/6';

  return (
    <div
      className="relative w-full h-full flex flex-col justify-between overflow-hidden"
      style={{
        backgroundImage: isDark
          ? `linear-gradient(160deg, rgba(13,26,13,0.91) 0%, rgba(26,33,22,0.88) 45%, rgba(36,48,32,0.85) 100%), url('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1400&q=80')`
          : `linear-gradient(160deg, rgba(248,244,236,0.89) 0%, rgba(238,232,212,0.86) 45%, rgba(232,223,202,0.83) 100%), url('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1400&q=80')`,
        backgroundSize: 'auto, cover',
        backgroundPosition: 'center, center',
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

        {/* ── Brand emblem + headline ── */}
        <div className="flex flex-col items-center text-center gap-6">
          <BrandEmblem isDark={isDark} />

          <div>
            <h2 className={`text-4xl xl:text-[2.75rem] font-bold leading-tight animate-fade-in-up animation-delay-100 ${textPrimary}`}>
              {t('headline')}{' '}
              <span className="text-gold">{t('headline_accent')}</span>
            </h2>
            <p className={`mt-3 text-[16px] leading-relaxed animate-fade-in-up animation-delay-200 ${textSecondary}`}>
              {t('subtitle')}
            </p>
          </div>
        </div>

        {/* ── Feature carousel ── */}
        <div className="flex flex-col gap-3">

          {/* Editorial counter + divider */}
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-gold/60" />
            <span className={`text-[11px] font-bold tracking-[0.2em] uppercase ${isDark ? 'text-gold/80' : 'text-gold'}`}>
              {String(activeIdx + 1).padStart(2, '0')} / {String(FEATURE_KEYS.length).padStart(2, '0')}
            </span>
          </div>

          {/* Active feature card */}
          <div
            key={activeIdx}
            className={`flex items-center gap-5 animate-fade-in-up rounded-2xl p-5 ${featureCardBg}`}
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/20 border-2 border-gold/40 flex items-center justify-center text-gold shrink-0">
              {FEATURE_ICONS[activeIdx]}
            </div>
            <div>
              <p className={`text-[21px] font-bold leading-tight ${textPrimary}`}>
                {t(FEATURE_KEYS[activeIdx].label)}
              </p>
              <p className={`text-[14px] mt-1.5 leading-relaxed ${textSecondary}`}>
                {t(FEATURE_KEYS[activeIdx].sub)}
              </p>
            </div>
          </div>

          {/* Progress bar + dot navigation */}
          <div className="flex items-center gap-4">
            <div className={`flex-1 h-[3px] rounded-full ${trackColor}`}>
              <div
                key={progressKey}
                className="h-full bg-gold rounded-full animate-progress-fill"
                style={{ animationDuration: `${INTERVAL_MS}ms` }}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {FEATURE_KEYS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDotClick(i)}
                  aria-label={`Feature ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === activeIdx ? 'w-6 h-2.5 bg-gold' : `w-2.5 h-2.5 ${inactiveDot}`
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

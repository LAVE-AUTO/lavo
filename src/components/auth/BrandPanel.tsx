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
/* Car illustration                                                     */
/* ------------------------------------------------------------------ */

function CarIllustration({ isDark }: { isDark: boolean }) {
  const bodyFill = isDark ? '#1A2518' : '#1E2D1E';
  const bodyStroke = '#C49A1E';
  const glassFill = isDark ? '#2A3A28' : '#3A4E36';
  const glassReflect = isDark ? '#3C5038' : '#4D6448';
  const wheelOuter = isDark ? '#151D13' : '#1A2518';
  const chromeFill = '#C49A1E';

  return (
    <svg viewBox="0 0 320 170" fill="none" className="w-full max-w-[300px] animate-float" aria-hidden="true">
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isDark ? '#2A3A28' : '#2C3828'} />
          <stop offset="100%" stopColor={bodyFill} />
        </linearGradient>
        <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={glassReflect} />
          <stop offset="60%" stopColor={glassFill} />
        </linearGradient>
        <linearGradient id="chromeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#A07818" />
          <stop offset="50%" stopColor="#D4AA2E" />
          <stop offset="100%" stopColor="#A07818" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="160" cy="152" rx="130" ry="10" fill={isDark ? '#0A120A' : '#151D13'} opacity="0.35" />

      {/* Main body — sleek sedan profile */}
      <path
        d="M32 112 C32 112 40 78 50 70 L72 58 Q80 54 90 54 L230 54 Q240 54 248 58 L270 70 C280 78 288 112 288 112 L288 118 Q288 122 284 122 L36 122 Q32 122 32 118 Z"
        fill="url(#bodyGrad)" stroke={bodyStroke} strokeWidth="1.8"
      />

      {/* Roof/cabin glass — curved greenhouse */}
      <path
        d="M88 54 L108 24 Q114 16 126 16 L194 16 Q206 16 212 24 L232 54"
        fill="url(#glassGrad)" stroke={bodyStroke} strokeWidth="1.5"
      />

      {/* Glass reflection highlight */}
      <path
        d="M108 50 L120 24 Q124 19 132 19 L170 19 Q178 19 182 24 L194 50"
        fill="white" opacity="0.06"
      />

      {/* Window divider (B-pillar) */}
      <line x1="160" y1="54" x2="160" y2="18" stroke={bodyStroke} strokeWidth="1.2" opacity="0.4" />

      {/* Chrome accent line along body */}
      <path
        d="M48 90 Q50 86 58 84 L262 84 Q270 86 272 90"
        fill="none" stroke="url(#chromeGrad)" strokeWidth="1.5" opacity="0.7"
      />

      {/* Front headlight */}
      <ellipse cx="46" cy="100" rx="8" ry="6" fill={chromeFill} opacity="0.5" filter="url(#glow)" />
      <ellipse cx="46" cy="100" rx="4" ry="3" fill={chromeFill} opacity="0.9" />

      {/* Rear taillight */}
      <ellipse cx="278" cy="100" rx="6" ry="5" fill="#C44040" opacity="0.5" filter="url(#glow)" />
      <ellipse cx="278" cy="100" rx="3" ry="2.5" fill="#E05050" opacity="0.8" />

      {/* Front wheel */}
      <circle cx="90" cy="122" r="24" fill={wheelOuter} stroke={bodyStroke} strokeWidth="2" />
      <circle cx="90" cy="122" r="16" fill={isDark ? '#1E2A1A' : '#222E20'} stroke={bodyStroke} strokeWidth="1" opacity="0.6" />
      <circle cx="90" cy="122" r="8" fill={chromeFill} opacity="0.2" />
      <circle cx="90" cy="122" r="3.5" fill={chromeFill} opacity="0.9" />
      {/* Wheel spokes */}
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <line
          key={angle}
          x1={90 + 5 * Math.cos((angle * Math.PI) / 180)}
          y1={122 + 5 * Math.sin((angle * Math.PI) / 180)}
          x2={90 + 15 * Math.cos((angle * Math.PI) / 180)}
          y2={122 + 15 * Math.sin((angle * Math.PI) / 180)}
          stroke={chromeFill} strokeWidth="1.2" opacity="0.35"
        />
      ))}

      {/* Rear wheel */}
      <circle cx="230" cy="122" r="24" fill={wheelOuter} stroke={bodyStroke} strokeWidth="2" />
      <circle cx="230" cy="122" r="16" fill={isDark ? '#1E2A1A' : '#222E20'} stroke={bodyStroke} strokeWidth="1" opacity="0.6" />
      <circle cx="230" cy="122" r="8" fill={chromeFill} opacity="0.2" />
      <circle cx="230" cy="122" r="3.5" fill={chromeFill} opacity="0.9" />
      {/* Wheel spokes */}
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <line
          key={angle}
          x1={230 + 5 * Math.cos((angle * Math.PI) / 180)}
          y1={122 + 5 * Math.sin((angle * Math.PI) / 180)}
          x2={230 + 15 * Math.cos((angle * Math.PI) / 180)}
          y2={122 + 15 * Math.sin((angle * Math.PI) / 180)}
          stroke={chromeFill} strokeWidth="1.2" opacity="0.35"
        />
      ))}

      {/* Door handle */}
      <rect x="140" y="78" width="18" height="3" rx="1.5" fill={chromeFill} opacity="0.5" />

      {/* Side mirror — front */}
      <path d="M74 56 L68 50 L68 58 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth="1" />

      {/* Sparkle accents */}
      <g filter="url(#glow)">
        <circle cx="55" cy="35" r="2" fill={chromeFill} opacity="0.5" className="animate-gold-shimmer" />
        <circle cx="160" cy="6" r="2.5" fill={chromeFill} opacity="0.4" className="animate-gold-shimmer animation-delay-300" />
        <circle cx="265" cy="30" r="2" fill={chromeFill} opacity="0.45" className="animate-gold-shimmer animation-delay-500" />
        <circle cx="110" cy="5" r="1.5" fill={chromeFill} opacity="0.3" className="animate-gold-shimmer animation-delay-200" />
        <circle cx="220" cy="8" r="1.5" fill={chromeFill} opacity="0.35" className="animate-gold-shimmer animation-delay-400" />
      </g>
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

        {/* ── Car illustration + headline ── */}
        <div className="flex flex-col items-center text-center gap-6">
          <CarIllustration isDark={isDark} />

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

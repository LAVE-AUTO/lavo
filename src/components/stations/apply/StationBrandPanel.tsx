'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from '@/context/theme-context';

const INTERVAL_MS = 3800;

/* ------------------------------------------------------------------ */
/* Feature icons                                                        */
/* ------------------------------------------------------------------ */

function CalendarIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <rect x="7" y="14" width="3" height="3" rx="0.5" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h1v1h-1z M16 14h1v1h-1z M14 16h1v1h-1z M16 16h3v3h-3z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}

const FEATURE_ICONS = [
  <CalendarIcon key="calendar" />,
  <PaymentIcon key="payment" />,
  <QrIcon key="qr" />,
  <ChartIcon key="chart" />,
];

const FEATURE_KEYS = [
  { label: 'feature_booking_label', sub: 'feature_booking_sub' },
  { label: 'feature_payment_label', sub: 'feature_payment_sub' },
  { label: 'feature_qr_label',      sub: 'feature_qr_sub' },
  { label: 'feature_stats_label',   sub: 'feature_stats_sub' },
] as const;

/* ------------------------------------------------------------------ */
/* Station mockup illustration                                          */
/* ------------------------------------------------------------------ */

function StationMockup({ isDark }: { isDark: boolean }) {
  const cardBg = isDark ? '#1E2A1A' : '#F5F0E4';
  const borderC = isDark ? '#2E3E2A' : '#D4C88A';
  const textCol = isDark ? '#FFF8EC' : '#1A2116';
  const mutedC  = isDark ? '#7A9A7D' : '#6B7A64';
  const goldC   = '#C8980A';

  const slots = [
    { time: '09:00', name: 'Jean D.', type: 'Ext.', active: true },
    { time: '09:45', name: 'Marie L.', type: 'Int.', active: false },
    { time: '10:30', name: 'Pierre M.', type: 'Full', active: false },
  ];

  return (
    <div className="w-full max-w-[280px] animate-float" aria-hidden="true">
      {/* Card header */}
      <div
        className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        style={{ background: cardBg, border: `1.5px solid ${borderC}` }}
      >
        {/* Top bar */}
        <div style={{ background: goldC, padding: '10px 16px' }} className="flex items-center justify-between">
          <span className="text-[12px] font-bold tracking-[1.5px] uppercase text-[#0d1f0f]">
            Agenda · Aujourd'hui
          </span>
          <span className="text-[11px] font-semibold text-[#0d1f0f] opacity-70">3 rendez-vous</span>
        </div>

        {/* Slots */}
        <div className="p-4 flex flex-col gap-2.5">
          {slots.map((slot) => (
            <div
              key={slot.time}
              className="flex items-center gap-3 rounded-xl p-3 transition-all"
              style={{
                background: slot.active
                  ? isDark ? 'rgba(200,152,10,0.15)' : 'rgba(200,152,10,0.12)'
                  : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${slot.active ? 'rgba(200,152,10,0.4)' : borderC}`,
              }}
            >
              <div
                className="shrink-0 text-center rounded-lg"
                style={{ width: 44, padding: '4px 0', background: isDark ? '#2A3A28' : '#E8E0C4' }}
              >
                <span className="block text-[13px] font-bold" style={{ color: goldC, fontFamily: 'monospace' }}>
                  {slot.time}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: textCol }}>{slot.name}</p>
                <p className="text-[11px]" style={{ color: mutedC }}>{slot.type}</p>
              </div>
              {slot.active && (
                <span
                  className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full"
                  style={{ background: '#00C851', color: '#fff' }}
                >
                  En cours
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer kpi */}
        <div
          className="flex items-center justify-around px-4 py-3"
          style={{ borderTop: `1px solid ${borderC}` }}
        >
          {[
            { val: '124$', label: "Aujourd'hui" },
            { val: '1 850$', label: 'Ce mois' },
            { val: '5%', label: 'Commission' },
          ].map(({ val, label }) => (
            <div key={label} className="text-center">
              <p className="text-[15px] font-bold" style={{ color: goldC }}>{val}</p>
              <p className="text-[10px]" style={{ color: mutedC }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StationBrandPanel                                                    */
/* ------------------------------------------------------------------ */

/**
 * Left-side branding panel for station apply and station login pages.
 * Uses station-specific features carousel.
 */
export function StationBrandPanel() {
  const t      = useTranslations('station_panel');
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

  const textPrimary   = isDark ? 'text-white'         : 'text-[#1A1A1A]';
  const textSecondary = isDark ? 'text-[#7A9A7D]'     : 'text-[#4A6A4D]';
  const trackColor    = isDark ? 'bg-white/10'         : 'bg-black/10';
  const inactiveDot   = isDark ? 'bg-white/20 hover:bg-white/40' : 'bg-black/20 hover:bg-black/40';
  const featureCardBg = isDark ? 'bg-white/5 border border-white/8' : 'bg-black/5 border border-black/6';

  return (
    <div
      className="relative w-full h-full flex flex-col justify-between overflow-hidden"
      style={{
        backgroundImage: isDark
          ? `linear-gradient(155deg, rgba(13,26,13,0.93) 0%, rgba(20,30,18,0.90) 50%, rgba(28,40,24,0.88) 100%), url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1400&q=80')`
          : `linear-gradient(155deg, rgba(245,240,228,0.92) 0%, rgba(235,225,200,0.89) 50%, rgba(228,215,188,0.86) 100%), url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1400&q=80')`,
        backgroundSize: 'auto, cover',
        backgroundPosition: 'center, center',
      }}
    >
      {/* Dot-pattern overlay */}
      <div
        className={`absolute inset-0 ${isDark ? 'opacity-[0.06]' : 'opacity-[0.12]'}`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C8980A' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Gold shimmer top bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#C8980A] animate-gold-shimmer" />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14">

        {/* Logo */}
        <div className="animate-fade-in">
          {isDark ? (
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-white/95 p-1 border border-[rgba(200,152,10,0.25)] shadow-sm shrink-0">
                <Image src="/logo/frame2.png" alt="" width={36} height={36} className="w-9 h-9 object-contain" aria-hidden="true" />
              </div>
              <div>
                <span className="text-xl font-bold text-white tracking-wide">Slowtime</span>
                <p className="text-[10px] font-semibold tracking-[2px] uppercase text-[#C8980A] leading-none">Marchands</p>
              </div>
            </div>
          ) : (
            <div>
              <Image src={lightLogoSrc} alt="Slowtime" width={160} height={44} className="object-contain h-9 w-auto" />
              <p className="text-[10px] font-semibold tracking-[2px] uppercase text-[#C8980A] mt-1">Espace Marchands</p>
            </div>
          )}
        </div>

        {/* Station mockup + headline */}
        <div className="flex flex-col items-center text-center gap-6">
          <StationMockup isDark={isDark} />
          <div>
            <h2 className={`text-3xl xl:text-[2.4rem] font-bold leading-tight animate-fade-in-up animation-delay-100 ${textPrimary}`}>
              {t('headline')}{' '}
              <span className="text-[#C8980A]">{t('headline_accent')}</span>
            </h2>
            <p className={`mt-3 text-[15px] leading-relaxed animate-fade-in-up animation-delay-200 ${textSecondary}`}>
              {t('subtitle')}
            </p>
          </div>
        </div>

        {/* Feature carousel */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-[rgba(200,152,10,0.6)]" />
            <span className={`text-[11px] font-bold tracking-[0.2em] uppercase ${isDark ? 'text-[rgba(200,152,10,0.8)]' : 'text-[#C8980A]'}`}>
              {String(activeIdx + 1).padStart(2, '0')} / {String(FEATURE_KEYS.length).padStart(2, '0')}
            </span>
          </div>

          <div
            key={activeIdx}
            className={`flex items-center gap-5 animate-fade-in-up rounded-2xl p-5 ${featureCardBg}`}
          >
            <div className="w-14 h-14 rounded-2xl bg-[rgba(200,152,10,0.2)] border-2 border-[rgba(200,152,10,0.4)] flex items-center justify-center text-[#C8980A] shrink-0">
              {FEATURE_ICONS[activeIdx]}
            </div>
            <div>
              <p className={`text-[19px] font-bold leading-tight ${textPrimary}`}>
                {t(FEATURE_KEYS[activeIdx].label)}
              </p>
              <p className={`text-[13px] mt-1.5 leading-relaxed ${textSecondary}`}>
                {t(FEATURE_KEYS[activeIdx].sub)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex-1 h-[3px] rounded-full ${trackColor}`}>
              <div
                key={progressKey}
                className="h-full bg-[#C8980A] rounded-full animate-progress-fill"
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
                    i === activeIdx ? 'w-6 h-2.5 bg-[#C8980A]' : `w-2.5 h-2.5 ${inactiveDot}`
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

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

function AccountIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}

const FEATURE_ICONS = [
  <CalendarIcon key="calendar" />,
  <PaymentIcon key="payment" />,
  <QrIcon key="qr" />,
  <ChartIcon key="chart" />,
];

const STEP_FEATURE_ICONS = [
  <AccountIcon key="account" />,
  <CalendarIcon key="calendar" />,
  <ShieldIcon key="shield" />,
];

const FEATURE_KEYS = [
  { label: 'feature_booking_label', sub: 'feature_booking_sub' },
  { label: 'feature_payment_label', sub: 'feature_payment_sub' },
  { label: 'feature_qr_label',      sub: 'feature_qr_sub' },
  { label: 'feature_stats_label',   sub: 'feature_stats_sub' },
] as const;

const STEP_FEATURE_KEYS = [
  { label: 'feature_account_label', sub: 'feature_account_sub' },
  { label: 'feature_booking_label', sub: 'feature_booking_sub' },
  { label: 'feature_kyc_label',     sub: 'feature_kyc_sub' },
] as const;

const STEP_HEADLINE_KEYS = [
  { headline: 'step1_headline', accent: 'step1_headline_accent', subtitle: 'step1_subtitle' },
  { headline: 'step2_headline', accent: 'step2_headline_accent', subtitle: 'step2_subtitle' },
  { headline: 'step3_headline', accent: 'step3_headline_accent', subtitle: 'step3_subtitle' },
] as const;

/* ------------------------------------------------------------------ */
/* Mockup illustrations                                                 */
/* ------------------------------------------------------------------ */

function StationMockup({ isDark }: { isDark: boolean }) {
  const t = useTranslations('station_panel');
  const cardBg = isDark ? '#001A05' : '#FFF9EC';
  const borderC = isDark ? '#001A05' : '#DDAF3B';
  const textCol = isDark ? '#FFEECA' : '#001201';
  const mutedC  = isDark ? '#B0BFB1' : '#B0BFB1';
  const goldC   = '#DDAF3B';

  const slots = [
    { time: '09:00', name: 'Jean D.', type: t('mock_slot_ext'), active: true },
    { time: '09:45', name: 'Marie L.', type: t('mock_slot_int'), active: false },
    { time: '10:30', name: 'Pierre M.', type: t('mock_slot_full'), active: false },
  ];

  return (
    <div className="w-full max-w-[280px] animate-float" aria-hidden="true">
      <div
        className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        style={{ background: cardBg, border: `1.5px solid ${borderC}` }}
      >
        <div style={{ background: goldC, padding: '10px 16px' }} className="flex items-center justify-between">
          <span className="text-[12px] font-bold tracking-[1.5px] uppercase text-[#001201]">
            {t('mock_agenda_title')}
          </span>
          <span className="text-[11px] font-semibold text-[#001201] opacity-70">{t('mock_agenda_appointments', { count: slots.length })}</span>
        </div>

        <div className="p-4 flex flex-col gap-2.5">
          {slots.map((slot) => (
            <div
              key={slot.time}
              className="flex items-center gap-3 rounded-xl p-3 transition-all"
              style={{
                background: slot.active
                  ? isDark ? 'rgba(221, 175, 59,0.15)' : 'rgba(221, 175, 59,0.12)'
                  : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${slot.active ? 'rgba(221, 175, 59,0.4)' : borderC}`,
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
                  {t('mock_in_progress')}
                </span>
              )}
            </div>
          ))}
        </div>

        <div
          className="flex items-center justify-around px-4 py-3"
          style={{ borderTop: `1px solid ${borderC}` }}
        >
          {[
            { val: '124$', label: t('mock_stat_today') },
            { val: '1 850$', label: t('mock_stat_month') },
            { val: '5%', label: t('mock_stat_commission') },
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

function AccountSetupMockup({ isDark }: { isDark: boolean }) {
  const t = useTranslations('station_panel');
  const cardBg  = isDark ? '#001A05' : '#FFF9EC';
  const borderC = isDark ? '#001A05' : '#DDAF3B';
  const textCol = isDark ? '#FFEECA' : '#001201';
  const mutedC  = isDark ? '#B0BFB1' : '#B0BFB1';
  const goldC   = '#DDAF3B';

  const fields = [
    { label: t('mock_field_email'), filled: true },
    { label: t('mock_field_phone'), filled: true },
    { label: t('mock_field_password'), filled: false },
  ];

  return (
    <div className="w-full max-w-[280px] animate-float" aria-hidden="true">
      <div
        className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        style={{ background: cardBg, border: `1.5px solid ${borderC}` }}
      >
        <div style={{ background: goldC, padding: '10px 16px' }} className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[rgba(0,0,0,0.15)] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <span className="text-[12px] font-bold tracking-[1.5px] uppercase text-[#001201]">{t('mock_account_title')}</span>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-[10px] font-semibold mb-1" style={{ color: mutedC }}>{f.label}</p>
              <div
                className="h-9 rounded-lg flex items-center px-3"
                style={{
                  background: f.filled ? (isDark ? 'rgba(221, 175, 59,0.12)' : 'rgba(221, 175, 59,0.10)') : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                  border: `1px solid ${f.filled ? 'rgba(221, 175, 59,0.4)' : borderC}`,
                }}
              >
                {f.filled && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ background: goldC }} />
                    <span className="text-[11px]" style={{ color: textCol }}>••••••••••</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div
            className="mt-1 h-9 rounded-lg flex items-center justify-center"
            style={{ background: goldC }}
          >
            <span className="text-[12px] font-bold text-[#001201] tracking-wider">{t('mock_continue')}</span>
          </div>
        </div>
        <div
          className="flex items-center justify-center gap-2 px-4 py-3"
          style={{ borderTop: `1px solid ${borderC}` }}
        >
          {[1, 2, 3].map((n, i) => (
            <div
              key={n}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === 0 ? 24 : 8,
                background: i === 0 ? goldC : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function KycMockup({ isDark }: { isDark: boolean }) {
  const t = useTranslations('station_panel');
  const cardBg  = isDark ? '#001A05' : '#FFF9EC';
  const borderC = isDark ? '#001A05' : '#DDAF3B';
  const mutedC  = isDark ? '#B0BFB1' : '#B0BFB1';
  const goldC   = '#DDAF3B';

  const steps = [
    { label: t('mock_kyc_sent'),   done: true,  active: false },
    { label: t('mock_kyc_review'), done: false, active: true  },
    { label: t('mock_kyc_active'), done: false, active: false },
  ];

  return (
    <div className="w-full max-w-[280px] animate-float" aria-hidden="true">
      <div
        className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        style={{ background: cardBg, border: `1.5px solid ${borderC}` }}
      >
        <div style={{ background: goldC, padding: '10px 16px' }} className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[rgba(0,0,0,0.15)] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          </div>
          <span className="text-[12px] font-bold tracking-[1.5px] uppercase text-[#001201]">{t('mock_kyc_title')}</span>
        </div>
        <div className="p-4 flex flex-col gap-0">
          {steps.map((s, i) => (
            <div key={s.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: s.done ? goldC : s.active ? goldC : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                    border: `2px solid ${s.done ? goldC : s.active ? goldC : borderC}`,
                  }}
                >
                  {s.done ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#001201" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : s.active ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-dark-bg animate-pulse" />
                  ) : (
                    <div className="w-2 h-2 rounded-full" style={{ background: mutedC }} />
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className="w-0.5 h-7 mt-0.5"
                    style={{ background: s.done ? goldC : borderC }}
                  />
                )}
              </div>
              <div className="pt-1 pb-3">
                <p
                  className="text-[12px] font-semibold"
                  style={{ color: s.done ? goldC : s.active ? goldC : mutedC }}
                >
                  {s.label}
                </p>
                {s.active && (
                  <p className="text-[10px] mt-0.5" style={{ color: mutedC }}>{t('mock_kyc_delay')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <div
          className="flex items-center justify-around px-4 py-3"
          style={{ borderTop: `1px solid ${borderC}` }}
        >
          {[
            { val: '1/3', label: t('mock_kyc_stat_docs') },
            { val: '48h', label: t('mock_kyc_stat_delay') },
            { val: '100%', label: t('mock_kyc_stat_secure') },
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

interface StationBrandPanelProps {
  step?: 1 | 2 | 3;
}

/**
 * Left-side branding panel for station apply and station login pages.
 * When a step prop is provided (apply page), content animates per step.
 * When no step is provided (login page), the existing feature carousel runs.
 */
export function StationBrandPanel({ step }: StationBrandPanelProps) {
  const t      = useTranslations('station_panel');
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';
  const darkLogoSrc = locale === 'fr' ? '/logo/logo22_2.png' : '/logo/logo_anglais_2.png';


  /* Carousel state (only active when no step prop) */
  const [activeIdx, setActiveIdx]     = useState(0);
  const [progressKey, setProgressKey] = useState(0);
  const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null);

  const isControlled = step !== undefined;

  const startInterval = useCallback(() => {
    if (isControlled) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % FEATURE_KEYS.length);
      setProgressKey((prev) => prev + 1);
    }, INTERVAL_MS);
  }, [isControlled]);

  useEffect(() => {
    if (isControlled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    startInterval();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [startInterval, isControlled]);

  const handleDotClick = (idx: number) => {
    if (isControlled) return;
    setActiveIdx(idx);
    setProgressKey((prev) => prev + 1);
    startInterval();
  };

  const textPrimary   = isDark ? 'text-white'         : 'text-[#001201]';
  const textSecondary = isDark ? 'text-[#B0BFB1]'     : 'text-[var(--foreground)]';
  const trackColor    = isDark ? 'bg-white/10'         : 'bg-black/10';
  const inactiveDot   = isDark ? 'bg-white/20 hover:bg-white/40' : 'bg-black/20 hover:bg-black/40';
  const featureCardBg = isDark ? 'bg-white/5 border border-white/8' : 'bg-black/5 border border-black/6';

  /* Step-controlled values */
  const stepIdx        = isControlled ? step - 1 : activeIdx;
  const stepKeys       = isControlled ? STEP_HEADLINE_KEYS[stepIdx] : null;
  const stepFeatureKey = isControlled ? STEP_FEATURE_KEYS[stepIdx]  : FEATURE_KEYS[activeIdx];
  const stepIcon       = isControlled ? STEP_FEATURE_ICONS[stepIdx] : FEATURE_ICONS[activeIdx];

  const currentMockup = isControlled
    ? [
        <AccountSetupMockup key="account" isDark={isDark} />,
        <StationMockup key="station" isDark={isDark} />,
        <KycMockup key="kyc" isDark={isDark} />,
      ][stepIdx]
    : <StationMockup isDark={isDark} />;

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
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#DDAF3B] animate-gold-shimmer" />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14">

        {/* Logo row with optional step indicator */}
        <div className="flex items-start justify-between animate-fade-in">
          <div>
            {isDark ? (
              <div>
                <Image src={darkLogoSrc} alt="Hurryline" width={160} height={44} className="object-contain h-9 w-auto" />
                <p className="text-[10px] font-semibold tracking-[2px] uppercase text-[#DDAF3B] mt-1">{t('space_merchants')}</p>
              </div>
            ) : (
              <div>
                <Image src={lightLogoSrc} alt="Hurryline" width={160} height={44} className="object-contain h-9 w-auto" />
                <p className="text-[10px] font-semibold tracking-[2px] uppercase text-[#DDAF3B] mt-1">{t('space_merchants')}</p>
              </div>
            )}
          </div>

          {/* Step progress indicator */}
          {isControlled && (
            <div className="flex items-center gap-1.5 mt-2">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="transition-all duration-300 rounded-full"
                  style={{
                    width: n === step ? 20 : 6,
                    height: 6,
                    background: n === step ? '#DDAF3B' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Mockup + headline - keyed on step to trigger fade-in on change */}
        <div
          key={isControlled ? step : 'static'}
          className="flex flex-col items-center text-center gap-6 animate-fade-in"
        >
          {currentMockup}
          <div>
            <h2 className={`text-3xl xl:text-[2.4rem] font-bold leading-tight ${textPrimary}`}>
              {stepKeys ? (
                <>
                  {t(stepKeys.headline)}{' '}
                  <span className="text-[#DDAF3B]">{t(stepKeys.accent)}</span>
                </>
              ) : (
                <>
                  {t('headline')}{' '}
                  <span className="text-[#DDAF3B]">{t('headline_accent')}</span>
                </>
              )}
            </h2>
            <p className={`mt-3 text-[15px] leading-relaxed ${textSecondary}`}>
              {stepKeys ? t(stepKeys.subtitle) : t('subtitle')}
            </p>
          </div>
        </div>

        {/* Feature carousel / step feature card */}
        <div className="flex flex-col gap-3">
          {!isControlled && (
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-[rgba(221,175,59,0.6)]" />
              <span className={`text-[11px] font-bold tracking-[0.2em] uppercase ${isDark ? 'text-[rgba(221,175,59,0.8)]' : 'text-[#DDAF3B]'}`}>
                {String(activeIdx + 1).padStart(2, '0')} / {String(FEATURE_KEYS.length).padStart(2, '0')}
              </span>
            </div>
          )}

          <div
            key={isControlled ? `step-feature-${step}` : activeIdx}
            className={`flex items-center gap-5 animate-fade-in-up rounded-2xl p-5 ${featureCardBg}`}
          >
            <div className="w-14 h-14 rounded-2xl bg-[rgba(221,175,59,0.2)] border-2 border-[rgba(221,175,59,0.4)] flex items-center justify-center text-[#DDAF3B] shrink-0">
              {stepIcon}
            </div>
            <div>
              <p className={`text-[19px] font-bold leading-tight ${textPrimary}`}>
                {t(stepFeatureKey.label)}
              </p>
              <p className={`text-[13px] mt-1.5 leading-relaxed ${textSecondary}`}>
                {t(stepFeatureKey.sub)}
              </p>
            </div>
          </div>

          {!isControlled && (
            <div className="flex items-center gap-4">
              <div className={`flex-1 h-[3px] rounded-full ${trackColor}`}>
                <div
                  key={progressKey}
                  className="h-full bg-[#DDAF3B] rounded-full animate-progress-fill"
                  style={{ animationDuration: `${INTERVAL_MS}ms` }}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {FEATURE_KEYS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDotClick(i)}
                    aria-label={t('feature_dot_aria', { index: i + 1 })}
                    className={`rounded-full transition-all duration-300 ${
                      i === activeIdx ? 'w-6 h-2.5 bg-[#DDAF3B]' : `w-2.5 h-2.5 ${inactiveDot}`
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

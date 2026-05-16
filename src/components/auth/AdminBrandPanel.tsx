'use client';

import Image from 'next/image';
import { useLocale } from 'next-intl';
import { useTheme } from '@/context/theme-context';

/* ------------------------------------------------------------------ */
/* Dashboard mockup                                                     */
/* ------------------------------------------------------------------ */

/* Decorative dashboard mockup - all text is intentionally hardcoded as it is purely visual/illustrative. */
function AdminMockup({ isDark }: { isDark: boolean }) {
  const cardBg  = isDark ? '#1E2A1A' : '#F5F0E4';
  const borderC = isDark ? '#2E3E2A' : '#D4C88A';
  const textCol = isDark ? '#FFF8EC' : '#1A2116';
  const mutedC  = isDark ? '#7A9A7D' : '#6B7A64';
  const goldC   = '#C8980A';

  const stats = [
    { val: '48',      label: 'Stations actives' },
    { val: '1 240',   label: 'Clients' },
    { val: '9 870 $', label: 'Ce mois' },
  ];

  const rows = [
    { name: 'Station Nord',  status: 'active',   amount: '324 $' },
    { name: 'Station Sud',   status: 'pending',  amount: '-' },
    { name: 'Station Est',   status: 'active',   amount: '198 $' },
  ];

  const statusColor: Record<string, string> = {
    active:  '#00C851',
    pending: '#FF8800',
  };

  return (
    <div className="w-full max-w-[280px] animate-float" aria-hidden="true">
      <div
        className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        style={{ background: cardBg, border: `1.5px solid ${borderC}` }}
      >
        {/* Header */}
        <div style={{ background: goldC, padding: '10px 16px' }} className="flex items-center justify-between">
          <span className="text-[12px] font-bold tracking-[1.5px] uppercase text-[#0d1f0f]">
            Tableau de bord
          </span>
          <span className="text-[11px] font-semibold text-[#0d1f0f] opacity-70">Admin</span>
        </div>

        {/* KPI row */}
        <div className="flex items-center justify-around px-4 py-3" style={{ borderBottom: `1px solid ${borderC}` }}>
          {stats.map(({ val, label }) => (
            <div key={label} className="text-center">
              <p className="text-[15px] font-bold" style={{ color: goldC }}>{val}</p>
              <p className="text-[10px]" style={{ color: mutedC }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Stations list */}
        <div className="p-4 flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.name}
              className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${borderC}`,
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: statusColor[row.status] }}
                />
                <span className="text-[12px] font-semibold" style={{ color: textCol }}>{row.name}</span>
              </div>
              <span className="text-[12px] font-bold" style={{ color: goldC }}>{row.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AdminBrandPanel                                                      */
/* ------------------------------------------------------------------ */

/* Decorative feature list - content is intentionally hardcoded French as it is part of the branding panel
   visual design, not functional UI. Update manually if brand copy changes. */
const FEATURES = [
  { label: 'Gestion des stations',  sub: 'Valider, suspendre, configurer chaque station.' },
  { label: 'Suivi des clients',     sub: 'Accédez aux profils et historiques de tous les clients.' },
  { label: 'Contrôle financier',    sub: 'Commissions, transactions et rapports en temps réel.' },
];

/**
 * Left-side branding panel for the admin login page.
 * Shows a platform overview mockup and key admin capabilities.
 */
export function AdminBrandPanel() {
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';

  const textPrimary   = isDark ? 'text-white'       : 'text-[#1A1A1A]';
  const textSecondary = isDark ? 'text-[#7A9A7D]'   : 'text-[#4A6A4D]';
  const featureCardBg = isDark ? 'bg-white/5 border border-white/8' : 'bg-black/5 border border-black/6';

  return (
    <div
      className="relative w-full h-full flex flex-col justify-between overflow-hidden"
      style={{
        backgroundImage: isDark
          ? `linear-gradient(155deg, rgba(10,18,10,0.94) 0%, rgba(18,26,16,0.91) 50%, rgba(26,36,22,0.89) 100%), url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1400&q=80')`
          : `linear-gradient(155deg, rgba(245,240,228,0.93) 0%, rgba(235,225,200,0.90) 50%, rgba(228,215,188,0.87) 100%), url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1400&q=80')`,
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

        {/* Logo + Admin badge */}
        <div className="animate-fade-in">
          {isDark ? (
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-white/95 p-1 border border-[rgba(200,152,10,0.25)] shadow-sm shrink-0">
                <Image src="/logo/frame2.png" alt="" width={36} height={36} className="w-9 h-9 object-contain" aria-hidden="true" />
              </div>
              <div>
                <span className="text-xl font-bold text-white tracking-wide">Hurryline</span>
                <p className="text-[10px] font-semibold tracking-[2px] uppercase text-[#C8980A] leading-none">Administration</p>
              </div>
            </div>
          ) : (
            <div>
              <Image src={lightLogoSrc} alt="Hurryline" width={160} height={44} className="object-contain h-9 w-auto" />
              <p className="text-[10px] font-semibold tracking-[2px] uppercase text-[#C8980A] mt-1">Administration</p>
            </div>
          )}
        </div>

        {/* Mockup + headline */}
        <div className="flex flex-col items-center text-center gap-6 animate-fade-in">
          <AdminMockup isDark={isDark} />
          <div>
            <h2 className={`text-3xl xl:text-[2.4rem] font-bold leading-tight ${textPrimary}`}>
              Pilotez la plateforme{' '}
              <span className="text-[#C8980A]">en temps réel</span>
            </h2>
            <p className={`mt-3 text-[15px] leading-relaxed ${textSecondary}`}>
              Gérez les stations, les clients et les finances depuis un seul espace sécurisé.
            </p>
          </div>
        </div>

        {/* Feature list */}
        <div className="flex flex-col gap-2.5">
          {FEATURES.map(({ label, sub }) => (
            <div key={label} className={`flex items-start gap-4 rounded-2xl p-4 ${featureCardBg}`}>
              <div className="w-2 h-2 rounded-full bg-[#C8980A] mt-1.5 shrink-0" />
              <div>
                <p className={`text-[15px] font-bold leading-tight ${textPrimary}`}>{label}</p>
                <p className={`text-[12px] mt-1 leading-relaxed ${textSecondary}`}>{sub}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

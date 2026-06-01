'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { KpiData } from './types';

const STORAGE_KEY = 'lavo_dashboard_kpi_masked';

interface Props {
  data: KpiData;
}

const FILL_BASIS = { revenue: 250, clients: 15, lateFees: 25, occupancy: 100 } as const;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pct(value: number | null, basis: number): number {
  if (value === null) return 0;
  return clamp((value / basis) * 100, 0, 100);
}

function formatMoney(n: number | null): string {
  return n === null ? '—' : `${n}$`;
}

function formatCount(n: number | null): string {
  return n === null ? '—' : String(n);
}

function formatPercent(n: number | null): string {
  return n === null ? '—' : `${n}%`;
}

interface CardConfig {
  Icon: React.ComponentType;
  value: string;
  /** Length of the masking placeholder when KPI are hidden (keeps layout stable). */
  maskWidth: number;
  label: string;
  fill: number;
  fillColor: 'gold' | 'green' | 'red';
}

export function DashboardOverviewSection({ data }: Props) {
  const t = useTranslations('station_dashboard');
  const [masked, setMasked] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === '1') setMasked(true);
  }, []);

  function toggle() {
    setMasked((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* private mode */ }
      return next;
    });
  }

  const cards: CardConfig[] = [
    {
      Icon: MoneyIcon,
      value: formatMoney(data.revenue),
      maskWidth: 4,
      label: t('kpi_revenue'),
      fill: pct(data.revenue, FILL_BASIS.revenue),
      fillColor: 'gold',
    },
    {
      Icon: UsersIcon,
      value: formatCount(data.clients),
      maskWidth: 2,
      label: t('kpi_clients'),
      fill: pct(data.clients, FILL_BASIS.clients),
      fillColor: 'gold',
    },
    {
      Icon: ClockIcon,
      value: formatMoney(data.lateFees),
      maskWidth: 3,
      label: t('kpi_late_fees'),
      fill: pct(data.lateFees, FILL_BASIS.lateFees),
      fillColor: 'red',
    },
    {
      Icon: ChartIcon,
      value: formatPercent(data.occupancy),
      maskWidth: 3,
      label: t('kpi_occupancy'),
      fill: pct(data.occupancy, FILL_BASIS.occupancy),
      fillColor: 'green',
    },
  ];

  return (
    <section className="flex flex-shrink-0 flex-col border-b border-[#D8CCA0] bg-transparent dark:border-[#1A2A14] dark:bg-dark-bg">
      <div className="flex items-center gap-2 px-5 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/55 dark:text-[#B0BFB1]">
          {t('overview_title')}
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={masked}
          aria-label={masked ? t('overview_reveal') : t('overview_hide_aria')}
          title={masked ? t('overview_reveal') : t('overview_hide_aria')}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF9EC] text-foreground/65 transition-colors hover:bg-[#DDD8C4] hover:text-[#001201] dark:bg-[#1A2A14] dark:text-[#B0BFB1] dark:hover:bg-[#001A05] dark:hover:text-[#FFF9EC]"
        >
          {masked ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        {masked && (
          <span className="text-[10px] font-bold text-[#999] dark:text-[#5A5A4A]">
            {t('overview_masked')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pb-4 xl:grid-cols-4">
        {cards.map((card, idx) => (
          <FullKpiCard
            key={card.label}
            card={card}
            delay={idx * 60}
            masked={masked}
          />
        ))}
      </div>
    </section>
  );
}

function FullKpiCard({
  card,
  delay,
  masked,
}: {
  card: CardConfig;
  delay: number;
  masked: boolean;
}) {
  const Icon = card.Icon;
  return (
    <div
      className="group relative animate-fade-in-up rounded-2xl border border-[#FFF9EC] bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-[#1A2A14] dark:bg-[#182214]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-2.5 leading-none">
        <Icon />
      </div>
      <div
        className={`mb-0.5 text-[28px] font-black leading-none text-[#001201] dark:text-[#FFF9EC] tabular-nums ${
          masked ? 'tracking-[0.08em]' : ''
        }`}
      >
        {masked ? '•'.repeat(card.maskWidth) : card.value}
      </div>
      <div className="text-[12px] font-semibold text-foreground/55 dark:text-[#B0BFB1]">{card.label}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F0EDE0] dark:bg-dark-bg">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: masked ? '100%' : `${card.fill}%`,
            background: masked
              ? 'repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0 4px, transparent 4px 8px)'
              : fillColorVar(card.fillColor),
          }}
        />
      </div>
    </div>
  );
}

function fillColorVar(c: 'gold' | 'green' | 'red'): string {
  if (c === 'green') return '#2ECC71';
  if (c === 'red') return '#EF4444';
  return '#DDAF3B';
}

const MoneyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.79 19.79 0 0 1 5.17-6.13" />
    <path d="M9.9 5.08A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.81 19.81 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

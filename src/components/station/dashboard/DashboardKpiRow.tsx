'use client';

import { useTranslations } from 'next-intl';

export interface KpiData {
  revenue: number | null;
  clients: number | null;
  lateFees: number | null;
  occupancy: number | null;
}

interface KpiCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  /** Optional sub-line. When unavailable we display the "endpoint pending" message. */
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  pending?: boolean;
  animationDelay?: string;
}

function TrendArrow({ type, color }: { type: 'up' | 'down' | 'neutral'; color: string }) {
  if (type === 'up') {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill={color} aria-hidden="true">
        <polygon points="5,1 9,9 1,9" />
      </svg>
    );
  }
  if (type === 'down') {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill={color} aria-hidden="true">
        <polygon points="5,9 9,1 1,1" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" stroke={color} strokeWidth="2" aria-hidden="true">
      <line x1="1" y1="5" x2="9" y2="5" />
    </svg>
  );
}

function KpiCard({ icon, value, label, trend, trendType, pending, animationDelay, comingSoonLabel }: KpiCardProps & { comingSoonLabel: string }) {
  const trendColor =
    trendType === 'up' ? '#2ECC71' : trendType === 'down' ? '#EF4444' : '#3B82F6';

  return (
    <div
      className={`group animate-fade-in-up rounded-2xl border border-[#E8E4DC] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-[#1A2A14] dark:bg-[#182214] ${
        pending ? 'opacity-75' : ''
      }`}
      style={{ animationDelay }}
    >
      <div className="mb-3 leading-none">{icon}</div>
      <div className="mb-1 text-[26px] font-black tabular-nums leading-none text-[#1A1A0A] dark:text-[#F0EDD4]">
        {value}
      </div>
      <div className="text-[12px] font-semibold text-[#888] dark:text-[#9A9A8A]">{label}</div>
      {trend && trendType && !pending && (
        <div
          className="mt-2 flex items-center gap-1 text-[11px] font-bold"
          style={{ color: trendColor }}
        >
          <TrendArrow type={trendType} color={trendColor} />
          {trend}
        </div>
      )}
      {pending && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F0EDE0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#888] dark:bg-[#0F1A0C] dark:text-[#9A9A8A]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C49A1E]" aria-hidden="true" />
          <span>{comingSoonLabel}</span>
        </div>
      )}
    </div>
  );
}

const MoneyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

interface DashboardKpiRowProps {
  data: KpiData;
}

function formatMoney(n: number | null): string {
  if (n === null) return '-';
  return `${n} $`;
}

function formatCount(n: number | null): string {
  if (n === null) return '-';
  return String(n);
}

function formatPercent(n: number | null): string {
  if (n === null) return '-';
  return `${n} %`;
}

export function DashboardKpiRow({ data }: DashboardKpiRowProps) {
  const t = useTranslations('station_dashboard');

  // KPI cards. Trends are not yet returned by /station/dashboard; we hide them
  // until the backend provides previous-period data (see project_pending_backend_specs.md).
  const cards: KpiCardProps[] = [
    {
      icon: <MoneyIcon />,
      value: formatMoney(data.revenue),
      label: t('kpi_revenue'),
      animationDelay: '0ms',
    },
    {
      icon: <UsersIcon />,
      value: formatCount(data.clients),
      label: t('kpi_clients'),
      animationDelay: '80ms',
    },
    {
      icon: <ClockIcon />,
      value: formatMoney(data.lateFees),
      label: t('kpi_late_fees'),
      animationDelay: '160ms',
    },
    {
      icon: <ChartIcon />,
      value: formatPercent(data.occupancy),
      label: t('kpi_occupancy'),
      animationDelay: '240ms',
    },
  ];

  const comingSoonLabel = t('kpi_coming_soon');

  return (
    <div className="grid grid-cols-1 gap-3 border-b border-[#E0DCD0] bg-[#F7F6F2] px-5 py-4 sm:grid-cols-2 xl:grid-cols-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} comingSoonLabel={comingSoonLabel} />
      ))}
    </div>
  );
}

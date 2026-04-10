'use client';

import { useTranslations } from 'next-intl';

export interface KpiData {
  revenue: number;
  clients: number;
  lateFees: number;
  occupancy: number;
}

interface KpiCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  trend: string;
  trendType: 'up' | 'down' | 'neutral';
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
  // neutral — dash
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" stroke={color} strokeWidth="2" aria-hidden="true">
      <line x1="1" y1="5" x2="9" y2="5" />
    </svg>
  );
}

function KpiCard({ icon, value, label, trend, trendType, animationDelay }: KpiCardProps) {
  const trendColor =
    trendType === 'up' ? '#2ECC71' : trendType === 'down' ? '#EF4444' : '#3B82F6';

  return (
    <div
      className="animate-fade-in-up rounded-xl bg-[#F0EDE0] p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-md dark:bg-[#1E2A1A]"
      style={{ animationDelay }}
    >
      <div className="mb-2 text-[22px] leading-none">{icon}</div>
      <div className="mb-0.5 text-[26px] font-black leading-none text-[#1A1A0A] dark:text-[#F0EDD4]">
        {value}
      </div>
      <div className="text-[11px] font-medium text-[#666] dark:text-[#A0A090]">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1 text-[10px] font-bold" style={{ color: trendColor }}>
        <TrendArrow type={trendType} color={trendColor} />
        {trend}
      </div>
    </div>
  );
}

const MoneyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

interface DashboardKpiRowProps {
  data: KpiData;
}

export function DashboardKpiRow({ data }: DashboardKpiRowProps) {
  const t = useTranslations('station_dashboard');

  const cards: KpiCardProps[] = [
    {
      icon: <MoneyIcon />,
      value: `${data.revenue}$`,
      label: t('kpi_revenue'),
      trend: `+8% ${t('kpi_trend_vs_yesterday')}`,
      trendType: 'up',
      animationDelay: '0ms',
    },
    {
      icon: <UsersIcon />,
      value: String(data.clients),
      label: t('kpi_clients'),
      trend: `+2 ${t('kpi_trend_vs_yesterday')}`,
      trendType: 'up',
      animationDelay: '80ms',
    },
    {
      icon: <ClockIcon />,
      value: `${data.lateFees}$`,
      label: t('kpi_late_fees'),
      trend: t('kpi_client_count', { n: 1 }),
      trendType: 'down',
      animationDelay: '160ms',
    },
    {
      icon: <ChartIcon />,
      value: `${data.occupancy}%`,
      label: t('kpi_occupancy'),
      trend: t('kpi_excellent'),
      trendType: 'neutral',
      animationDelay: '240ms',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 border-b border-[#DDD9CC] bg-[#E8E4D4] px-5 py-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}

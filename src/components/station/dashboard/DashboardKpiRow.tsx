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
}

function KpiCard({ icon, value, label, trend, trendType }: KpiCardProps) {
  const trendColor =
    trendType === 'up' ? '#2ECC71' : trendType === 'down' ? '#EF4444' : '#3B82F6';

  return (
    <div className="rounded-xl p-4" style={{ background: '#EDE9CC' }}>
      <div className="mb-2 text-[22px] leading-none">{icon}</div>
      <div className="mb-0.5 text-[26px] font-black leading-none" style={{ color: '#1A1A0A' }}>
        {value}
      </div>
      <div className="text-[11px] font-medium" style={{ color: '#666' }}>
        {label}
      </div>
      <div className="mt-1 text-[10px] font-bold" style={{ color: trendColor }}>
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
    },
    {
      icon: <UsersIcon />,
      value: String(data.clients),
      label: t('kpi_clients'),
      trend: `+2 ${t('kpi_trend_vs_yesterday')}`,
      trendType: 'up',
    },
    {
      icon: <ClockIcon />,
      value: `${data.lateFees}$`,
      label: t('kpi_late_fees'),
      trend: t('kpi_client_count', { n: 1 }),
      trendType: 'down',
    },
    {
      icon: <ChartIcon />,
      value: `${data.occupancy}%`,
      label: t('kpi_occupancy'),
      trend: t('kpi_excellent'),
      trendType: 'neutral',
    },
  ];

  return (
    <div
      className="grid grid-cols-4 gap-3 border-b px-5 py-4"
      style={{ background: '#111A0E', borderColor: '#1A2A14' }}
    >
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}

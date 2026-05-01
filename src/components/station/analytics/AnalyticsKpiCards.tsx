 'use client';

import { useTranslations } from 'next-intl';

interface KpiData {
  totalRevenue: number;
  avgRevenue: number;
  revenueGrowth: number;
  uniqueClients: number;
  completedServices: number;
  avgFillRate: number;
}

interface KpiCard {
  id: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  borderColor: string;
}

interface AnalyticsKpiCardsProps {
  kpi: KpiData;
}

export function AnalyticsKpiCards({ kpi }: AnalyticsKpiCardsProps) {
  const t = useTranslations('station_analytics');

  const kpiCards: KpiCard[] = [
    {
      id: 'total_revenue',
      label: t('kpi_total_revenue'),
      value: formatCurrency(kpi.totalRevenue),
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#C49A1E' }}><path d="M12 1v2"/><path d="M20 7v2"/><path d="M4 7v2"/><path d="M12 21v2"/><circle cx="12" cy="12" r="6"/><path d="M10 9h4v6h-4z"/></svg>,
      borderColor: '#C49A1E',
    },
    {
      id: 'avg_revenue',
      label: t('kpi_avg_revenue'),
      value: formatCurrency(kpi.avgRevenue),
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#4E2507' }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 14h2v4H8zM12 10h2v8h-2zM16 6h2v12h-2z"/></svg>,
      borderColor: '#4E2507',
    },
    {
      id: 'revenue_growth',
      label: t('kpi_revenue_growth'),
      value: `${formatPercent(kpi.revenueGrowth)}%`,
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: kpi.revenueGrowth >= 0 ? '#00C851' : '#FF2525' }}><polyline points="3 17 9 11 13 15 21 7"/></svg>,
      borderColor: kpi.revenueGrowth >= 0 ? '#00C851' : '#FF2525',
    },
    {
      id: 'unique_clients',
      label: t('kpi_unique_clients'),
      value: kpi.uniqueClients.toString(),
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#FF8800' }}><path d="M16 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM8 11c1.657 0 3-1.343 3-3S9.657 5 8 5 5 6.343 5 8s1.343 3 3 3zM8 13c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zM16 13c-.29 0-.62.02-.98.05C15.44 13.03 16 13.5 16 13z"/></svg>,
      borderColor: '#FF8800',
    },
    {
      id: 'completed_services',
      label: t('kpi_completed_services'),
      value: kpi.completedServices.toString(),
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#00C851' }}><path d="M20 6L9 17l-5-5"/></svg>,
      borderColor: '#00C851',
    },
    {
      id: 'avg_fill_rate',
      label: t('kpi_avg_fill_rate'),
      value: `${formatPercent(kpi.avgFillRate)}%`,
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#0044FF' }}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
      borderColor: '#0044FF',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {kpiCards.map((card) => (
        <div
          key={card.id}
          className="group animate-fade-in-up rounded-2xl border border-[#E8E4DC] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-[#1A2A14] dark:bg-[#182214]"
          style={{ borderLeft: `4px solid ${card.borderColor}` }}
        >
          <div className="mb-3 leading-none">{card.icon}</div>
          <p className="mb-1 text-[28px] font-black leading-none tabular-nums text-[#1A1A0A] dark:text-[#F0EDD4]">
            {card.value}
          </p>
          <p className="text-[12px] font-semibold text-[#888] dark:text-[#9A9A8A]">{card.label}</p>
        </div>
      ))}
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return value.toFixed(1);
}

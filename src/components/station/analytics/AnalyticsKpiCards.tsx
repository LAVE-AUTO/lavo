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

interface AnalyticsKpiCardsProps {
  kpi: KpiData;
}

export function AnalyticsKpiCards({ kpi }: AnalyticsKpiCardsProps) {
  const t = useTranslations('station_analytics');

  const kpiCards = [
    {
      label: t('kpi_total_revenue'),
      value: formatCurrency(kpi.totalRevenue),
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M12 1v2"/><path d="M20 7v2"/><path d="M4 7v2"/><path d="M12 21v2"/><circle cx="12" cy="12" r="6"/><path d="M10 9h4v6h-4z"/></svg>,
      color: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-l-4 border-blue-600',
    },
    {
      label: t('kpi_avg_revenue'),
      value: formatCurrency(kpi.avgRevenue),
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 14h2v4H8zM12 10h2v8h-2zM16 6h2v12h-2z"/></svg>,
      color: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-l-4 border-purple-600',
    },
    {
      label: t('kpi_revenue_growth'),
      value: `${formatPercent(kpi.revenueGrowth)}%`,
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><polyline points="3 17 9 11 13 15 21 7"/></svg>,
      color: kpi.revenueGrowth >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20',
      borderColor: kpi.revenueGrowth >= 0 ? 'border-l-4 border-green-600' : 'border-l-4 border-red-600',
    },
    {
      label: t('kpi_unique_clients'),
      value: kpi.uniqueClients.toString(),
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600"><path d="M16 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM8 11c1.657 0 3-1.343 3-3S9.657 5 8 5 5 6.343 5 8s1.343 3 3 3zM8 13c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zM16 13c-.29 0-.62.02-.98.05C15.44 13.03 16 13.5 16 13z"/></svg>,
      color: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-l-4 border-orange-600',
    },
    {
      label: t('kpi_completed_services'),
      value: kpi.completedServices.toString(),
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-600"><path d="M20 6L9 17l-5-5"/></svg>,
      color: 'bg-cyan-50 dark:bg-cyan-900/20',
      borderColor: 'border-l-4 border-cyan-600',
    },
    {
      label: t('kpi_avg_fill_rate'),
      value: `${formatPercent(kpi.avgFillRate)}%`,
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
      color: 'bg-amber-50 dark:bg-amber-900/20',
      borderColor: 'border-l-4 border-amber-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {kpiCards.map((card, idx) => (
        <div
          key={idx}
          className={`rounded-lg border-l-4 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-slate-800 ${card.borderColor} ${card.color}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
            </div>
            <span className="text-2xl">{card.icon}</span>
          </div>
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

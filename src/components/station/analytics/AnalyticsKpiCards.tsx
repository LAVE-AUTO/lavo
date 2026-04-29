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
      icon: '💰',
      color: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-l-4 border-blue-600',
    },
    {
      label: t('kpi_avg_revenue'),
      value: formatCurrency(kpi.avgRevenue),
      icon: '📊',
      color: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-l-4 border-purple-600',
    },
    {
      label: t('kpi_revenue_growth'),
      value: `${formatPercent(kpi.revenueGrowth)}%`,
      icon: '📈',
      color: kpi.revenueGrowth >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20',
      borderColor: kpi.revenueGrowth >= 0 ? 'border-l-4 border-green-600' : 'border-l-4 border-red-600',
    },
    {
      label: t('kpi_unique_clients'),
      value: kpi.uniqueClients.toString(),
      icon: '👥',
      color: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-l-4 border-orange-600',
    },
    {
      label: t('kpi_completed_services'),
      value: kpi.completedServices.toString(),
      icon: '✓',
      color: 'bg-cyan-50 dark:bg-cyan-900/20',
      borderColor: 'border-l-4 border-cyan-600',
    },
    {
      label: t('kpi_avg_fill_rate'),
      value: `${formatPercent(kpi.avgFillRate)}%`,
      icon: '🎯',
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

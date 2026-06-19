'use client';

import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import type { PeriodType } from './AnalyticsPeriodToggle';

interface AnalyticsData {
  revenue: Array<{ date: string; value: number }>;
  clients: Array<{ date: string; value: number }>;
  completed: Array<{ date: string; value: number }>;
  kpi: {
    totalRevenue: number;
    avgRevenue: number;
    revenueGrowth: number;
    uniqueClients: number;
    completedServices: number;
    avgFillRate: number;
  };
}

interface AnalyticsExportButtonProps {
  data: AnalyticsData;
  period: PeriodType;
}

export function AnalyticsExportButton({ data, period }: AnalyticsExportButtonProps) {
  const t = useTranslations('station_analytics');
  const { error: showError } = useToast();

  const handleExportCsv = () => {
    try {
      // Prepare CSV content
      const lines: string[] = [];

      // Header
      lines.push('# Analytics Export');
      lines.push(`Period: ${period}`);
      lines.push(`Exported: ${new Date().toLocaleString('fr-CA')}`);
      lines.push('');

      // KPI Section
      lines.push('KPI Summary');
      lines.push('Metric,Value');
      lines.push(`Total Revenue,${data.kpi.totalRevenue.toFixed(2)}`);
      lines.push(`Average Revenue,${data.kpi.avgRevenue.toFixed(2)}`);
      lines.push(`Revenue Growth %,${data.kpi.revenueGrowth.toFixed(2)}`);
      lines.push(`Unique Clients,${data.kpi.uniqueClients}`);
      lines.push(`Completed Services,${data.kpi.completedServices}`);
      lines.push(`Average Fill Rate %,${data.kpi.avgFillRate.toFixed(2)}`);
      lines.push('');

      // Revenue Data
      lines.push('Revenue Daily Data');
      lines.push('Date,Revenue');
      data.revenue.forEach((item) => {
        lines.push(`${item.date},${item.value.toFixed(2)}`);
      });
      lines.push('');

      // Clients Data
      lines.push('Unique Clients Daily Data');
      lines.push('Date,Clients');
      data.clients.forEach((item) => {
        lines.push(`${item.date},${item.value}`);
      });
      lines.push('');

      // Completed Data
      lines.push('Completed Services Daily Data');
      lines.push('Date,Completed');
      data.completed.forEach((item) => {
        lines.push(`${item.date},${item.value}`);
      });

      // Create blob and download
      const csv = lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `analytics-${period}-${Date.now()}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      showError(t('export_error'));
    }
  };

  return (
    <button
      onClick={handleExportCsv}
      className="flex items-center gap-2 rounded-lg bg-[#DDAF3B] px-4 py-2 text-sm font-black text-[#001201] transition-opacity hover:opacity-90"
      title={t('export_csv_title') || 'Export as CSV'}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8m0 0L7 7m5 0l5 7" />
      </svg>
      {t('export_button')}
    </button>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { getFromApi } from '@/services';
import { useAuth } from '@/context/auth-context';
import { AnalyticsPeriodToggle, type PeriodType } from './AnalyticsPeriodToggle';
import { AnalyticsKpiCards } from './AnalyticsKpiCards';
import { AnalyticsChartsSection } from './AnalyticsChartsSection';
import { AnalyticsExportButton } from './AnalyticsExportButton';
import { PageLoader } from '@/components/ui/PageLoader';

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

export function StationAnalytics() {
  const { isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations('station_analytics');
  const [period, setPeriod] = useState<PeriodType>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { from, to } = calculateDateRange(period);

        // Fetch all four metrics in real parallel via Promise.all
        const [
          [revSuccess, revData],
          [clientsSuccess, clientsData],
          [completedSuccess, completedData],
          [dashSuccess, dashData],
        ] = await Promise.all([
          getFromApi(`/station/analytics/revenue?from=${from}&to=${to}`),
          getFromApi(`/station/analytics/clients?from=${from}&to=${to}`),
          getFromApi(`/station/analytics/completed?from=${from}&to=${to}`),
          getFromApi('/station/dashboard'),
        ]);

        if (!mountedRef.current) return;

        if (!revSuccess || !clientsSuccess || !completedSuccess || !dashSuccess) {
          setError(t('error_loading_analytics'));
          return;
        }

        // Transform data for charts with safe number conversion
        const transformSeries = (series: Array<{ date: string; value: string }>) =>
          series.map((item) => ({ date: item.date, value: parseFloat(item.value) || 0 }));

        type SeriesResponse = { data?: { series?: Array<{ date: string; value: string }> } };
        type DashResponse = { data?: { total_revenue?: string; total_clients?: number; total_completed?: number; fill_rate_pct?: number; revenue_previous_period?: string } };

        const rev = (revData as SeriesResponse)?.data?.series ?? [];
        const clients = (clientsData as SeriesResponse)?.data?.series ?? [];
        const completed = (completedData as SeriesResponse)?.data?.series ?? [];
        const dash = (dashData as DashResponse)?.data;

        /* The dashboard endpoint returns raw totals; derive the displayed KPIs here.
         * average_revenue = total_revenue / unique_clients (guarded against div-by-zero),
         * revenue_growth  = period-over-period change vs the previous calendar month. */
        const totalRevenue = parseFloat(dash?.total_revenue ?? '0') || 0;
        const uniqueClients = dash?.total_clients ?? 0;
        const previousRevenue = parseFloat(dash?.revenue_previous_period ?? '0') || 0;
        const avgRevenue = uniqueClients > 0 ? totalRevenue / uniqueClients : 0;
        const revenueGrowth =
          previousRevenue > 0
            ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
            : totalRevenue > 0
              ? 100
              : 0;

        const analyticsData: AnalyticsData = {
          revenue: transformSeries(rev),
          clients: transformSeries(clients),
          completed: transformSeries(completed),
          kpi: {
            totalRevenue,
            avgRevenue,
            revenueGrowth,
            uniqueClients,
            completedServices: dash?.total_completed ?? 0,
            avgFillRate: dash?.fill_rate_pct ?? 0,
          },
        };

        setData(analyticsData);
      } catch {
        if (mountedRef.current) {
          setError(t('error_loading_analytics'));
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchAnalytics();
  }, [period, authLoading, t]);

  if (authLoading || isLoading) {
    return <PageLoader label={t('loading')} />;
  }

  if (error || !data) {
    return (
      <div className="flex h-96 items-center justify-center bg-[#FFF9EC] px-6 dark:bg-[#002001]">
        <div className="text-center">
          <p className="mb-4 text-sm text-foreground/65 dark:text-[#B0BFB1]">{error || t('no_data')}</p>
          <button
            onClick={() => router.refresh()}
            className="rounded-lg bg-[#DDAF3B] px-4 py-2 text-[#001201] font-black transition-opacity hover:opacity-90"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 bg-[#FFF9EC] sm:p-6 dark:bg-[#002001]">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#001201] dark:text-[#FFF9EC]">{t('title')}</h1>
          <p className="mt-1 text-sm text-foreground/65 dark:text-[#B0BFB1]">{t('subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <AnalyticsPeriodToggle value={period} onChange={setPeriod} />
          <AnalyticsExportButton data={data} period={period} />
        </div>
      </div>

      {/* KPI Cards */}
      <AnalyticsKpiCards kpi={data.kpi} />

      {/* Charts */}
      <AnalyticsChartsSection data={data} period={period} />
    </div>
  );
}

function calculateDateRange(period: PeriodType): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const from = new Date(today);

  switch (period) {
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '3m':
      from.setMonth(from.getMonth() - 3);
      break;
    case 'year':
      from.setFullYear(from.getFullYear() - 1);
      break;
    case 'custom':
      from.setDate(from.getDate() - 30);
      break;
  }

  return {
    from: from.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
  };
}

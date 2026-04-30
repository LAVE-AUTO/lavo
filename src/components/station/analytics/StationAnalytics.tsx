'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { getFromApi } from '@/services';
import { useAuth } from '@/context/auth-context';
import { AnalyticsPeriodToggle, type PeriodType } from './AnalyticsPeriodToggle';
import { AnalyticsKpiCards } from './AnalyticsKpiCards';
import { AnalyticsChartsSection } from './AnalyticsChartsSection';
import { AnalyticsSkeleton } from './AnalyticsSkeleton';
import { AnalyticsExportButton } from './AnalyticsExportButton';

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

        // Fetch all three metrics in parallel
        const [revSuccess, revData] = await getFromApi(`/station/analytics/revenue?from=${from}&to=${to}`);
        const [clientsSuccess, clientsData] = await getFromApi(`/station/analytics/clients?from=${from}&to=${to}`);
        const [completedSuccess, completedData] = await getFromApi(`/station/analytics/completed?from=${from}&to=${to}`);
        const [dashSuccess, dashData] = await getFromApi('/station/dashboard');

        if (!mountedRef.current) return;

        if (!revSuccess || !clientsSuccess || !completedSuccess || !dashSuccess) {
          setError(t('error_loading_analytics'));
          return;
        }

        // Transform data for charts with safe number conversion
        const transformSeries = (series: Array<{ date: string; value: string }>) =>
          series.map((item) => ({ date: item.date, value: parseFloat(item.value) || 0 }));

        const analyticsData: AnalyticsData = {
          revenue: transformSeries(revData?.data?.series || []),
          clients: transformSeries(clientsData?.data?.series || []),
          completed: transformSeries(completedData?.data?.series || []),
          kpi: {
            totalRevenue: parseFloat(dashData?.data?.total_revenue || '0') || 0,
            avgRevenue: parseFloat(dashData?.data?.average_revenue || '0') || 0,
            revenueGrowth: dashData?.data?.revenue_growth || 0,
            uniqueClients: dashData?.data?.total_clients || 0,
            completedServices: dashData?.data?.total_completed || 0,
            avgFillRate: dashData?.data?.avg_fill_rate || 0,
          },
        };

        setData(analyticsData);
      } catch (err) {
        if (mountedRef.current) {
          console.error('Analytics error:', err);
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
    return <AnalyticsSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex h-96 items-center justify-center bg-[#EDEDED] px-6 dark:bg-[#002001]">
        <div className="text-center">
          <p className="mb-4 text-sm text-[#666] dark:text-[#A0A090]">{error || t('no_data')}</p>
          <button
            onClick={() => router.refresh()}
            className="rounded-lg bg-[#C09A18] px-4 py-2 text-[#0C1209] font-black transition-opacity hover:opacity-90"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-[#EDEDED] dark:bg-[#002001]">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[#666] dark:text-[#A0A090]">{t('subtitle')}</p>
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

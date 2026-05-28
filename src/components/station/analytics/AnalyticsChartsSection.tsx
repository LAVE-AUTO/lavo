'use client';

import { useTranslations } from 'next-intl';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PeriodType } from './AnalyticsPeriodToggle';

interface SeriesData {
  date: string;
  value: number;
}

interface AnalyticsChartsSectionProps {
  data: {
    revenue: SeriesData[];
    clients: SeriesData[];
    completed: SeriesData[];
  };
  period: PeriodType;
}

export function AnalyticsChartsSection({ data, period }: AnalyticsChartsSectionProps) {
  const t = useTranslations('station_analytics');

  // Transform dates for display
  const transformChartData = (series: SeriesData[]) => {
    return series.map((item) => ({
      ...item,
      dateShort: formatDateShort(item.date),
    }));
  };

  const revenueData = transformChartData(data.revenue);
  const clientsData = transformChartData(data.clients);
  const completedData = transformChartData(data.completed);

  return (
    <div className="space-y-6">
      {/* Revenue Chart */}
      <div className="rounded-xl bg-[#F0EDE0] p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:bg-[#001A05]">
        <h2 className="mb-4 text-lg font-bold text-[#001201] dark:text-[#FFF9EC]">{t('chart_revenue_title')}</h2>
        {revenueData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dateShort" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value) => `$${(+(value ?? 0)).toFixed(0)}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#c09a18"
                strokeWidth={2}
                dot={{ fill: '#c09a18', r: 4 }}
                activeDot={{ r: 6 }}
                name={t('chart_revenue_label')}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-80 items-center justify-center text-foreground/65 dark:text-[#A0A090]">{t('no_data')}</div>
        )}
      </div>

      {/* Clients Chart */}
      <div className="rounded-xl bg-[#F0EDE0] p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:bg-[#001A05]">
        <h2 className="mb-4 text-lg font-bold text-[#001201] dark:text-[#FFF9EC]">{t('chart_clients_title')}</h2>
        {clientsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={clientsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dateShort" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value) => (+(value ?? 0)).toFixed(0)}
              />
              <Legend />
              <Bar dataKey="value" fill="#4E2507" radius={[8, 8, 0, 0]} name={t('chart_clients_label')} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-80 items-center justify-center text-foreground/65 dark:text-[#A0A090]">{t('no_data')}</div>
        )}
      </div>

      {/* Completed Services Chart */}
      <div className="rounded-xl bg-[#F0EDE0] p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:bg-[#001A05]">
        <h2 className="mb-4 text-lg font-bold text-[#001201] dark:text-[#FFF9EC]">{t('chart_completed_title')}</h2>
        {completedData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={completedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dateShort" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value) => (+(value ?? 0)).toFixed(0)}
              />
              <Legend />
              <Bar dataKey="value" fill="#00C851" radius={[8, 8, 0, 0]} name={t('chart_completed_label')} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-80 items-center justify-center text-foreground/65 dark:text-[#A0A090]">{t('no_data')}</div>
        )}
      </div>
    </div>
  );
}

function formatDateShort(date: string): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return date;
    }
    return d.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' });
  } catch {
    return date;
  }
}

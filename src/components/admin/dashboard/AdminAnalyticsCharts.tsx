'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getFromApi } from '@/services/axios-service';

type GroupBy = 'day' | 'week' | 'month';

interface SeriesPoint {
  date: string;
  value: number | string;
}

interface AnalyticsResponse {
  data: {
    metric: string;
    group_by: GroupBy;
    period: { from: string; to: string };
    series: SeriesPoint[];
  };
}

interface ChartConfig {
  metric: string;
  labelKey: string;
  color: string;
  isCurrency?: boolean;
}

const CHARTS: ChartConfig[] = [
  { metric: 'revenue',        labelKey: 'chart_revenue',        color: '#C49A1E', isCurrency: true },
  { metric: 'transactions',   labelKey: 'chart_transactions',   color: '#3B82F6' },
  { metric: 'registrations',  labelKey: 'chart_registrations',  color: '#10B981' },
  { metric: 'reservations',   labelKey: 'chart_reservations',   color: '#8B5CF6' },
];

const GROUP_OPTIONS: { key: GroupBy; labelKey: string }[] = [
  { key: 'day',   labelKey: 'group_day' },
  { key: 'week',  labelKey: 'group_week' },
  { key: 'month', labelKey: 'group_month' },
];

function formatLabel(date: string, groupBy: GroupBy, locale: string): string {
  try {
    const loc = locale === 'en' ? 'en-CA' : 'fr-CA';
    const d = new Date(date + 'T00:00:00');
    if (groupBy === 'month') return d.toLocaleDateString(loc, { month: 'short' });
    if (groupBy === 'week') return d.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
    return d.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  } catch { return date; }
}

function formatValue(v: number, isCurrency?: boolean): string {
  if (isCurrency) return v.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return String(v);
}

function BarChart({ series, color, groupBy, isCurrency, loading, locale }: {
  series: SeriesPoint[];
  color: string;
  groupBy: GroupBy;
  isCurrency?: boolean;
  loading: boolean;
  locale: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-5 w-5 animate-spin rounded-full border-[2px] border-current border-t-transparent" style={{ color }} />
      </div>
    );
  }

  if (series.length === 0) {
    return <p className="py-8 text-center text-[12px] text-[#AAA] dark:text-[#A0A090]">-</p>;
  }

  const values = series.map((p) => typeof p.value === 'string' ? parseFloat(p.value) : p.value);
  const max = Math.max(...values, 1);
  const total = values.reduce((s, v) => s + v, 0);

  return (
    <div>
      <div className="mb-3 text-[20px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
        {formatValue(total, isCurrency)}
      </div>
      <div className="flex items-end gap-[3px]" style={{ height: 80 }}>
        {series.map((p, i) => {
          const v = values[i];
          const h = Math.max(2, (v / max) * 100);
          return (
            <div key={p.date} className="group relative flex-1" style={{ height: '100%' }}>
              <div
                className="absolute bottom-0 w-full rounded-t-sm transition-all duration-300"
                style={{ height: `${h}%`, background: i === series.length - 1 ? color : `${color}60` }}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1A1A0A] px-2 py-1 text-[11px] font-bold text-white shadow-lg group-hover:block dark:bg-[#F0EDD4] dark:text-[#0C1209]">
                {formatLabel(p.date, groupBy, locale)}: {formatValue(v, isCurrency)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] text-[#BBBBAA] dark:text-[#A0A090]">
        <span>{formatLabel(series[0].date, groupBy, locale)}</span>
        <span>{formatLabel(series[series.length - 1].date, groupBy, locale)}</span>
      </div>
    </div>
  );
}

export function AdminAnalyticsCharts() {
  const t = useTranslations('admin_dashboard');
  const locale = useLocale();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [seriesMap, setSeriesMap] = useState<Record<string, SeriesPoint[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchAll() {
      const results: Record<string, SeriesPoint[]> = {};
      await Promise.all(
        CHARTS.map(async ({ metric }) => {
          try {
            const [ok, data] = await getFromApi(`/admin/analytics/${metric}?group_by=${groupBy}`);
            if (cancelled) return;
            if (ok) {
              results[metric] = (data as AnalyticsResponse).data?.series ?? [];
            }
          } catch {
            // keep empty for this metric
          }
        })
      );
      if (!cancelled && mountedRef.current) {
        setSeriesMap(results);
        setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [groupBy]);

  return (
    <div>
      {/* Section header with group_by toggle */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#C49A1E]">
          {t('section_analytics')}
        </span>
        <span className="h-px flex-1 bg-[#E8E4D8] dark:bg-[#1A2A14]" />
        <div className="flex gap-1">
          {GROUP_OPTIONS.map(({ key, labelKey }) => (
            <button
              key={key}
              type="button"
              onClick={() => setGroupBy(key)}
              className={[
                'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all',
                groupBy === key
                  ? 'bg-[#C49A1E]/10 text-[#C49A1E]'
                  : 'text-[#AAA] hover:text-[#666] dark:text-[#A0A090] dark:hover:text-[#A0A090]',
              ].join(' ')}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CHARTS.map(({ metric, labelKey, color, isCurrency }) => (
          <div key={metric} className="overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="text-[12px] font-black uppercase tracking-wider text-[#A0A090] dark:text-[#A0A090]">{t(labelKey)}</span>
            </div>
            <BarChart
              series={seriesMap[metric] ?? []}
              color={color}
              groupBy={groupBy}
              isCurrency={isCurrency}
              loading={loading}
              locale={locale}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

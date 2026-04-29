'use client';

import { useTranslations } from 'next-intl';

export type PeriodType = '7d' | '30d' | '3m' | 'year' | 'custom';

interface AnalyticsPeriodToggleProps {
  value: PeriodType;
  onChange: (period: PeriodType) => void;
}

export function AnalyticsPeriodToggle({ value, onChange }: AnalyticsPeriodToggleProps) {
  const t = useTranslations('station_analytics');

  const periods: Array<{ id: PeriodType; label: string }> = [
    { id: '7d', label: t('period_7d') },
    { id: '30d', label: t('period_30d') },
    { id: '3m', label: t('period_3m') },
    { id: 'year', label: t('period_year') },
  ];

  return (
    <div className="flex gap-2">
      {periods.map((period) => (
        <button
          key={period.id}
          onClick={() => onChange(period.id)}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${
            value === period.id
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

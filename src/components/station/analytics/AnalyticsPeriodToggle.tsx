'use client';

import { useTranslations } from 'next-intl';

export type PeriodType = '7d' | '30d' | '3m' | 'year' | 'custom';

const PERIODS: Array<{ id: PeriodType; label: string }> = [
  { id: '7d', label: 'period_7d' },
  { id: '30d', label: 'period_30d' },
  { id: '3m', label: 'period_3m' },
  { id: 'year', label: 'period_year' },
];

interface AnalyticsPeriodToggleProps {
  value: PeriodType;
  onChange: (period: PeriodType) => void;
}

export function AnalyticsPeriodToggle({ value, onChange }: AnalyticsPeriodToggleProps) {
  const t = useTranslations('station_analytics');

  return (
    <div className="flex gap-2">
      {PERIODS.map((period) => (
        <button
          key={period.id}
          onClick={() => onChange(period.id)}
          aria-current={value === period.id ? 'page' : undefined}
          className={`rounded-lg px-3 py-2 text-sm font-black transition-all ${
            value === period.id
              ? 'bg-[#C09A18] text-[#0C1209] shadow-md hover:opacity-90'
              : 'bg-[#F0EDE0] text-[#666] hover:bg-[#E8E4D0] dark:bg-[#182214] dark:text-[#A0A090] dark:hover:bg-[#1F3217]'
          }`}
        >
          {t(period.label as any)}
        </button>
      ))}
    </div>
  );
}

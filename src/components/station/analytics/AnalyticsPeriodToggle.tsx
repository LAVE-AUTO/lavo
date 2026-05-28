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
    <div
      role="tablist"
      aria-label={t('period_label')}
      className="inline-flex gap-1 rounded-xl border border-[#E0DCD0] bg-white p-1 dark:border-[#001A05] dark:bg-[#001201]"
    >
      {PERIODS.map((period) => {
        const active = value === period.id;
        return (
          <button
            key={period.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(period.id)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all duration-150 ${
              active
                ? 'bg-[#DDAF3B] text-[#0C1209] shadow-sm'
                : 'text-foreground/55 hover:bg-[#F7F6F2] hover:text-[#001201] dark:text-[#9A9A8A] dark:hover:bg-[#182214] dark:hover:text-[#FFF9EC]'
            }`}
          >
            {t(period.label as 'period_7d')}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';

interface AvailabilityViewToggleProps {
  value: 'month' | 'week';
  onChange: (view: 'month' | 'week') => void;
}

export function AvailabilityViewToggle({ value, onChange }: AvailabilityViewToggleProps) {
  const t = useTranslations('station_dashboard');

  return (
    <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={() => onChange('month')}
        className={`px-4 py-3 text-sm font-medium transition-colors ${
          value === 'month'
            ? 'border-b-2 border-amber-600 text-amber-600'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
        }`}
      >
        {t('availability_view_month')}
      </button>
      <button
        type="button"
        onClick={() => onChange('week')}
        className={`px-4 py-3 text-sm font-medium transition-colors ${
          value === 'week'
            ? 'border-b-2 border-amber-600 text-amber-600'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
        }`}
      >
        {t('availability_view_week')}
      </button>
    </div>
  );
}

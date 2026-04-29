'use client';

import { useTranslations } from 'next-intl';

interface BayFilterProps {
  bays: string[];
  selectedBay: string | null;
  onBayChange: (bay: string | null) => void;
}

export function BayFilter({ bays, selectedBay, onBayChange }: BayFilterProps) {
  const t = useTranslations('station_dashboard');

  return (
    <div>
      <label className="block text-sm font-medium text-slate-900 dark:text-white">{t('availability_bay_filter_label')}</label>
      <select
        value={selectedBay || ''}
        onChange={(e) => onBayChange(e.target.value || null)}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-white"
      >
        <option value="">{t('availability_bay_all')}</option>
        {bays.map((bay) => (
          <option key={bay} value={bay}>
            {t('availability_bay_label')} {bay}
          </option>
        ))}
      </select>
    </div>
  );
}

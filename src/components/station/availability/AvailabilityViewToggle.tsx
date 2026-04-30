'use client';

import { useTranslations } from 'next-intl';

interface AvailabilityViewToggleProps {
  value: 'month' | 'week';
  onChange: (view: 'month' | 'week') => void;
}

export function AvailabilityViewToggle({ value, onChange }: AvailabilityViewToggleProps) {
  const t = useTranslations('station_dashboard');

  return (
    <div className="flex gap-2 border-b border-[#C09A18]/20">
      <button
        type="button"
        onClick={() => onChange('month')}
        className={`cursor-pointer px-4 py-3 text-sm font-semibold transition-colors ${
          value === 'month'
            ? 'border-b-2 border-[#C09A18] text-[#C09A18]'
            : 'text-[#666] hover:text-[#1A1A0A] dark:text-[#A0A090] dark:hover:text-[#F0EDD4]'
        }`}
      >
        {t('availability_view_month')}
      </button>
      <button
        type="button"
        onClick={() => onChange('week')}
        className={`cursor-pointer px-4 py-3 text-sm font-semibold transition-colors ${
          value === 'week'
            ? 'border-b-2 border-[#C09A18] text-[#C09A18]'
            : 'text-[#666] hover:text-[#1A1A0A] dark:text-[#A0A090] dark:hover:text-[#F0EDD4]'
        }`}
      >
        {t('availability_view_week')}
      </button>
    </div>
  );
}

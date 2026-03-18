'use client';

import { useTranslations } from 'next-intl';
import type { StatusTab } from './types';

interface Props {
  active: StatusTab;
  counts: Record<StatusTab, number>;
  onChange: (tab: StatusTab) => void;
}

const TABS: { key: StatusTab; dot: string }[] = [
  { key: 'all',         dot: '#C49A1E' },
  { key: 'confirmed',   dot: '#3B82F6' },
  { key: 'in_progress', dot: '#00C851' },
  { key: 'completed',   dot: '#6366F1' },
  { key: 'cancelled',   dot: '#EF4444' },
  { key: 'late',        dot: '#FF8800' },
];

export function StatusTabs({ active, counts, onChange }: Props) {
  const t = useTranslations('station_reservations');

  const labelMap: Record<StatusTab, string> = {
    all: t('tab_all'),
    confirmed: t('tab_confirmed'),
    in_progress: t('tab_in_progress'),
    completed: t('tab_completed'),
    cancelled: t('tab_cancelled'),
    late: t('tab_late'),
  };

  return (
    <div className="flex gap-1 overflow-x-auto">
      {TABS.map(({ key, dot }) => {
        const isActive = active === key;
        const count = counts[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all ${
              isActive
                ? 'bg-[#1A1A0A] text-white shadow-sm dark:bg-[#F0EDD4] dark:text-[#0C1209]'
                : 'text-[#666] hover:bg-[#F0EDE4] dark:text-[#8A8A7A] dark:hover:bg-[#1A2A14]'
            }`}
          >
            {key !== 'all' && (
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: isActive ? 'currentColor' : dot, opacity: isActive ? 0.5 : 0.7 }}
              />
            )}
            {labelMap[key]}
            {count > 0 && (
              <span className={`min-w-[18px] rounded-full px-1 py-[1px] text-center text-[10px] font-bold leading-tight ${
                isActive
                  ? 'bg-white/20 text-white dark:bg-[#0C1209]/20 dark:text-[#0C1209]'
                  : 'bg-[#E8E4DC] text-[#888] dark:bg-[#243020] dark:text-[#6A6A5A]'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

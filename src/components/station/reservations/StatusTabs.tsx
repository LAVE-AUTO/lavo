'use client';

import { useTranslations } from 'next-intl';
import type { StatusTab } from './types';

interface Props {
  active: StatusTab;
  counts: Record<StatusTab, number>;
  onChange: (tab: StatusTab) => void;
}

const TABS: StatusTab[] = ['all', 'confirmed', 'in_progress', 'completed', 'cancelled', 'late'];

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
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {TABS.map((tab) => {
        const isActive = active === tab;
        const count = counts[tab];
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
              isActive
                ? 'bg-[#C49A1E] text-[#0C1209]'
                : 'bg-[#F0EDE4] text-[#666] hover:bg-[#E8E4D8] dark:bg-[#1A2A14] dark:text-[#8A8A7A] dark:hover:bg-[#243020]'
            }`}
          >
            {labelMap[tab]}
            {count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                isActive
                  ? 'bg-[#0C1209]/15 text-[#0C1209]'
                  : 'bg-[#D8D4C8] text-[#5A5A4A] dark:bg-[#243020] dark:text-[#8A8A7A]'
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

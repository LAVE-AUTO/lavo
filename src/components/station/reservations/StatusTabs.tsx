'use client';

import { useTranslations } from 'next-intl';
import type { StatusTab } from './types';

interface Props {
  active: StatusTab;
  counts: Record<StatusTab, number>;
  onChange: (tab: StatusTab) => void;
}

/* Colors aligned with graphic charter state colors */
const TABS: { key: StatusTab; dot: string }[] = [
  { key: 'all',         dot: '#C09A18' },
  { key: 'confirmed',   dot: '#0044FF' },
  { key: 'in_progress', dot: '#00C851' },
  { key: 'completed',   dot: '#0044FF' },
  { key: 'cancelled',   dot: '#FF2525' },
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
    <div className="flex gap-1.5 overflow-x-auto">
      {TABS.map(({ key, dot }) => {
        const isActive = active === key;
        const count = counts[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition-all ${
              isActive
                ? 'bg-[#C09A18] text-[#1A2116]'
                : 'text-[#000717]/60 hover:bg-[#B8B8A4]/50 dark:text-[#FFFFF0]/60 dark:hover:bg-[#243020]'
            }`}
          >
            {key !== 'all' && (
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: isActive ? '#1A2116' : dot, opacity: isActive ? 0.4 : 0.8 }}
              />
            )}
            {labelMap[key]}
            {count > 0 && (
              <span className={`min-w-[18px] rounded px-1 py-[1px] text-center text-[11px] font-bold leading-tight ${
                isActive
                  ? 'bg-[#1A2116]/15 text-[#1A2116]'
                  : 'bg-[#000C1F]/8 text-[#000717]/50 dark:bg-[#FFF8EC]/10 dark:text-foreground/50'
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

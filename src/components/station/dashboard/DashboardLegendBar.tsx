'use client';

import { useTranslations } from 'next-intl';

interface LegendItem {
  color: string;
  border?: string;
  labelKey: string;
}

export function DashboardLegendBar() {
  const t = useTranslations('station_dashboard');

  const items: LegendItem[] = [
    { color: '#888', labelKey: 'legend_done' },
    { color: '#2ECC71', labelKey: 'legend_active' },
    { color: '#3B82F6', labelKey: 'legend_confirmed' },
    { color: '#F59E0B', labelKey: 'legend_waiting' },
    { color: '#444', border: '#666', labelKey: 'legend_available' },
  ];

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#E0DCD0] bg-white px-5 py-2 dark:border-[#1A2A14] dark:bg-[#111A0E]">
      {items.map((item) => (
        <div key={item.labelKey} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#666] dark:text-[#A0A090]">
          <div
            className="rounded-[3px]"
            style={{
              width: 14,
              height: 14,
              background: item.color,
              border: item.border ? `1.5px solid ${item.border}` : undefined,
            }}
          />
          {t(item.labelKey)}
        </div>
      ))}
    </div>
  );
}

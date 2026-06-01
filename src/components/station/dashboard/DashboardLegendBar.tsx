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
    { color: '#1E40AF', labelKey: 'legend_confirmed' },
    { color: '#F59E0B', labelKey: 'legend_waiting' },
    { color: '#444', border: '#666', labelKey: 'legend_available' },
  ];

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t border-separator bg-transparent px-5 py-2 dark:border-[#1A2A14] dark:bg-dark-bg">
      {items.map((item) => (
        <div key={item.labelKey} className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground/65 dark:text-[#B0BFB1]">
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

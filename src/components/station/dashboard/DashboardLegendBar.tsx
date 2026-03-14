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
    <div
      className="flex h-9 flex-shrink-0 items-center gap-5 border-t px-5"
      style={{ background: '#111A0E', borderColor: '#1A2A14' }}
    >
      {items.map((item) => (
        <div key={item.labelKey} className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#8A8A7A' }}>
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

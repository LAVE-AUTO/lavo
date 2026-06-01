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

  /* Delay-request badge legends — mirror the icon badges drawn on agenda slots. */
  const delayLegends = [
    {
      key: 'legend_delay_pending',
      cls: 'bg-[#DDAF3B]/25 text-[#8A6D08] dark:text-[#E8C040]',
      icon: (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
      ),
    },
    {
      key: 'legend_delay_accepted',
      cls: 'bg-[#2ECC71]/20 text-[#0E8C45] dark:text-[#65E69A]',
      icon: (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
      ),
    },
    {
      key: 'legend_delay_refused',
      cls: 'bg-[#FF383C]/20 text-[#B33B1F] dark:text-[#FF8866]',
      icon: (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      ),
    },
  ];

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#FFF9EC] bg-white px-5 py-2 dark:border-[#1A2A14] dark:bg-dark-bg">
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

      <span className="hidden h-4 w-px bg-[#E0DDCC] dark:bg-[#1A2A14] sm:block" aria-hidden="true" />

      {delayLegends.map((d) => (
        <div key={d.key} className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground/65 dark:text-[#B0BFB1]">
          <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${d.cls}`}>{d.icon}</span>
          {t(d.key)}
        </div>
      ))}
    </div>
  );
}

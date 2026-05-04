'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const BREADCRUMB_MAPPING: Record<string, string> = {
  '/station/dashboard': 'nav_home',
  '/station/queue': 'nav_queue',
  '/station/reservations': 'nav_reservations',
  '/station/delays': 'nav_delays',
  '/station/analytics': 'nav_analytics',
  '/station/availability': 'nav_availability',
  '/station/formats': 'nav_formats',
  '/station/config': 'nav_config',
  '/station/history': 'nav_history',
  '/station/qr': 'nav_qr',
  '/station/support': 'nav_support',
};

export function StationBreadcrumb() {
  const pathname = usePathname();
  const t = useTranslations('station_dashboard');

  // Extract the last segment (e.g., /en/station/queue -> "queue")
  const segment = pathname.split('/').pop() || 'dashboard';

  // Find the matching breadcrumb label
  let labelKey = 'nav_home';
  for (const [path, key] of Object.entries(BREADCRUMB_MAPPING)) {
    if (pathname.includes(segment)) {
      const pathSegment = path.split('/').pop();
      if (pathSegment === segment) {
        labelKey = key;
        break;
      }
    }
  }

  const label = t(labelKey);

  return (
    <nav className="hidden md:block mb-6 px-1">
      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <span className="text-slate-900 font-semibold dark:text-white">{t('nav_home')}</span>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 font-semibold dark:text-white">{label}</span>
      </div>
    </nav>
  );
}

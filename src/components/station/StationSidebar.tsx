'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
}

const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const QueueIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const ReservationsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const FormatsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
  </svg>
);

const ConfigIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const SupportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export function StationSidebar() {
  const t = useTranslations('station_dashboard');
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { href: '/station/dashboard', labelKey: 'nav_home', icon: <HomeIcon /> },
    { href: '/station/queue', labelKey: 'nav_queue', icon: <QueueIcon /> },
    { href: '/station/reservations', labelKey: 'nav_reservations', icon: <ReservationsIcon /> },
    { href: '/station/formats', labelKey: 'nav_formats', icon: <FormatsIcon /> },
    { href: '/station/config', labelKey: 'nav_config', icon: <ConfigIcon /> },
    { href: '/station/history', labelKey: 'nav_history', icon: <HistoryIcon /> },
    { href: '/station/support', labelKey: 'nav_support', icon: <SupportIcon /> },
  ];

  return (
    <aside
      className="flex w-[180px] flex-shrink-0 flex-col gap-1.5 border-r p-3"
      style={{ background: '#111A0E', borderColor: '#1A2A14' }}
    >
      {navItems.map((item) => {
        const isActive = pathname.includes(item.href);
        return (
          <Link
            key={item.href}
            href={item.href as Parameters<typeof Link>[0]['href']}
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all duration-150"
            style={{
              background: isActive ? '#C49A1E' : 'transparent',
              color: isActive ? '#0C1209' : '#8A8A7A',
            }}
          >
            {item.icon}
            {t(item.labelKey)}
          </Link>
        );
      })}
    </aside>
  );
}

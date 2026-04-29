'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/auth-context';
import { SidebarSection } from './SidebarSection';

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

const QrIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" />
    <rect x="2" y="14" width="8" height="8" rx="1" /><path d="M14 14h3v3h-3zM20 14v3h-3M14 20h3M20 20h0" />
  </svg>
);

const DelaysIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    <path d="M16 19l-4-2-4 2" />
  </svg>
);

const SupportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 17" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const AvailabilityIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export function StationSidebar() {
  const t = useTranslations('station_dashboard');
  const pathname = usePathname();
  const { logout } = useAuth();

  const operationsItems: NavItem[] = [
    { href: '/station/queue', labelKey: 'nav_queue', icon: <QueueIcon /> },
    { href: '/station/reservations', labelKey: 'nav_reservations', icon: <ReservationsIcon /> },
    { href: '/station/delays', labelKey: 'nav_delays', icon: <DelaysIcon /> },
    { href: '/station/analytics', labelKey: 'nav_analytics', icon: <AnalyticsIcon /> },
  ];

  const configurationItems: NavItem[] = [
    { href: '/station/formats', labelKey: 'nav_formats', icon: <FormatsIcon /> },
    { href: '/station/availability', labelKey: 'nav_availability', icon: <AvailabilityIcon /> },
    { href: '/station/config', labelKey: 'nav_config', icon: <ConfigIcon /> },
  ];

  const supportItems: NavItem[] = [
    { href: '/station/history', labelKey: 'nav_history', icon: <HistoryIcon /> },
    { href: '/station/qr', labelKey: 'nav_qr', icon: <QrIcon /> },
    { href: '/station/support', labelKey: 'nav_support', icon: <SupportIcon /> },
  ];

  const linkBase = 'flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors duration-150';
  const linkActive = `${linkBase} bg-[#C49A1E] text-[#0C1209]`;
  const linkIdle = `${linkBase} text-[#666] hover:bg-[#E8E4D8] dark:text-[#A0A090] dark:hover:bg-[#182214]`;

  const renderNavLink = (item: NavItem) => {
    const isActive = pathname.includes(item.href);
    return (
      <Link
        key={item.href}
        href={item.href as Parameters<typeof Link>[0]['href']}
        className={isActive ? linkActive : linkIdle}
      >
        {item.icon}
        {t(item.labelKey)}
      </Link>
    );
  };

  return (
    <aside className="flex w-[180px] flex-shrink-0 flex-col border-r border-[#E0DCD0] bg-[#F0EDE0] p-3 dark:border-[#1A2A14] dark:bg-[#111A0E]">
      {/* Home link — always visible */}
      <Link
        href="/station/dashboard"
        className={pathname.includes('/station/dashboard') && !pathname.includes('/station/queue') ? linkActive : linkIdle}
      >
        <HomeIcon />
        {t('nav_home')}
      </Link>

      {/* Navigation sections */}
      <nav className="mt-4 flex flex-col gap-3">
        {/* Opérations Section */}
        <SidebarSection title={t('nav_section_operations')} defaultOpen>
          <div className="flex flex-col gap-1">
            {operationsItems.map(renderNavLink)}
          </div>
        </SidebarSection>

        {/* Configuration Section */}
        <SidebarSection title={t('nav_section_configuration')} defaultOpen>
          <div className="flex flex-col gap-1">
            {configurationItems.map(renderNavLink)}
          </div>
        </SidebarSection>

        {/* Support & History Section */}
        <SidebarSection title={t('nav_section_support')} defaultOpen>
          <div className="flex flex-col gap-1">
            {supportItems.map(renderNavLink)}
          </div>
        </SidebarSection>
      </nav>

      {/* Logout — pushed to bottom */}
      <div className="mt-auto pt-3">
        <div className="mb-3 h-px bg-[#E0DCD0] dark:bg-[#1A2A14]" />
        <button
          type="button"
          onClick={() => logout()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-[#888] transition-colors duration-150 hover:bg-[#FEF2F2] hover:text-[#EF4444] dark:text-[#9A9A8A] dark:hover:bg-[#2A0A0A] dark:hover:text-[#FF8A80]"
        >
          <LogoutIcon />
          {t('nav_logout')}
        </button>
      </div>
    </aside>
  );
}

'use client';

import { useState, useEffect } from 'react';
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

const COLLAPSE_STORAGE_KEY = 'Hurryline_station_sidebar_collapsed';

const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const QueueIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const ReservationsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const FormatsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
  </svg>
);

const ConfigIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

// History icon kept for when the History link is restored (see supportItems below).
// const HistoryIcon = () => (
//   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
//     <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
//   </svg>
// );

const QrIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" />
    <rect x="2" y="14" width="8" height="8" rx="1" /><path d="M14 14h3v3h-3zM20 14v3h-3M14 20h3M20 20h0" />
  </svg>
);

const DelaysIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    <path d="M16 19l-4-2-4 2" />
  </svg>
);

const SupportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 17" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const AvailabilityIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const CollapseIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
    aria-hidden="true"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function StationSidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const t = useTranslations('station_dashboard');
  const pathname = usePathname();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Restore persisted collapse state (avoids SSR hydration mismatch via lazy read in effect)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (saved === '1') setCollapsed(true);
    } catch {
      // localStorage unavailable - stay expanded
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Operations: things merchants do every day
  const operationsItems: NavItem[] = [
    { href: '/station/queue', labelKey: 'nav_queue', icon: <QueueIcon /> },
    { href: '/station/reservations', labelKey: 'nav_reservations', icon: <ReservationsIcon /> },
    { href: '/station/delays', labelKey: 'nav_delays', icon: <DelaysIcon /> },
    { href: '/station/analytics', labelKey: 'nav_analytics', icon: <AnalyticsIcon /> },
  ];

  // Configuration: setup tasks done occasionally
  const configurationItems: NavItem[] = [
    { href: '/station/formats', labelKey: 'nav_formats', icon: <FormatsIcon /> },
    { href: '/station/availability', labelKey: 'nav_availability', icon: <AvailabilityIcon /> },
    { href: '/station/qr', labelKey: 'nav_qr', icon: <QrIcon /> },
    { href: '/station/config', labelKey: 'nav_config', icon: <ConfigIcon /> },
  ];

  // Support & history: reference / help
  const supportItems: NavItem[] = [
    // History link temporarily hidden per product request.
    // { href: '/station/history', labelKey: 'nav_history', icon: <HistoryIcon /> },
    { href: '/station/support', labelKey: 'nav_support', icon: <SupportIcon /> },
  ];

  const isActive = (href: string) => pathname.includes(href);

  function NavLink({ item }: { item: NavItem }) {
    const active = isActive(item.href);
    const label = t(item.labelKey);
    const baseClass =
      'group relative flex items-center rounded-lg text-[13px] font-semibold transition-colors duration-150';
    const activeClass = 'bg-[#DDAF3B] text-[#001201] shadow-sm';
    const idleClass = 'text-[#5A5A4A] hover:bg-[#EDE5C8] dark:text-[#B0BFB1] dark:hover:bg-[#182214]';
    const layoutClass = collapsed
      ? 'h-10 w-10 justify-center'
      : 'gap-2.5 px-3 py-2.5';
    return (
      <Link
        key={item.href}
        href={item.href as Parameters<typeof Link>[0]['href']}
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
        className={`${baseClass} ${layoutClass} ${active ? activeClass : idleClass}`}
        onClick={onMobileClose}
      >
        {item.icon}
        {!collapsed && <span className="truncate">{label}</span>}
        {collapsed && (
          <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-dark-bg px-2.5 py-1 text-[12px] font-semibold text-[#FFF9EC] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
            {label}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside
      className={[
        // Base layout
        'flex shrink-0 flex-col border-r border-separator bg-sidebar-bg p-3',
        'dark:border-[#1A2A14] dark:bg-dark-bg',
        // Width based on collapsed state
        collapsed ? 'w-[72px]' : 'w-[220px]',
        // Mobile: fixed drawer that slides in from the left
        'fixed inset-y-0 left-0 z-40',
        'transition-transform duration-200 ease-in-out',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: static sidebar (always visible, reset transform, animate width only)
        'md:static md:z-auto md:translate-x-0 md:transition-[width] md:duration-200',
      ].join(' ')}
    >
      {/* Collapse toggle */}
      <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'} mb-3`}>
        <button
          type="button"
          aria-label={collapsed ? t('nav_expand') : t('nav_collapse')}
          aria-pressed={collapsed}
          onClick={toggleCollapsed}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/55 transition-colors hover:bg-[#EDE5C8] hover:text-[#001201] dark:text-[#B0BFB1] dark:hover:bg-[#182214] dark:hover:text-[#FFF9EC]"
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </div>

      {/* Home - always at the top */}
      <NavLink item={{ href: '/station/dashboard', labelKey: 'nav_home', icon: <HomeIcon /> }} />

      {/* Sections */}
      <nav className={`mt-4 flex flex-col ${collapsed ? 'gap-2' : 'gap-3'}`}>
        <SidebarSection title={t('nav_section_operations')} defaultOpen collapsed={collapsed}>
          {operationsItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </SidebarSection>

        <SidebarSection title={t('nav_section_configuration')} defaultOpen collapsed={collapsed}>
          {configurationItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </SidebarSection>

        <SidebarSection title={t('nav_section_support')} defaultOpen collapsed={collapsed}>
          {supportItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </SidebarSection>
      </nav>

      {/* Logout */}
      <div className="mt-auto pt-3">
        <div className="mb-3 h-px bg-separator dark:bg-[#1A2A14]" />
        <button
          type="button"
          onClick={() => { onMobileClose?.(); logout(); }}
          title={collapsed ? t('nav_logout') : undefined}
          aria-label={collapsed ? t('nav_logout') : undefined}
          className={`group relative flex items-center rounded-lg text-[13px] font-semibold text-foreground/55 transition-colors duration-150 hover:bg-[#FEF2F2] hover:text-[#EF4444] dark:text-[#FF383C] dark:hover:bg-[#2A0A0A] dark:hover:text-[#FF383C] ${
            collapsed ? 'h-10 w-10 justify-center' : 'w-full gap-2.5 px-3 py-2.5'
          }`}
        >
          <LogoutIcon />
          {!collapsed && <span>{t('nav_logout')}</span>}
          {collapsed && (
            <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-dark-bg px-2.5 py-1 text-[12px] font-semibold text-[#FF383C] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              {t('nav_logout')}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}

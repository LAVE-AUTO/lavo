'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/auth-context';
import { SidebarSection } from '@/components/station/SidebarSection';

interface NavItem { href: string; labelKey: string; icon: React.ReactNode }

const COLLAPSE_STORAGE_KEY = 'Hurryline_admin_sidebar_collapsed';

const DashboardIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;
const StationsIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>;
const ClientsIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>;
const DisputesIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
const CommissionIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>;
const SettingsIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>;
const TransactionsIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
const LogsIcon     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>;
const SupportIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
const RatingsIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
const LegalIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
const ProfileIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const LogoutIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
const CollapseIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

interface AdminSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ open = false, onClose }: AdminSidebarProps) {
  const t       = useTranslations('admin_dashboard');
  const pathname = usePathname();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1') setCollapsed(true);
    } catch {
      // ignore
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

  const operationsItems: NavItem[] = [
    { href: '/admin/dashboard', labelKey: 'nav_dashboard', icon: <DashboardIcon /> },
    { href: '/admin/stations', labelKey: 'nav_kyc', icon: <StationsIcon /> },
    { href: '/admin/disputes', labelKey: 'nav_disputes', icon: <DisputesIcon /> },
  ];

  const configurationItems: NavItem[] = [
    { href: '/admin/clients', labelKey: 'nav_clients', icon: <ClientsIcon /> },
    { href: '/admin/commission', labelKey: 'nav_commission', icon: <CommissionIcon /> },
    { href: '/admin/platform-settings', labelKey: 'nav_settings', icon: <SettingsIcon /> },
  ];

  const supportItems: NavItem[] = [
    { href: '/admin/transactions', labelKey: 'nav_transactions', icon: <TransactionsIcon /> },
    { href: '/admin/logs', labelKey: 'nav_logs', icon: <LogsIcon /> },
    { href: '/admin/ratings', labelKey: 'nav_ratings', icon: <RatingsIcon /> },
    { href: '/admin/support', labelKey: 'nav_support', icon: <SupportIcon /> },
    { href: '/admin/legal-content', labelKey: 'nav_legal_content', icon: <LegalIcon /> },
  ];

  const base = 'group relative flex items-center rounded-lg text-[13px] font-semibold transition-colors duration-150';
  const active = 'bg-[#DDAF3B] text-[#001201] shadow-sm';
  const idle = 'text-[#5A5A4A] hover:bg-[#FFF9EC] dark:text-[#B0BFB1] dark:hover:bg-[#182214]';
  const layoutClass = collapsed ? 'h-10 w-10 justify-center' : 'gap-2.5 px-3 py-2.5';

  /* Close mobile sidebar on Escape */
  useEffect(() => {
    if (!open || !onClose) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const sidebarContent = (
    <>
      <div className={`mb-3 flex ${collapsed ? 'justify-center px-0' : 'justify-end px-1'} pt-1`}>
        <button
          type="button"
          aria-label={collapsed ? t('nav_expand') : t('nav_collapse')}
          aria-pressed={collapsed}
          onClick={toggleCollapsed}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/55 transition-colors hover:bg-[#FFF9EC] hover:text-[#001201] dark:text-[#B0BFB1] dark:hover:bg-[#182214] dark:hover:text-[#FFF9EC]"
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </div>

      {/* Brand */}
      <div className="mb-4 px-3 pt-1">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#DDAF3B]">Administration</span>
      </div>

      <nav className={`flex flex-col ${collapsed ? 'gap-2' : 'gap-3'}`}>
        <SidebarSection title={t('nav_section_operations')} defaultOpen collapsed={collapsed}>
          {operationsItems.map((item) => (
            <Link
              key={item.href}
              href={item.href as Parameters<typeof Link>[0]['href']}
              title={collapsed ? t(item.labelKey) : undefined}
              aria-label={collapsed ? t(item.labelKey) : undefined}
              className={`${base} ${layoutClass} ${pathname.includes(item.href) ? active : idle}`}
              onClick={onClose}
            >
              {item.icon}
              {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
            </Link>
          ))}
        </SidebarSection>

        <SidebarSection title={t('nav_section_configuration')} defaultOpen collapsed={collapsed}>
          {configurationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href as Parameters<typeof Link>[0]['href']}
              title={collapsed ? t(item.labelKey) : undefined}
              aria-label={collapsed ? t(item.labelKey) : undefined}
              className={`${base} ${layoutClass} ${pathname.includes(item.href) ? active : idle}`}
              onClick={onClose}
            >
              {item.icon}
              {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
            </Link>
          ))}
        </SidebarSection>

        <SidebarSection title={t('nav_section_support')} defaultOpen collapsed={collapsed}>
          {supportItems.map((item) => (
            <Link
              key={item.href}
              href={item.href as Parameters<typeof Link>[0]['href']}
              title={collapsed ? t(item.labelKey) : undefined}
              aria-label={collapsed ? t(item.labelKey) : undefined}
              className={`${base} ${layoutClass} ${pathname.includes(item.href) ? active : idle}`}
              onClick={onClose}
            >
              {item.icon}
              {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
            </Link>
          ))}
        </SidebarSection>
      </nav>

      <div className="mt-auto pt-3">
        <div className="mb-3 h-px bg-[#FFF9EC] dark:bg-[#1A2A14]" />

        {/* Profile link */}
        <Link
          href={'/admin/profile' as Parameters<typeof Link>[0]['href']}
          title={collapsed ? t('nav_profile') : undefined}
          aria-label={collapsed ? t('nav_profile') : undefined}
          onClick={onClose}
          className={`group relative mb-1 flex items-center rounded-lg text-[13px] font-semibold transition-colors duration-150 ${base} ${layoutClass} ${pathname.includes('/admin/profile') ? active : idle}`}
        >
          <ProfileIcon />
          {!collapsed && <span className="truncate">{t('nav_profile')}</span>}
          {collapsed && (
            <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#001201] px-2.5 py-1 text-[12px] font-semibold text-[#FFF9EC] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              {t('nav_profile')}
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={() => logout()}
          title={collapsed ? t('nav_logout') : undefined}
          aria-label={collapsed ? t('nav_logout') : undefined}
          className={`group relative flex items-center rounded-lg text-[13px] font-semibold text-foreground/55 transition-colors duration-150 hover:bg-[#FEF2F2] hover:text-[#EF4444] dark:text-[#B0BFB1] dark:hover:bg-[#2A0A0A] dark:hover:text-[#FF8A80] ${collapsed ? 'h-10 w-10 justify-center' : 'w-full gap-2.5 px-3 py-2.5'}`}
        >
          <LogoutIcon />
          {!collapsed && <span>{t('nav_logout')}</span>}
          {collapsed && (
            <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#001201] px-2.5 py-1 text-[12px] font-semibold text-[#FFF9EC] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              {t('nav_logout')}
            </span>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar - always visible at lg+ */}
      <aside className={`hidden lg:flex shrink-0 flex-col border-r border-[#FFF9EC] bg-[#FFF9EC] p-3 transition-all duration-200 dark:border-[#1A2A14] dark:bg-[#111A0E] ${collapsed ? 'w-[72px]' : 'w-[220px]'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile/tablet overlay sidebar - below lg */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
          <aside
            className="relative flex h-full w-[220px] shrink-0 flex-col border-r border-[#FFF9EC] bg-[#FFF9EC] p-3 shadow-xl animate-fade-in dark:border-[#1A2A14] dark:bg-[#111A0E]"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

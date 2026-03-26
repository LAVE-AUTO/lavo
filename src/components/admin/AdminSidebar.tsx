'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/auth-context';

interface NavItem { href: string; labelKey: string; icon: React.ReactNode }

const DashboardIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;
const StationsIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>;
const ClientsIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>;
const DisputesIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
const CommissionIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>;
const SettingsIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>;
const TransactionsIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
const LogsIcon     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>;
const SupportIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
const LegalIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
const LogoutIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;

export function AdminSidebar() {
  const t       = useTranslations('admin_dashboard');
  const pathname = usePathname();
  const { logout } = useAuth();

  const navItems: NavItem[] = [
    { href: '/admin/dashboard',         labelKey: 'nav_dashboard',     icon: <DashboardIcon /> },
    { href: '/admin/stations',          labelKey: 'nav_kyc',           icon: <StationsIcon /> },
    { href: '/admin/clients',           labelKey: 'nav_clients',       icon: <ClientsIcon /> },
    { href: '/admin/disputes',          labelKey: 'nav_disputes',      icon: <DisputesIcon /> },
    { href: '/admin/commission',        labelKey: 'nav_commission',    icon: <CommissionIcon /> },
    { href: '/admin/platform-settings', labelKey: 'nav_settings',      icon: <SettingsIcon /> },
    { href: '/admin/transactions',      labelKey: 'nav_transactions',  icon: <TransactionsIcon /> },
    { href: '/admin/logs',              labelKey: 'nav_logs',          icon: <LogsIcon /> },
    { href: '/admin/support',           labelKey: 'nav_support',       icon: <SupportIcon /> },
    { href: '/admin/legal-content',     labelKey: 'nav_legal_content', icon: <LegalIcon /> },
  ];

  const base   = 'flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors duration-150';
  const active = `${base} bg-[#C49A1E] text-[#0C1209]`;
  const idle   = `${base} text-[#666] hover:bg-[#E8E4D8] dark:text-[#8A8A7A] dark:hover:bg-[#182214]`;

  return (
    <aside className="flex w-[190px] shrink-0 flex-col border-r border-[#E0DCD0] bg-[#F0EDE0] p-3 dark:border-[#1A2A14] dark:bg-[#111A0E]">
      {/* Brand */}
      <div className="mb-4 px-3 pt-1">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C49A1E]">Administration</span>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href as Parameters<typeof Link>[0]['href']}
            className={pathname.includes(item.href) ? active : idle}
          >
            {item.icon}
            {t(item.labelKey)}
          </Link>
        ))}
      </nav>

      <div className="mt-auto pt-3">
        <div className="mb-3 h-px bg-[#E0DCD0] dark:bg-[#1A2A14]" />
        <button
          type="button"
          onClick={() => logout()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-[#888] transition-colors hover:bg-[#FEF2F2] hover:text-[#EF4444] dark:text-[#6A6A5A] dark:hover:bg-[#2A0A0A] dark:hover:text-[#FF8A80]"
        >
          <LogoutIcon />
          {t('nav_logout')}
        </button>
      </div>
    </aside>
  );
}

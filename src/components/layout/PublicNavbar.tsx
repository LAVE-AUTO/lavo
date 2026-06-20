'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';
import { ShareMenu } from '@/components/layout/ShareMenu';
import { useTheme } from '@/context/theme-context';
import { useAuth } from '@/context';
import { deleteWithApi, getFromApi, patchWithApi } from '@/services/axios-service';

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

type PublicNavbarProps = {
  /** Whether to render the top spacer that pushes content below the fixed header. */
  withTopSpacer?: boolean;
  /**
   * Extra spacer used to ensure scrollable content isn't hidden behind the
   * fixed BottomNav on mobile. Defaults to true for backwards compatibility.
   */
  withMobileScrollSpacer?: boolean;
};

/**
 * Sticky public navbar.
 * Authenticated users see avatar + name; clicking opens a dropdown with
 * profile info and a logout button.
 */
export function PublicNavbar({
  withTopSpacer = true,
  withMobileScrollSpacer = true,
}: PublicNavbarProps) {
  const t        = useTranslations('nav');
  const tn       = useTranslations('station_dashboard');
  const locale   = useLocale();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const isDark   = resolvedTheme === 'dark';
  const { user, isAuthenticated, isLoading, logout, isClient, isStation, isSuperAdmin } = useAuth();

  const [menuOpen,     setMenuOpen]     = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifItems, setNotifItems] = useState<UserNotification[]>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  /* Close drawer on navigation */
  useEffect(() => {
    const id = setTimeout(() => setMenuOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  /* Close drawer on Escape */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [menuOpen]);

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  useEffect(() => {
    if (!isAuthenticated || !isClient) return;
    (async () => {
      const [ok, data] = await getFromApi<{ data?: { unread_count: number } }>('/me/notifications/unread-count');
      if (!ok || !data || typeof data !== 'object' || !('data' in data)) return;
      setNotifUnreadCount(data.data?.unread_count ?? 0);
    })();
  }, [isAuthenticated, isClient]);

  async function refreshNotifUnread() {
    const [ok, data] = await getFromApi<{ data?: { unread_count: number } }>('/me/notifications/unread-count');
    if (!ok || !data || typeof data !== 'object' || !('data' in data)) return;
    setNotifUnreadCount(data.data?.unread_count ?? 0);
  }

  async function toggleNotifications() {
    const nextOpen = !notifOpen;
    setNotifOpen(nextOpen);
    if (!nextOpen) return;
    setNotifLoading(true);
    const [ok, data] = await getFromApi<{ data?: { items: UserNotification[]; unread_count: number } }>('/me/notifications?limit=20');
    if (ok && data && typeof data === 'object' && 'data' in data) {
      setNotifItems(data.data?.items ?? []);
      setNotifUnreadCount(data.data?.unread_count ?? 0);
      /* Opening the panel marks everything as read. */
      if ((data.data?.unread_count ?? 0) > 0) void markAllNotifRead();
    }
    setNotifLoading(false);
  }

  async function markNotifRead(id: string) {
    const [ok] = await patchWithApi(`/me/notifications/${id}/read`, {});
    if (!ok) return;
    setNotifItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    void refreshNotifUnread();
  }

  async function markAllNotifRead() {
    const [ok] = await patchWithApi('/me/notifications/read-all', {});
    if (!ok) return;
    setNotifItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setNotifUnreadCount(0);
  }

  async function deleteNotif(id: string) {
    const [ok] = await deleteWithApi(`/me/notifications/${id}`);
    if (!ok) return;
    setNotifItems((prev) => prev.filter((item) => item.id !== id));
    void refreshNotifUnread();
  }

  const notifPanelStyle = {
    backgroundColor: isDark ? '#001201' : '#FFF9EC',
    color: isDark ? '#FFF9EC' : '#001A05',
  } as const;

  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';
  const darkLogoSrc = locale === 'fr' ? '/logo/logo_anglais_2.png' : '/logo/logo_anglais_2.png';

  const displayName = user
    ? (user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user.email.split('@')[0])
    : '';

  const initial = user ? (user.first_name?.[0] ?? user.email[0]).toUpperCase() : '';

  /* Logo always goes to the landing page regardless of auth state */
  const logoHref = '/' as const;

  /* Nav links shown to logged-in users (desktop). */
  const authNavLinks = isClient
    ? [
        { href: '/stations',             label: t('stations') },
        { href: '/client/reservations',  label: t('reservations') },
        { href: '/favorites',            label: t('favorites') },
      ]
    : isStation
    ? [
        { href: '/station/dashboard',    label: t('dashboard') },
        { href: '/station/queue',        label: t('queue') },
        { href: '/station/config',       label: t('config') },
      ]
    : isSuperAdmin
    ? [
        { href: '/admin',                label: t('dashboard') },
        { href: '/admin/stations',       label: t('stations') },
        { href: '/admin/clients',        label: t('clients') },
      ]
    : [];

  const linkClass =
    'text-[13px] font-medium tracking-[0.4px] text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] transition-colors duration-300';

  const pillClass =
    'inline-block border rounded-md border-[rgba(221,175,59,0.45)] text-[#DDAF3B] px-[22px] py-[9px] text-[13px] font-semibold tracking-[0.8px] uppercase transition-all duration-300 hover:bg-[#DDAF3B] hover:text-[#001201]';

  const ctaClass =
    'btn-shine inline-block bg-[#DDAF3B] rounded-md text-[#001201] px-[26px] py-[10px] text-[13px] font-bold tracking-[1px] uppercase transition-all duration-300 hover:bg-[#DDAF3B] hover:-translate-y-px hover:shadow-[0_6px_24px_rgba(221,175,59,0.4)]';

  const drawerLinkClass =
    'flex items-center px-4 py-3 text-[15px] font-medium text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] transition-colors';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#FFF9EC] dark:bg-dark-bg backdrop-blur-[16px] border-b border-[rgba(221,175,59,0.18)]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16 flex items-center justify-between gap-6 py-2">

          {/* Logo */}
          <Link href={logoHref} className="shrink-0" aria-label={t('logo_home_aria')} suppressHydrationWarning>
            <Image
              src={isDark ? darkLogoSrc : lightLogoSrc}
              alt={t('logo_alt')}
              width={130}
              height={34}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-8" aria-label="Navigation principale">
            {isAuthenticated
              ? authNavLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href as Parameters<typeof Link>[0]['href']}
                    className={`${linkClass}${pathname.startsWith(href) ? ' !text-[#DDAF3B]' : ''}`}
                  >
                    {label}
                  </Link>
                ))
              : (
                <>
                  <a href={`/${locale}/#how-it-works`} className={linkClass}>{t('how_it_works')}</a>
                  <Link
                    href="/stations"
                    className={`${linkClass}${pathname.startsWith('/stations') ? ' !text-[#DDAF3B]' : ''}`}
                  >
                    {t('stations')}
                  </Link>
                  <a href={`/${locale}/#notifications`} className={linkClass}>{t('reminders')}</a>
                  <a href={`/${locale}/#faq`} className={linkClass}>{t('faq')}</a>
                </>
              )
            }
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <LangToggle />

            {/* Share (desktop) */}
            <div className="hidden lg:block">
              <ShareMenu />
            </div>

            {/* Desktop actions */}
            <div className="hidden lg:flex items-center gap-2.5 ml-1">
              {((isAuthenticated && user) || (isLoading && user)) ? (
                <>
                {isClient && (
                  <div ref={notifRef} className="relative">
                    <button
                      type="button"
                      aria-label={tn('notif_tooltip')}
                      title={tn('notif_tooltip')}
                      onClick={toggleNotifications}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#FFF9EC] text-[var(--foreground)] transition-colors relative hover:border-[#DDAF3B] hover:text-[#DDAF3B] dark:text-[#B0BFB1]"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      {notifUnreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] rounded-full bg-Hurryline-error px-1 text-center text-[10px] font-black leading-[18px] text-white shadow-sm ring-2 ring-white dark:ring-dark-bg">
                          {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
                        </span>
                      )}
                    </button>
                    {notifOpen && (
                      <div
                        className="absolute right-0 top-[calc(100%+10px)] z-50 w-96 rounded-xl p-3 shadow-xl opacity-100 backdrop-blur-0"
                        style={notifPanelStyle}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-sm font-semibold" style={{ color: isDark ? '#FFF9EC' : '#001A05' }}>{tn('notif_title')}</div>
                          <button
                            type="button"
                            onClick={markAllNotifRead}
                            className="text-xs font-semibold hover:underline"
                            style={{ color: isDark ? '#DDAF3B' : '#DDAF3B' }}
                          >
                            {tn('notif_mark_all_read')}
                          </button>
                        </div>
                        {notifLoading ? <div className="py-4 text-sm" style={{ color: isDark ? '#B0BFB1' : '#B0BFB1' }}>{tn('notif_loading')}</div> : null}
                        {!notifLoading && notifItems.length === 0 ? <div className="py-4 text-sm" style={{ color: isDark ? '#B0BFB1' : '#B0BFB1' }}>{tn('notif_empty')}</div> : null}
                        {!notifLoading && notifItems.length > 0 ? (
                          <div className="max-h-96 space-y-2 overflow-auto">
                            {notifItems.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-lg p-2"
                                style={{
                                  backgroundColor: isDark
                                    ? (item.is_read ? '#001A05' : '#001A05')
                                    : (item.is_read ? '#FFF9EC' : '#FFEECA'),
                                }}
                              >
                                <div className="text-xs font-semibold" style={{ color: isDark ? '#FFF9EC' : '#001A05' }}>{item.title ?? tn('notif_default_title')}</div>
                                <div className="mt-0.5 text-xs" style={{ color: isDark ? '#B0BFB1' : '#B0BFB1' }}>{item.body ?? '-'}</div>
                                <div className="mt-2 flex items-center gap-3">
                                  {!item.is_read && (
                                    <button
                                      type="button"
                                      onClick={() => markNotifRead(item.id)}
                                      className="text-xs font-semibold hover:underline"
                                      style={{ color: isDark ? '#8ED17C' : '#001A05' }}
                                    >
                                      {tn('notif_mark_read')}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => deleteNotif(item.id)}
                                    className="text-xs font-semibold hover:underline"
                                    style={{ color: isDark ? '#FF383C' : '#FF383C' }}
                                  >
                                    {tn('notif_delete')}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
                {/* Authenticated - avatar + name trigger + dropdown */}
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="flex items-center gap-2 group cursor-pointer"
                    aria-label={t('user_menu_aria')}
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                  >
                    <div className="w-[34px] h-[34px] rounded-full bg-[rgba(221,175,59,0.2)] border border-[rgba(221,175,59,0.4)] flex items-center justify-center shrink-0 group-hover:border-[#DDAF3B] transition-colors">
                      <span className="text-[13px] font-black text-[#DDAF3B] leading-none">{initial}</span>
                    </div>
                    <span className="text-[13px] font-semibold text-[var(--foreground)] dark:text-[#B0BFB1] group-hover:text-[#DDAF3B] dark:group-hover:text-[#DDAF3B] transition-colors max-w-[110px] truncate">
                      {displayName}
                    </span>
                    <svg
                      width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      className={`text-[#B0BFB1] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Dropdown panel */}
                  {dropdownOpen && (
                    <div className="absolute top-[calc(100%+10px)] right-0 z-50 w-[230px] overflow-hidden rounded-[6px] border border-[rgba(221,175,59,0.2)] bg-[#FFEECA] shadow-[0_16px_48px_rgba(0,0,0,0.2)] animate-fade-in dark:bg-dark-bg">
                      {/* Profile info */}
                      <div className="px-4 py-3.5 border-b border-[rgba(221,175,59,0.12)]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[rgba(221,175,59,0.2)] border border-[rgba(221,175,59,0.4)] flex items-center justify-center shrink-0">
                            <span className="text-[14px] font-black text-[#DDAF3B] leading-none">{initial}</span>
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[13px] font-bold text-[#001201] dark:text-[#FFEECA] truncate leading-tight">
                              {displayName}
                            </p>
                            <p className="text-[11px] text-[#B0BFB1] truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Profile link - clients only. Stations and admins have
                          no client profile page, so they see logout alone. */}
                      {isClient && (
                        <Link
                          href="/profile"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-[13px] font-semibold text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] hover:bg-[rgba(221,175,59,0.05)] transition-colors"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          {t('profile')}
                        </Link>
                      )}

                      {/* Logout */}
                      <button
                        type="button"
                        onClick={() => { logout(); setDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-semibold text-[#FF383C] hover:bg-[rgba(232,71,42,0.07)] transition-colors border-t border-[rgba(221,175,59,0.12)]"
                      >
                        <LogoutIcon />
                        {t('logout')}
                      </button>
                    </div>
                  )}
                </div>
                </>
              ) : (
                /* Not authenticated: merchant pill + login + register */
                <>
                  <Link href="/merchant" className={pillClass}>
                    {t('merchant_pill')}
                  </Link>
                  <Link
                    href="/login"
                    className="text-[13px] font-medium tracking-[0.4px] text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] transition-colors px-2"
                  >
                    {t('login')}
                  </Link>
                  <Link href="/register" className={ctaClass}>
                    {t('register')}
                  </Link>
                </>
              )}
            </div>

            {/* Hamburger - mobile + tablet. Mobile BottomNav covers primary nav but lacks
               the merchant/login/register actions, so the drawer provides them here. */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex lg:hidden w-9 h-9 items-center justify-center text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] transition-colors"
              aria-label={menuOpen ? t('menu_close_aria') : t('menu_open_aria')}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {/* Tablet drawer */}
        {menuOpen && (
          <div className="lg:hidden bg-[rgba(247,243,236,0.98)] dark:bg-[rgba(13,31,15,0.98)] border-t border-[rgba(221,175,59,0.18)] px-6 py-5 space-y-1 animate-fade-in">
            <a href={`/${locale}/#how-it-works`} className={drawerLinkClass}>{t('how_it_works')}</a>
            <Link href="/stations" className={drawerLinkClass}>{t('stations')}</Link>
            <a href={`/${locale}/#notifications`} className={drawerLinkClass}>{t('reminders')}</a>
            <a href={`/${locale}/#faq`} className={drawerLinkClass}>{t('faq')}</a>
            <div className="pt-4 border-t border-[rgba(221,175,59,0.18)] flex flex-col gap-2.5">
              {((isAuthenticated && user) || (isLoading && user)) ? (
                <>
                  <div className="flex items-center gap-3 px-2 py-2">
                    <div className="w-9 h-9 rounded-full bg-[rgba(221,175,59,0.2)] border border-[rgba(221,175,59,0.4)] flex items-center justify-center shrink-0">
                      <span className="text-[14px] font-black text-[#DDAF3B] leading-none">{initial}</span>
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[14px] font-semibold text-[#001201] dark:text-[#FFEECA] truncate">{displayName}</p>
                      <p className="text-[12px] text-[#B0BFB1] truncate">{user.email}</p>
                    </div>
                  </div>
                  {isClient && (
                    <Link
                      href="/profile"
                      className="flex items-center justify-center gap-2.5 py-3 text-[14px] font-semibold text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] border border-[rgba(221,175,59,0.3)] rounded-md transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {t('profile')}
                    </Link>
                  )}
                  {isClient && (
                    <Link
                      href="/client/notifications"
                      className="flex items-center justify-center gap-2.5 py-3 text-[14px] font-semibold text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] border border-[rgba(221,175,59,0.3)] rounded-md transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      {tn('notif_title')}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => { logout(); setMenuOpen(false); }}
                    className="flex items-center justify-center gap-2.5 py-3 text-[14px] font-semibold text-[#FF383C] border border-[rgba(232,71,42,0.3)] rounded-md hover:bg-[rgba(232,71,42,0.07)] transition-colors"
                  >
                    <LogoutIcon />
                    {t('logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/merchant"
                    className="flex items-center justify-center py-3 border border-[rgba(221,175,59,0.45)] text-[14px] font-semibold tracking-[0.8px] uppercase text-[#DDAF3B] hover:bg-[#DDAF3B] hover:text-[#001201] transition-all rounded-md"
                  >
                    {t('merchant_pill')}
                  </Link>
                  <Link
                    href="/login"
                    className="flex items-center justify-center py-3 text-[14px] font-medium text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] transition-colors"
                  >
                    {t('login')}
                  </Link>
                  <Link
                    href="/register"
                    className="btn-shine flex items-center justify-center py-3 bg-[#DDAF3B] text-[#001201] text-[14px] font-bold tracking-[1px] uppercase rounded-md transition-all hover:bg-[#DDAF3B]"
                  >
                    {t('register')}
                  </Link>
                </>
              )}
            </div>

            {/* Share */}
            <div className="mt-1 border-t border-[rgba(221,175,59,0.18)] pt-4">
              <p className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-[0.8px] text-[var(--foreground)]/60 dark:text-[#B0BFB1]">
                {t('share')}
              </p>
              <ShareMenu inline />
            </div>
          </div>
        )}
      </header>

      {/* Spacer - push page content below fixed header (can be disabled per-layout) */}
      {withTopSpacer && <div className="h-[60px]" aria-hidden="true" />}
      {/* Extra spacer for mobile bottom nav (can be disabled per-layout) */}
      {withMobileScrollSpacer && <div className="sm:hidden" aria-hidden="true" />}
    </>
  );
}

type UserNotification = {
  id: string;
  title: string | null;
  body: string | null;
  is_read: boolean;
};

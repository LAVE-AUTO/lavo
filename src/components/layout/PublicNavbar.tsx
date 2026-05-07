'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';
import { useTheme } from '@/context/theme-context';
import { useAuth } from '@/context';

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
  const locale   = useLocale();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const isDark   = resolvedTheme === 'dark';
  const { user, isAuthenticated, isLoading, logout, isClient, isStation, isSuperAdmin } = useAuth();

  const [menuOpen,     setMenuOpen]     = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* Close drawer on navigation */
  useEffect(() => {
    const id = setTimeout(() => setMenuOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

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

  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';

  const displayName = user
    ? (user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user.email.split('@')[0])
    : '';

  const initial = user ? (user.first_name?.[0] ?? user.email[0]).toUpperCase() : '';

  /* Logo always goes to the landing page regardless of auth state */
  const logoHref = '/' as const;

  /* Nav links shown to logged-in users (desktop) */
  const authNavLinks = isClient
    ? [
        { href: '/stations',             label: t('stations') },
        { href: '/client/reservations',  label: t('reservations') },
        { href: '/client/history',       label: t('history') },
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
    'text-[13px] font-medium tracking-[0.4px] text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors duration-300';

  const pillClass =
    'inline-block border rounded-md border-[rgba(200,152,10,0.45)] text-[#c8980a] px-[22px] py-[9px] text-[13px] font-semibold tracking-[0.8px] uppercase transition-all duration-300 hover:bg-[#c8980a] hover:text-[#0d1f0f]';

  const ctaClass =
    'btn-shine inline-block bg-[#c8980a] rounded-md text-[#0d1f0f] px-[26px] py-[10px] text-[13px] font-bold tracking-[1px] uppercase transition-all duration-300 hover:bg-[#e8b520] hover:-translate-y-px hover:shadow-[0_6px_24px_rgba(200,152,10,0.4)]';

  const drawerLinkClass =
    'flex items-center px-4 py-3 text-[15px] font-medium text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-[rgba(247,243,236,0.95)] dark:bg-[rgba(13,31,15,0.92)] backdrop-blur-[16px] border-b border-[rgba(200,152,10,0.18)]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16 flex items-center justify-between gap-6 py-3">

          {/* Logo */}
          <Link href={logoHref} className="shrink-0" aria-label="Slowtime - Accueil">
            {isDark ? (
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-white/95 p-0.5 border border-[rgba(200,152,10,0.25)] shadow-sm shrink-0">
                  <Image src="/logo/frame2.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" aria-hidden="true" />
                </div>
                <span className="font-playfair text-[18px] font-black text-[#c8980a] tracking-[3px]">Slowtime</span>
              </div>
            ) : (
              <Image src={lightLogoSrc} alt={t('logo_alt')} width={130} height={34} className="h-9 w-auto object-contain" priority />
            )}
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-8" aria-label="Navigation principale">
            {isAuthenticated
              ? authNavLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href as Parameters<typeof Link>[0]['href']}
                    className={`${linkClass}${pathname.startsWith(href) ? ' !text-[#c8980a]' : ''}`}
                  >
                    {label}
                  </Link>
                ))
              : (
                <>
                  <a href={`/${locale}/#how-it-works`} className={linkClass}>{t('how_it_works')}</a>
                  <Link
                    href="/stations"
                    className={`${linkClass}${pathname.startsWith('/stations') ? ' !text-[#c8980a]' : ''}`}
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

            {/* Desktop actions */}
            <div className="hidden lg:flex items-center gap-2.5 ml-1">
              {((isAuthenticated && user) || (isLoading && user)) ? (
                /* Authenticated - avatar + name trigger + dropdown */
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="flex items-center gap-2 group cursor-pointer"
                    aria-label="Menu utilisateur"
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                  >
                    <div className="w-[34px] h-[34px] rounded-full bg-[rgba(200,152,10,0.2)] border border-[rgba(200,152,10,0.4)] flex items-center justify-center shrink-0 group-hover:border-[#c8980a] transition-colors">
                      <span className="text-[13px] font-black text-[#c8980a] leading-none">{initial}</span>
                    </div>
                    <span className="text-[13px] font-semibold text-[#4a6a4d] dark:text-[#7a9a7d] group-hover:text-[#c8980a] dark:group-hover:text-[#c8980a] transition-colors max-w-[110px] truncate">
                      {displayName}
                    </span>
                    <svg
                      width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      className={`text-[#7a9a7d] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Dropdown panel */}
                  {dropdownOpen && (
                    <div className="absolute top-[calc(100%+10px)] right-0 w-[230px] bg-[rgba(247,243,236,0.99)] dark:bg-[rgba(13,31,15,0.99)] border border-[rgba(200,152,10,0.2)] rounded-[6px] shadow-[0_16px_48px_rgba(0,0,0,0.2)] animate-fade-in overflow-hidden z-50">
                      {/* Profile info */}
                      <div className="px-4 py-3.5 border-b border-[rgba(200,152,10,0.12)]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[rgba(200,152,10,0.2)] border border-[rgba(200,152,10,0.4)] flex items-center justify-center shrink-0">
                            <span className="text-[14px] font-black text-[#c8980a] leading-none">{initial}</span>
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[13px] font-bold text-[#1a1a1a] dark:text-[#fef9e7] truncate leading-tight">
                              {displayName}
                            </p>
                            <p className="text-[11px] text-[#7a9a7d] truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Profile link */}
                      <Link
                        href="/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-[13px] font-semibold text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] hover:bg-[rgba(200,152,10,0.05)] transition-colors"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        {t('profile')}
                      </Link>

                      {/* Logout */}
                      <button
                        type="button"
                        onClick={() => { logout(); setDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-semibold text-[#e8472a] hover:bg-[rgba(232,71,42,0.07)] transition-colors border-t border-[rgba(200,152,10,0.12)]"
                      >
                        <LogoutIcon />
                        {t('logout')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Not authenticated: merchant pill + login + register */
                <>
                  <Link href="/merchant" className={pillClass}>
                    {t('merchant_pill')}
                  </Link>
                  <Link
                    href="/login"
                    className="text-[13px] font-medium tracking-[0.4px] text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors px-2"
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
              className="flex lg:hidden w-9 h-9 items-center justify-center text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {/* Tablet drawer */}
        {menuOpen && (
          <div className="lg:hidden bg-[rgba(247,243,236,0.98)] dark:bg-[rgba(13,31,15,0.98)] border-t border-[rgba(200,152,10,0.18)] px-6 py-5 space-y-1 animate-fade-in">
            <a href={`/${locale}/#how-it-works`} className={drawerLinkClass}>{t('how_it_works')}</a>
            <Link href="/stations" className={drawerLinkClass}>{t('stations')}</Link>
            <a href={`/${locale}/#notifications`} className={drawerLinkClass}>{t('reminders')}</a>
            <a href={`/${locale}/#faq`} className={drawerLinkClass}>{t('faq')}</a>
            <div className="pt-4 border-t border-[rgba(200,152,10,0.18)] flex flex-col gap-2.5">
              {((isAuthenticated && user) || (isLoading && user)) ? (
                <>
                  <div className="flex items-center gap-3 px-2 py-2">
                    <div className="w-9 h-9 rounded-full bg-[rgba(200,152,10,0.2)] border border-[rgba(200,152,10,0.4)] flex items-center justify-center shrink-0">
                      <span className="text-[14px] font-black text-[#c8980a] leading-none">{initial}</span>
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[14px] font-semibold text-[#1a1a1a] dark:text-[#fef9e7] truncate">{displayName}</p>
                      <p className="text-[12px] text-[#7a9a7d] truncate">{user.email}</p>
                    </div>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center justify-center gap-2.5 py-3 text-[14px] font-semibold text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] border border-[rgba(200,152,10,0.3)] rounded-md transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {t('profile')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => { logout(); setMenuOpen(false); }}
                    className="flex items-center justify-center gap-2.5 py-3 text-[14px] font-semibold text-[#e8472a] border border-[rgba(232,71,42,0.3)] rounded-md hover:bg-[rgba(232,71,42,0.07)] transition-colors"
                  >
                    <LogoutIcon />
                    {t('logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/merchant"
                    className="flex items-center justify-center py-3 border border-[rgba(200,152,10,0.45)] text-[14px] font-semibold tracking-[0.8px] uppercase text-[#c8980a] hover:bg-[#c8980a] hover:text-[#0d1f0f] transition-all rounded-md"
                  >
                    {t('merchant_pill')}
                  </Link>
                  <Link
                    href="/login"
                    className="flex items-center justify-center py-3 text-[14px] font-medium text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors"
                  >
                    {t('login')}
                  </Link>
                  <Link
                    href="/register"
                    className="btn-shine flex items-center justify-center py-3 bg-[#c8980a] text-[#0d1f0f] text-[14px] font-bold tracking-[1px] uppercase rounded-md transition-all hover:bg-[#e8b520]"
                  >
                    {t('register')}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Spacer - push page content below fixed header (can be disabled per-layout) */}
      {withTopSpacer && <div className="h-[62px]" aria-hidden="true" />}
      {/* Extra spacer for mobile bottom nav (can be disabled per-layout) */}
      {withMobileScrollSpacer && <div className="sm:hidden h-16" aria-hidden="true" />}
    </>
  );
}

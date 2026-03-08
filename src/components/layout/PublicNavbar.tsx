'use client';

import { useState, useEffect } from 'react';
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

/**
 * Sticky public navbar.
 * Becomes opaque with backdrop blur on scroll.
 * Includes logo, nav links, theme toggle, lang toggle and a mobile drawer.
 */
export function PublicNavbar() {
  const t        = useTranslations('nav');
  const locale   = useLocale();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const isDark   = resolvedTheme === 'dark';

  const { user, isAuthenticated, logout } = useAuth();

  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Close mobile menu on route change (deferred to avoid synchronous setState in effect) */
  useEffect(() => {
    const id = setTimeout(() => setMenuOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';

  const navLinks = [
    { href: '/',         label: t('home') },
    { href: '/stations', label: t('stations') },
  ];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <header
        className={[
          'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
          'bg-white/95 dark:bg-dark-bg/95 backdrop-blur-md border-b border-[#E0E0D0] shadow-sm',
          scrolled || menuOpen
            ? 'dark:border-tab-inactive'
            : 'dark:border-transparent dark:bg-transparent dark:backdrop-blur-none dark:shadow-none',
        ].join(' ')}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="shrink-0" aria-label="Slowtime – Accueil">
            {isDark ? (
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-white/95 p-0.5 border border-gold/25 shadow-sm shrink-0">
                  <Image src="/logo/frame2.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" aria-hidden="true" />
                </div>
                <span className="text-[17px] font-bold text-white tracking-wide">Slowtime</span>
              </div>
            ) : (
              <Image src={lightLogoSrc} alt={t('logo_alt')} width={120} height={32} className="h-8 w-auto object-contain" priority />
            )}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navigation principale">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={[
                  'px-4 py-2 rounded-lg text-[14px] font-semibold transition-colors duration-150',
                  isActive(href)
                    ? 'text-gold bg-gold/8'
                    : scrolled
                      ? 'text-[#1A1A1A] dark:text-white hover:text-gold dark:hover:text-gold hover:bg-gold/5'
                      : 'text-[#1A1A1A] dark:text-white hover:text-gold dark:hover:text-gold hover:bg-gold/5',
                ].join(' ')}
                aria-current={isActive(href) ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LangToggle />

            {/* Notification bell */}
            <button
              type="button"
              className="relative w-9 h-9 flex items-center justify-center rounded-lg text-[#1A1A1A] dark:text-white hover:bg-black/8 dark:hover:bg-white/8 transition-colors"
              aria-label="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {/* Badge placeholder */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-gold border-2 border-white dark:border-dark-bg" aria-hidden="true" />
            </button>

            {/* User greeting or auth links — desktop */}
            <div className="hidden md:flex items-center gap-2 ml-1">
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center shrink-0">
                    <span className="text-[13px] font-black text-gold leading-none">
                      {(user.first_name?.[0] ?? user.email[0]).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[14px] font-semibold text-[#1A1A1A] dark:text-white">
                    {t('greeting')}, <span className="text-gold">{user.first_name ?? user.email.split('@')[0]}</span>
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="ml-1 px-3 py-1.5 rounded-lg text-[13px] font-bold text-lavo-error hover:bg-lavo-error/10 transition-colors cursor-pointer"
                    title={t('logout')}
                  >
                    {t('logout')}
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-[13px] font-bold text-[#1A1A1A] dark:text-white hover:text-gold dark:hover:text-gold transition-colors"
                  >
                    {t('login')}
                  </Link>
                  <Link
                    href="/register"
                    className="btn-shine px-5 py-2 bg-gold hover:bg-gold-hover rounded-[10px] text-[13px] font-bold text-dark-bg transition-colors"
                  >
                    {t('register')}
                  </Link>
                </>
              )}
            </div>

            {/* User avatar on mobile (when authenticated) */}
            {isAuthenticated && user && (
              <div className="flex md:hidden items-center gap-2">
                <span className="text-[13px] font-semibold text-[#1A1A1A] dark:text-white">
                  {t('greeting')}, <span className="text-gold">{user.first_name ?? user.email.split('@')[0]}</span>
                </span>
              </div>
            )}

            {/* Hamburger — tablet only (mobile uses BottomNav, desktop uses inline nav) */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="hidden sm:flex md:hidden w-9 h-9 items-center justify-center rounded-lg text-[#1A1A1A] dark:text-white hover:bg-black/8 dark:hover:bg-white/8 transition-colors"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="md:hidden bg-white dark:bg-dark-bg border-t border-[#E0E0D0] dark:border-tab-inactive px-4 py-5 space-y-1 animate-fade-in">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={[
                  'flex items-center px-4 py-3 rounded-xl text-[15px] font-semibold transition-colors',
                  isActive(href)
                    ? 'text-gold bg-gold/8'
                    : 'text-[#1A1A1A] dark:text-white hover:text-gold hover:bg-gold/5',
                ].join(' ')}
              >
                {label}
              </Link>
            ))}
            <div className="pt-3 border-t border-[#E0E0D0] dark:border-tab-inactive flex flex-col gap-2">
              {isAuthenticated && user ? (
                <div className="flex items-center gap-3 px-2 py-2">
                  <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center shrink-0">
                    <span className="text-[14px] font-black text-gold leading-none">
                      {(user.first_name?.[0] ?? user.email[0]).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] font-bold text-[#1A1A1A] dark:text-white leading-tight">
                      {user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user.email}
                    </p>
                    <p className="text-[13px] text-[#555] dark:text-[#C0C0B0]">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center justify-center py-3 rounded-xl border border-lavo-error/30 text-[14px] font-bold text-lavo-error hover:bg-lavo-error/10 transition-colors cursor-pointer"
                >
                  {t('logout')}
                </button>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex items-center justify-center py-3 rounded-xl border border-[#E0E0D0] dark:border-tab-inactive text-[14px] font-bold text-[#1A1A1A] dark:text-white hover:border-gold transition-colors"
                  >
                    {t('login')}
                  </Link>
                  <Link
                    href="/register"
                    className="btn-shine flex items-center justify-center py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-bold text-dark-bg transition-colors"
                  >
                    {t('register')}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Spacer to push page content below the fixed navbar */}
      <div className="h-16" aria-hidden="true" />
      {/* Bottom spacer for mobile bottom nav */}
      <div className="sm:hidden h-16" aria-hidden="true" />
    </>
  );
}

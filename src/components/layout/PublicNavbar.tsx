'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';
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
 * Dark glass bg (dark mode) / cream glass (light mode), Playfair Display logo.
 * Nav links anchor to landing sections; merchant pill + auth CTAs on the right.
 */
export function PublicNavbar() {
  const t        = useTranslations('nav');
  const locale   = useLocale();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setMenuOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  const linkClass =
    'text-[13px] font-medium tracking-[0.4px] text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors duration-300';

  const pillClass =
    'inline-block border border-[rgba(200,152,10,0.45)] text-[#c8980a] px-[22px] py-[9px] rounded-[2px] text-[13px] font-semibold tracking-[0.8px] uppercase transition-all duration-300 hover:bg-[#c8980a] hover:text-[#0d1f0f]';

  const ctaClass =
    'btn-shine inline-block bg-[#c8980a] text-[#0d1f0f] px-[26px] py-[10px] rounded-[2px] text-[13px] font-bold tracking-[1px] uppercase transition-all duration-300 hover:bg-[#e8b520] hover:-translate-y-px hover:shadow-[0_6px_24px_rgba(200,152,10,0.4)]';

  const drawerLinkClass =
    'flex items-center px-4 py-3 text-[15px] font-medium text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-[rgba(247,243,236,0.95)] dark:bg-[rgba(13,31,15,0.92)] backdrop-blur-[16px] border-b border-[rgba(200,152,10,0.18)]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16 flex items-center justify-between gap-6 py-[18px]">

          {/* Logo */}
          <Link href="/" className="font-playfair text-[26px] font-black text-[#c8980a] tracking-[5px] shrink-0 leading-none" aria-label="Slowtime — Accueil">
            Slowtime
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-8" aria-label="Navigation principale">
            <a href={`/${locale}/#how-it-works`} className={linkClass}>{t('how_it_works')}</a>
            <Link
              href="/stations"
              className={`${linkClass}${pathname.startsWith('/stations') ? ' !text-[#c8980a]' : ''}`}
            >
              {t('stations')}
            </Link>
            <a href={`/${locale}/#notifications`} className={linkClass}>{t('reminders')}</a>
            <a href={`/${locale}/#faq`} className={linkClass}>{t('faq')}</a>
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <LangToggle />

            {/* Desktop actions */}
            <div className="hidden lg:flex items-center gap-2.5 ml-1">
              <Link href="/stations/apply" className={pillClass}>
                {t('merchant_pill')}
              </Link>
              {isAuthenticated && user ? (
                <div className="w-[34px] h-[34px] rounded-full bg-[rgba(200,152,10,0.2)] border border-[rgba(200,152,10,0.4)] flex items-center justify-center shrink-0">
                  <span className="text-[13px] font-black text-[#c8980a] leading-none">
                    {(user.first_name?.[0] ?? user.email[0]).toUpperCase()}
                  </span>
                </div>
              ) : (
                <>
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

            {/* Hamburger — tablet only (mobile uses BottomNav) */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="hidden sm:flex lg:hidden w-9 h-9 items-center justify-center text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors"
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
              <Link
                href="/stations/apply"
                className="flex items-center justify-center py-3 border border-[rgba(200,152,10,0.45)] text-[14px] font-semibold tracking-[0.8px] uppercase text-[#c8980a] hover:bg-[#c8980a] hover:text-[#0d1f0f] transition-all rounded-[2px]"
              >
                {t('merchant_pill')}
              </Link>
              {isAuthenticated && user ? (
                <div className="flex items-center gap-3 px-2 py-2">
                  <div className="w-9 h-9 rounded-full bg-[rgba(200,152,10,0.2)] border border-[rgba(200,152,10,0.4)] flex items-center justify-center shrink-0">
                    <span className="text-[14px] font-black text-[#c8980a] leading-none">
                      {(user.first_name?.[0] ?? user.email[0]).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[15px] font-semibold text-[#1a1a1a] dark:text-[#fef9e7]">
                    {user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user.email}
                  </p>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex items-center justify-center py-3 text-[14px] font-medium text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors"
                  >
                    {t('login')}
                  </Link>
                  <Link
                    href="/register"
                    className="btn-shine flex items-center justify-center py-3 bg-[#c8980a] text-[#0d1f0f] text-[14px] font-bold tracking-[1px] uppercase rounded-[2px] transition-all hover:bg-[#e8b520]"
                  >
                    {t('register')}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Spacer — push page content below fixed header */}
      <div className="h-[62px]" aria-hidden="true" />
      {/* Extra spacer for mobile bottom nav */}
      <div className="sm:hidden h-16" aria-hidden="true" />
    </>
  );
}

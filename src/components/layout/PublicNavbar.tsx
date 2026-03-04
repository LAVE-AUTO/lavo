'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';
import { useTheme } from '@/context/theme-context';

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

  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Close mobile menu on route change */
  useEffect(() => { setMenuOpen(false); }, [pathname]);

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
          scrolled || menuOpen
            ? 'bg-white/95 dark:bg-dark-bg/95 backdrop-blur-md border-b border-[#E0E0D0] dark:border-[#2C3828] shadow-sm'
            : 'bg-transparent',
        ].join(' ')}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="shrink-0" aria-label="LAVO – Accueil">
            {isDark ? (
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-white/95 p-0.5 border border-gold/25 shadow-sm shrink-0">
                  <Image src="/logo/frame2.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" aria-hidden="true" />
                </div>
                <span className="text-[17px] font-bold text-white tracking-wide">LAVO</span>
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

            {/* Auth links — desktop */}
            <div className="hidden md:flex items-center gap-2 ml-2">
              <Link
                href="/login"
                className="px-4 py-2 text-[13px] font-bold text-[#1A1A1A] dark:text-white hover:text-gold dark:hover:text-gold transition-colors"
              >
                {t('login')}
              </Link>
              <Link
                href="/register"
                className="btn-shine px-5 py-2 bg-gold hover:bg-gold-hover rounded-[10px] text-[13px] font-bold text-[#1A2116] transition-colors"
              >
                {t('register')}
              </Link>
            </div>

            {/* Hamburger — mobile */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-[#1A1A1A] dark:text-white hover:bg-black/8 dark:hover:bg-white/8 transition-colors"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="md:hidden bg-white dark:bg-dark-bg border-t border-[#E0E0D0] dark:border-[#2C3828] px-4 py-5 space-y-1 animate-fade-in">
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
            <div className="pt-3 border-t border-[#E0E0D0] dark:border-[#2C3828] flex flex-col gap-2">
              <Link
                href="/login"
                className="flex items-center justify-center py-3 rounded-xl border border-[#E0E0D0] dark:border-[#3A4A36] text-[14px] font-bold text-[#1A1A1A] dark:text-white hover:border-gold transition-colors"
              >
                {t('login')}
              </Link>
              <Link
                href="/register"
                className="btn-shine flex items-center justify-center py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-bold text-[#1A2116] transition-colors"
              >
                {t('register')}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Spacer to push page content below the fixed navbar */}
      <div className="h-16" aria-hidden="true" />
    </>
  );
}

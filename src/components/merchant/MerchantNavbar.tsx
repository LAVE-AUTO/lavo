'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useTheme } from '@/context/theme-context';
import { useAuth } from '@/context';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

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

export function MerchantNavbar() {
  const t = useTranslations('merchant.nav');
  const locale = useLocale();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  /* Close the dropdown on outside click, mirroring PublicNavbar's behaviour. */
  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [dropdownOpen]);

  useEffect(() => {
    const id = setTimeout(() => {
      setMenuOpen(false);
      setDropdownOpen(false);
    }, 0);
    return () => clearTimeout(id);
  }, [pathname]);

  /* Derivations aligned on PublicNavbar so the same value lands in both
   * navbars for the same user. */
  const displayName = user
    ? (user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user.email.split('@')[0])
    : '';
  const initial = user ? (user.first_name?.[0] ?? user.email[0]).toUpperCase() : '';

  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';
  const darkLogoSrc  = locale === 'fr' ? '/logo/logo22_2.png' : '/logo/logo_anglais_2.png';

  /* Class strings copied verbatim from PublicNavbar so the visual rhythm
   * (rounded-md placement, padding scale, hover shadow) is identical. */
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
      <header className="fixed top-0 left-0 right-0 z-40 bg-[rgba(247,243,236,0.95)] dark:bg-dark-bg backdrop-blur-[16px] border-b border-[rgba(221,175,59,0.18)]">
        {/* Same centered 1440 container as PublicNavbar: merchant landing
            is a marketing page that follows the client landing rhythm. */}
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16 flex items-center justify-between gap-6 py-2">

          {/* Logo */}
          <Link href="/" className="shrink-0" aria-label="Hurryline - Accueil" suppressHydrationWarning>
            <Image
              src={isDark ? darkLogoSrc : lightLogoSrc}
              alt={t('logo_alt')}
              width={130}
              height={34}
              className="h-12 w-auto object-contain"
              priority
            />
          </Link>

          <nav className="hidden lg:flex items-center gap-8" aria-label="Navigation marchands">
            <a href="#how-it-works" className={linkClass}>{t('how_it_works')}</a>
            <a href="#features" className={linkClass}>{t('features')}</a>
            <a href="#qr" className={linkClass}>{t('qr')}</a>
            <a href="#testimonials" className={linkClass}>{t('testimonials')}</a>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <LangToggle />

            <div className="hidden lg:flex items-center gap-2.5 ml-1">
              {isAuthenticated && user ? (
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
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className={`text-[#B0BFB1] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute top-[calc(100%+10px)] right-0 z-50 w-[230px] overflow-hidden rounded-[6px] border border-[rgba(221,175,59,0.2)] bg-[#FFEECA] shadow-[0_16px_48px_rgba(0,0,0,0.2)] animate-fade-in dark:bg-[#001201]">
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

                      <Link
                        href="/station/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-[13px] font-semibold text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] hover:bg-[rgba(221,175,59,0.05)] transition-colors"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="3" width="7" height="9" rx="1" />
                          <rect x="14" y="3" width="7" height="5" rx="1" />
                          <rect x="14" y="12" width="7" height="9" rx="1" />
                          <rect x="3" y="16" width="7" height="5" rx="1" />
                        </svg>
                        {t('dashboard')}
                      </Link>

                      <button
                        type="button"
                        onClick={() => { logout(); setDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-semibold text-[#FF383C] hover:bg-[rgba(255,56,60,0.07)] transition-colors border-t border-[rgba(221,175,59,0.12)]"
                      >
                        <LogoutIcon />
                        {t('logout')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link href="/" className={pillClass}>
                    {t('client_pill')}
                  </Link>
                  <Link
                    href="/station/login"
                    className="text-[13px] font-medium tracking-[0.4px] text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] transition-colors px-2"
                  >
                    {t('login_pill')}
                  </Link>
                  <Link href="/station/apply" className={ctaClass}>
                    {t('partner_cta')}
                  </Link>
                </>
              )}
            </div>

            {/* Hamburger - mobile + tablet. Drawer holds the client-landing link plus
               the login / partner CTAs so the full merchant navbar collapses gracefully. */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex lg:hidden w-9 h-9 items-center justify-center text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] transition-colors"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden bg-[rgba(247,243,236,0.98)] dark:bg-[rgba(13,31,15,0.98)] border-t border-[rgba(221,175,59,0.18)] px-6 py-5 space-y-1 animate-fade-in">
            <a href="#how-it-works" className={drawerLinkClass}>{t('how_it_works')}</a>
            <a href="#features" className={drawerLinkClass}>{t('features')}</a>
            <a href="#qr" className={drawerLinkClass}>{t('qr')}</a>
            <a href="#testimonials" className={drawerLinkClass}>{t('testimonials')}</a>
            <div className="pt-4 border-t border-[rgba(221,175,59,0.18)] flex flex-col gap-2.5">
              {isAuthenticated && user ? (
                <>
                  <div className="flex items-center gap-3 px-2 py-2">
                    <div className="w-9 h-9 rounded-full bg-[rgba(221,175,59,0.2)] border border-[rgba(221,175,59,0.4)] flex items-center justify-center shrink-0">
                      <span className="text-[14px] font-black text-[#DDAF3B] leading-none">{initial}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[#001201] dark:text-[#FFEECA] truncate">
                        {displayName}
                      </p>
                      <p className="text-[12px] text-[#B0BFB1] truncate">{user.email}</p>
                    </div>
                  </div>
                  <Link
                    href="/station/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-center gap-2.5 py-3 text-[14px] font-semibold text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] border border-[rgba(221,175,59,0.3)] rounded-md transition-colors"
                  >
                    {t('dashboard')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => { logout(); setMenuOpen(false); }}
                    className="flex items-center justify-center gap-2.5 py-3 text-[14px] font-semibold text-[#FF383C] border border-[rgba(255,56,60,0.3)] rounded-md hover:bg-[rgba(255,56,60,0.07)] transition-colors"
                  >
                    <LogoutIcon />
                    {t('logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/"
                    className="flex items-center justify-center py-3 border border-[rgba(221,175,59,0.45)] text-[14px] font-semibold tracking-[0.8px] uppercase text-[#DDAF3B] hover:bg-[#DDAF3B] hover:text-[#001201] transition-all rounded-md"
                  >
                    {t('client_pill')}
                  </Link>
                  <Link
                    href="/station/login"
                    className="flex items-center justify-center py-3 text-[14px] font-medium text-[var(--foreground)] dark:text-[#B0BFB1] hover:text-[#DDAF3B] dark:hover:text-[#DDAF3B] transition-colors"
                  >
                    {t('login_pill')}
                  </Link>
                  <Link
                    href="/station/apply"
                    className="btn-shine flex items-center justify-center py-3 bg-[#DDAF3B] text-[#001201] text-[14px] font-bold tracking-[1px] uppercase rounded-md transition-all hover:bg-[#DDAF3B]"
                  >
                    {t('partner_cta')}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="h-[60px]" aria-hidden="true" />
    </>
  );
}

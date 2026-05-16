'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useTheme } from '@/context/theme-context';
import { useAuth } from '@/context';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';

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
  const { user, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setMenuOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';

  const linkClass =
    'text-[13px] font-medium tracking-[0.4px] text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors duration-300';

  const pillClass =
    'inline-block border border-[rgba(200,152,10,0.45)] text-[#c8980a] px-[22px] py-[9px] rounded-md text-[13px] font-semibold tracking-[0.8px] uppercase transition-all duration-300 hover:bg-[#c8980a] hover:text-[#0d1f0f]';

  const ctaClass =
    'btn-shine inline-block bg-[#c8980a] text-[#0d1f0f] px-[26px] py-[10px] rounded-md text-[13px] font-bold tracking-[1px] uppercase transition-all duration-300 hover:bg-[#e8b520] hover:-translate-y-px hover:shadow-[0_6px_24px_rgba(200,152,10,0.4)]';

  const drawerLinkClass =
    'flex items-center px-4 py-3 text-[15px] font-medium text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-[rgba(247,243,236,0.95)] dark:bg-[rgba(13,31,15,0.92)] backdrop-blur-[16px] border-b border-[rgba(200,152,10,0.18)]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16 flex items-center justify-between gap-6 py-3">
          <Link href="/" className="shrink-0" aria-label="Hurryline - Accueil">
            {isDark ? (
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-white/95 p-0.5 border border-[rgba(200,152,10,0.25)] shadow-sm shrink-0">
                  <Image src="/logo/frame2.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" aria-hidden="true" />
                </div>
                <span className="font-playfair text-[18px] font-black text-[#c8980a] tracking-[3px]">Hurryline</span>
              </div>
            ) : (
              <Image src={lightLogoSrc} alt="Hurryline" width={130} height={34} className="h-9 w-auto object-contain" priority />
            )}
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
                <div className="w-[34px] h-[34px] rounded-full bg-[rgba(200,152,10,0.2)] border border-[rgba(200,152,10,0.4)] flex items-center justify-center shrink-0">
                  <span className="text-[13px] font-black text-[#c8980a] leading-none">
                    {(user.first_name?.[0] ?? user.email[0]).toUpperCase()}
                  </span>
                </div>
              ) : (
                <>
                  <Link href="/" className={pillClass}>
                    {t('client_pill')}
                  </Link>
                  <Link
                    href="/station/login"
                    className="text-[13px] font-medium tracking-[0.4px] text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors px-2"
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
              className="flex lg:hidden w-9 h-9 items-center justify-center text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden bg-[rgba(247,243,236,0.98)] dark:bg-[rgba(13,31,15,0.98)] border-t border-[rgba(200,152,10,0.18)] px-6 py-5 space-y-1 animate-fade-in">
            <a href="#how-it-works" className={drawerLinkClass}>{t('how_it_works')}</a>
            <a href="#features" className={drawerLinkClass}>{t('features')}</a>
            <a href="#qr" className={drawerLinkClass}>{t('qr')}</a>
            <a href="#testimonials" className={drawerLinkClass}>{t('testimonials')}</a>
            <div className="pt-4 border-t border-[rgba(200,152,10,0.18)] flex flex-col gap-2.5">
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
                    href="/"
                    className="flex items-center justify-center py-3 border border-[rgba(200,152,10,0.45)] text-[14px] font-semibold tracking-[0.8px] uppercase text-[#c8980a] hover:bg-[#c8980a] hover:text-[#0d1f0f] transition-all rounded-md"
                  >
                    {t('client_pill')}
                  </Link>
                  <Link
                    href="/station/login"
                    className="flex items-center justify-center py-3 text-[14px] font-medium text-[#4a6a4d] dark:text-[#7a9a7d] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors"
                  >
                    {t('login_pill')}
                  </Link>
                  <Link
                    href="/station/apply"
                    className="btn-shine flex items-center justify-center py-3 bg-[#c8980a] text-[#0d1f0f] text-[14px] font-bold tracking-[1px] uppercase rounded-md transition-all hover:bg-[#e8b520]"
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
      <div className="sm:hidden h-16" aria-hidden="true" />
    </>
  );
}

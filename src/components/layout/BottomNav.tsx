'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/context';

/**
 * Mobile-only bottom navigation bar.
 * Tabs: Accueil, Reservation, Favoris, Plus (profile/logout popup).
 */
export function BottomNav() {
  const t        = useTranslations('nav');
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  /* Close "Plus" popup on outside tap */
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [moreOpen]);

  /* Close on route change */
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const tabs = [
    {
      href: '/',
      label: t('home'),
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
          <polyline points="9 22 9 12 15 12 15 22" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
        </svg>
      ),
    },
    {
      href: '/client/reservations',
      label: t('reservations'),
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
          <line x1="16" y1="2" x2="16" y2="6" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
          <line x1="8" y1="2" x2="8" y2="6" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
          <line x1="3" y1="10" x2="21" y2="10" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
        </svg>
      ),
    },
    {
      href: '/favorites',
      label: t('favorites'),
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#C49A1E' : 'none'} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-[#1E2A1A] border-t border-[#2C3828]"
      aria-label="Navigation principale"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ href, label, icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 cursor-pointer"
            aria-current={active ? 'page' : undefined}
          >
            {icon(active)}
            <span className={`text-[13px] font-bold tracking-wide ${active ? 'text-gold' : 'text-[#9A9A8A]'}`}>
              {label}
            </span>
          </Link>
        );
      })}

      {/* "Plus" tab with popup */}
      <div ref={moreRef} className="flex-1 relative">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="w-full flex flex-col items-center gap-1 py-2.5 cursor-pointer"
          aria-expanded={moreOpen}
          aria-haspopup="true"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="5" r="1.5" fill={moreOpen ? '#C49A1E' : '#9A9A8A'} />
            <circle cx="12" cy="12" r="1.5" fill={moreOpen ? '#C49A1E' : '#9A9A8A'} />
            <circle cx="12" cy="19" r="1.5" fill={moreOpen ? '#C49A1E' : '#9A9A8A'} />
          </svg>
          <span className={`text-[13px] font-bold tracking-wide ${moreOpen ? 'text-gold' : 'text-[#9A9A8A]'}`}>
            {t('more')}
          </span>
        </button>

        {moreOpen && (
          <div className="absolute bottom-full right-0 mb-2 mr-1 w-48 rounded-xl bg-[#1E2A1A] border border-[#2C3828] shadow-xl overflow-hidden animate-fade-in">
            {isAuthenticated && user ? (
              <>
                <Link
                  href="/client/profile"
                  className="flex items-center gap-3 px-4 py-3 text-[14px] font-semibold text-white hover:bg-gold/10 transition-colors cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {t('profile')}
                </Link>
                <button
                  type="button"
                  onClick={() => { setMoreOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[14px] font-semibold text-lavo-error hover:bg-lavo-error/10 transition-colors cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  {t('logout')}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="flex items-center gap-3 px-4 py-3 text-[14px] font-semibold text-white hover:bg-gold/10 transition-colors cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  {t('login')}
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-3 px-4 py-3 text-[14px] font-semibold text-white hover:bg-gold/10 transition-colors cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  {t('register')}
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

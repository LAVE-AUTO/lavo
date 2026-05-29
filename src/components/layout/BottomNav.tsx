'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/context';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? '#DDAF3B' : '#B0BFB1';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={c} strokeWidth="2" />
      <polyline points="9 22 9 12 15 12 15 22" stroke={c} strokeWidth="2" />
    </svg>
  );
}

function CouponsIcon({ active }: { active: boolean }) {
  const c = active ? '#DDAF3B' : '#B0BFB1';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9a2 2 0 012-2h16a2 2 0 012 2v1a2 2 0 010 4v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1a2 2 0 010-4V9z" stroke={c} strokeWidth="2" />
      <path d="M9 7v10" stroke={c} strokeWidth="2" strokeDasharray="2 2" />
    </svg>
  );
}

function FavoritesIcon({ active }: { active: boolean }) {
  const c = active ? '#DDAF3B' : '#B0BFB1';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#DDAF3B' : 'none'} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={c} strokeWidth="2" />
    </svg>
  );
}

function HowItWorksIcon({ active }: { active: boolean }) {
  const c = active ? '#DDAF3B' : '#B0BFB1';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="2" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke={c} strokeWidth="2" />
      <circle cx="12" cy="17" r="0.5" fill={c} stroke={c} strokeWidth="1" />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  const c = active ? '#DDAF3B' : '#B0BFB1';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke={c} strokeWidth="2" />
      <path d="m21 21-4.35-4.35" stroke={c} strokeWidth="2" />
    </svg>
  );
}

function MoreIcon({ active }: { active: boolean }) {
  const c = active ? '#DDAF3B' : '#B0BFB1';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="5" r="1.5" fill={c} />
      <circle cx="12" cy="12" r="1.5" fill={c} />
      <circle cx="12" cy="19" r="1.5" fill={c} />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SupportNavIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/**
 * Mobile-only bottom navigation bar.
 * Guest: Accueil, Stations, Login, Comment ça marche
 * Authenticated CLIENT: Accueil, Reservations, Favoris, Plus (Profile + Deconnexion)
 */
export function BottomNav() {
  const t        = useTranslations('nav');
  const pathname = usePathname();
  const { isAuthenticated, isClient, isStation, isSuperAdmin, user, logout } = useAuth();

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  /* Close "More" menu on navigation */
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    if (pathnameRef.current !== pathname) {
      pathnameRef.current = pathname;
      const id = setTimeout(() => setMoreOpen(false), 0);
      return () => clearTimeout(id);
    }
  }, [pathname]);

  /* Close on outside click */
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreOpen]);

  /* Resolve home href based on auth state */
  let homeHref = '/';
  if (isAuthenticated) {
    if (isClient) homeHref = '/stations';
    else if (isStation) homeHref = '/station/dashboard';
    else if (isSuperAdmin) homeHref = '/admin';
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const initial = user ? (user.first_name ? user.first_name[0] : user.email[0]).toUpperCase() : '';
  const displayName = user
    ? (user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email.split('@')[0])
    : '';

  /* Guest items - labels kept short so they stay on a single line in the bottom bar */
  const guestItems = [
    { href: homeHref, label: t('home'), icon: (a: boolean) => <HomeIcon active={a} /> },
    { href: '/stations', label: t('stations'), icon: (a: boolean) => <SearchIcon active={a} /> },
    { href: '/login', label: t('login'), icon: () => <UserIcon /> },
    { href: '/#how-it-works', label: t('bottom_how_it_works'), icon: (a: boolean) => <HowItWorksIcon active={a} /> },
  ];

  /* Authenticated items - client only.
     Station and admin users see guestItems since /client/reservations and /favorites are client-specific routes. */
  const authItems = isClient
    ? [
        { href: homeHref, label: t('home'), icon: (a: boolean) => <HomeIcon active={a} /> },
        { href: '/client/reservations', label: t('coupons'), icon: (a: boolean) => <CouponsIcon active={a} /> },
        { href: '/favorites', label: t('favorites'), icon: (a: boolean) => <FavoritesIcon active={a} /> },
      ]
    : guestItems;

  const items = isAuthenticated ? authItems : guestItems;

  return (
    <>
      {/* "More" popup overlay */}
      {moreOpen && (
        <div className="sm:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={() => setMoreOpen(false)} />
      )}

      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-[#001A05] border-t border-[#2C3828]"
        aria-label={t('bottom_nav_aria')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {items.map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={`${href}-${label}`}
              href={href}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 cursor-pointer"
              aria-current={active ? 'page' : undefined}
            >
              {icon(active)}
              <span className={`text-[11px] font-bold tracking-wide whitespace-nowrap ${active ? 'text-gold' : 'text-[#B0BFB1]'}`}>
                {label}
              </span>
            </Link>
          );
        })}

        {/* "Plus" button for authenticated users */}
        {isAuthenticated && (
          <div ref={moreRef} className="flex-1 relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="w-full flex flex-col items-center gap-1 py-2.5 cursor-pointer"
              aria-label={t('more')}
              aria-expanded={moreOpen}
              aria-haspopup="true"
            >
              <MoreIcon active={moreOpen} />
              <span className={`text-[11px] font-bold tracking-wide ${moreOpen ? 'text-gold' : 'text-[#B0BFB1]'}`}>
                {t('more')}
              </span>
            </button>

            {/* Popup menu */}
            {moreOpen && (
              <div className="absolute bottom-full right-2 mb-2 w-[220px] bg-[#001A05] border border-[#2C3828] rounded-xl shadow-[0_-8px_32px_rgba(0,0,0,0.4)] overflow-hidden animate-fade-in-up z-50">
                {/* User info */}
                <div className="px-4 py-3 border-b border-[#2C3828]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center shrink-0">
                      <span className="text-[13px] font-black text-gold leading-none">{initial}</span>
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[13px] font-bold text-white truncate leading-tight">{displayName}</p>
                      <p className="text-[11px] text-[#B0BFB1] truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Profile link */}
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-4 py-3 text-[14px] font-semibold text-[#A0B89A] hover:text-gold hover:bg-white/5 transition-colors"
                  onClick={() => setMoreOpen(false)}
                >
                  <UserIcon />
                  {t('profile')}
                </Link>

                {/* Support link - client only */}
                {isClient && (
                  <Link
                    href="/client/support"
                    className="flex items-center gap-3 px-4 py-3 text-[14px] font-semibold text-[#A0B89A] hover:text-gold hover:bg-white/5 transition-colors border-t border-[#2C3828]"
                    onClick={() => setMoreOpen(false)}
                  >
                    <SupportNavIcon />
                    {t('support')}
                  </Link>
                )}

                {/* Theme + Lang row */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#2C3828]">
                  <span className="text-[12px] font-semibold text-[#B0BFB1]">{t('appearance_aria')}</span>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <LangToggle />
                  </div>
                </div>

                {/* Logout */}
                <button
                  type="button"
                  onClick={() => { logout(); setMoreOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[14px] font-semibold text-[#FF383C] hover:bg-[rgba(232,71,42,0.07)] transition-colors border-t border-[#2C3828]"
                >
                  <LogoutIcon />
                  {t('logout')}
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </>
  );
}
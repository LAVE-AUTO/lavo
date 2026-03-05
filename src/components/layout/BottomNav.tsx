'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * Mobile-only bottom navigation bar matching the HTML mockup's bottom-nav.
 * Fixed at the bottom, hidden on sm: and above (desktop uses top navbar + footer).
 */
export function BottomNav() {
  const t        = useTranslations('nav');
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const items = [
    {
      href: '/',
      label: t('home'),
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
          <polyline points="9 22 9 12 15 12 15 22" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
        </svg>
      ),
    },
    {
      href: '/stations',
      label: t('stations'),
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
          <path d="m21 21-4.35-4.35" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
        </svg>
      ),
    },
    {
      href: '/login',
      label: t('login'),
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
          <circle cx="12" cy="7" r="4" stroke={active ? '#C49A1E' : '#9A9A8A'} strokeWidth="2" />
        </svg>
      ),
    },
    {
      href: '/favorites',
      label: t('favorites'),
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#C49A1E' : 'none'} strokeLinecap="round" strokeLinejoin="round">
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
      {items.map(({ href, label, icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 cursor-pointer"
            aria-current={active ? 'page' : undefined}
          >
            {icon(active)}
            <span
              className={`text-[13px] font-bold tracking-wide ${active ? 'text-gold' : 'text-[#9A9A8A]'}`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

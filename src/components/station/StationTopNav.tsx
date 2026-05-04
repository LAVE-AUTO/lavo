'use client';

import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';

interface StationTopNavProps {
  stationName?: string;
}

export function StationTopNav({ stationName }: StationTopNavProps) {
  const t = useTranslations('station_dashboard');
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const locale = useLocale();

  const isDark = resolvedTheme === 'dark';
  const displayName = stationName ?? user?.first_name ?? 'Station';
  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[#E0DCD0] bg-white px-6 dark:border-[#1A2A14] dark:bg-[#111A0E]">

      {/* Logo — always links to landing page */}
      <div className="flex flex-col justify-center">
        <Link href="/" aria-label="Slowtime — Accueil">
          {isDark ? (
            <div className="flex items-center gap-2">
              <div className="shrink-0 rounded-lg border border-[rgba(200,152,10,0.25)] bg-white/95 p-0.5 shadow-sm">
                <Image src="/logo/frame2.png" alt="" width={24} height={24} className="h-6 w-6 object-contain" aria-hidden="true" />
              </div>
              <span className="font-playfair text-[18px] font-black leading-none tracking-[3px] text-[#C49A1E]">
                Slowtime
              </span>
            </div>
          ) : (
            <Image
              src={lightLogoSrc}
              alt="Slowtime"
              width={110}
              height={30}
              className="h-8 w-auto object-contain"
              priority
            />
          )}
        </Link>
        <div className="mt-0.5 text-[11px] font-medium text-[#666] dark:text-[#A0A090]">
          {displayName}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LangToggle />

        {/* Notification bell — disabled until /me/notifications endpoints ship.
            See project_pending_backend_specs.md for the spec. */}
        <button
          type="button"
          disabled
          aria-label={t('notif_coming_soon')}
          title={t('notif_coming_soon')}
          className="relative flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full bg-[#F0EDE0] opacity-60 dark:bg-[#182214]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span
            className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#C49A1E] dark:border-[#111A0E]"
            aria-hidden="true"
          />
        </button>
      </div>
    </header>
  );
}

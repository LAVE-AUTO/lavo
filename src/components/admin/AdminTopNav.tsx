'use client';

import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useTheme } from '@/context/theme-context';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';

interface AdminTopNavProps {
  onToggleSidebar?: () => void;
}

export function AdminTopNav({ onToggleSidebar }: AdminTopNavProps) {
  const t = useTranslations('admin_dashboard');
  const { resolvedTheme } = useTheme();
  const locale = useLocale();

  const isDark = resolvedTheme === 'dark';
  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[#E0DCD0] bg-white px-6 dark:border-[#1A2A14] dark:bg-[#111A0E]">

      <div className="flex items-center gap-3">
        {/* Sidebar toggle - visible below lg */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEE9D8] transition-opacity hover:opacity-80 dark:bg-[#182214] lg:hidden"
            aria-label="Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#666] dark:text-[#A0A090]">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        {/* Logo - always links to landing page */}
        <div className="flex flex-col justify-center">
        <Link href="/" aria-label="Hurryline - Accueil">
          {isDark ? (
            <div className="flex items-center gap-2">
              <div className="shrink-0 rounded-lg border border-[rgba(200,152,10,0.25)] bg-white/95 p-0.5 shadow-sm">
                <Image src="/logo/frame2.png" alt="" width={24} height={24} className="h-6 w-6 object-contain" aria-hidden="true" />
              </div>
              <span className="font-playfair text-[18px] font-black leading-none tracking-[3px] text-[#C49A1E]">
                Hurryline
              </span>
            </div>
          ) : (
            <Image
              src={lightLogoSrc}
              alt="Hurryline"
              width={110}
              height={30}
              className="h-8 w-auto object-contain"
              priority
            />
          )}
        </Link>
        <div className="mt-0.5 text-[11px] font-medium text-[#666] dark:text-[#A0A090]">
          Administration
        </div>
      </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LangToggle />

        {/* Notification bell */}
        <button
          type="button"
          aria-label={t('notif_tooltip')}
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#EEE9D8] transition-opacity hover:opacity-80 dark:bg-[#182214]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
      </div>
    </header>
  );
}

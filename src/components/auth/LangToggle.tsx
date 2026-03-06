'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';

type Locale = 'fr' | 'en';

/**
 * Language toggle button (FR / EN).
 * Switches locale while preserving the current pathname.
 */
export function LangToggle() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (next: Locale) => {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  };

  const base = 'px-2.5 py-1 text-[11px] font-bold tracking-wider transition-colors duration-150';
  const active = 'bg-gold text-dark-bg';
  const inactive = 'bg-transparent text-black dark:text-white text-[#333]';

  return (
    <div
      className="flex border border-gold rounded-[6px] overflow-hidden"
      role="group"
      aria-label="Language"
    >
      {(['fr', 'en'] as Locale[]).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => switchLocale(lang)}
          className={`${base} ${locale === lang ? active : inactive}`}
          aria-pressed={locale === lang}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

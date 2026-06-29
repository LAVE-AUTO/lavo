import Image from 'next/image';
import { LangToggle } from './LangToggle';
import { ThemeToggle } from './ThemeToggle';

interface AuthHeaderProps {
  title: string;
  subtitle: string;
  /** Current locale - drives the light-mode logo choice (FR vs EN wordmark). */
  locale: string;
}

/**
 * Auth page header.
 *
 * Mobile: top bar with logo + controls, then title + subtitle below.
 * Desktop: only controls top-right (brand panel handles the logo).
 *
 * Logo strategy (CSS dark-mode classes - no client JS needed):
 *   Light + FR  → logo2_2.png       (gold S + "Hurryline / ANTICIPONS MIEUX")
 *   Light + EN  → logo_anglais_1.png (gold S + "Hurryline / LET'S ANTICIPATE BETTER")
 * 
 */
export function AuthHeader({ title, subtitle, locale }: AuthHeaderProps) {
  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';
  const darkLogoSrc = locale === 'fr' ? '/logo/logo22_2.png' : '/logo/logo_anglais_2.png';

  return (
    <div className="mb-6">
      {/* Mobile-only top bar */}
      <div className="flex items-center justify-between mb-5 lg:hidden">

        {/* Light mode: full wordmark */}
        <Image
          src={lightLogoSrc}
          alt="Hurryline"
          width={190}
          height={50}
          className="object-contain h-12 w-auto dark:hidden"
          priority
        />

        {/* Dark mode: full dark-background wordmark */}
        <Image
          src={darkLogoSrc}
          alt="Hurryline"
          width={190}
          height={50}
          className="object-contain h-12 w-auto hidden dark:block"
          priority
        />

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LangToggle />
        </div>
      </div>

      {/* Desktop-only controls */}
      <div className="hidden lg:flex justify-end gap-2 mb-4">
        <ThemeToggle />
        <LangToggle />
      </div>

      {/* Title + subtitle */}
      <h1 className="text-[28px] font-bold text-dark-bg dark:text-white leading-tight">
        {title}
      </h1>
      <p className="mt-1.5 text-[15px] text-[#B0BFB1] dark:text-Hurryline-muted leading-snug">
        {subtitle}
      </p>
    </div>
  );
}

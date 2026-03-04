import Image from 'next/image';
import { LangToggle } from './LangToggle';
import { ThemeToggle } from './ThemeToggle';

interface AuthHeaderProps {
  title: string;
  subtitle: string;
  /** Current locale — drives the light-mode logo choice (FR vs EN wordmark). */
  locale: string;
}

/**
 * Auth page header.
 *
 * Mobile: top bar with logo + controls, then title + subtitle below.
 * Desktop: only controls top-right (brand panel handles the logo).
 *
 * Logo strategy (CSS dark-mode classes — no client JS needed):
 *   Light + FR  → logo2_2.png       (gold S + "Slowtime / ANTICIPONS MIEUX")
 *   Light + EN  → logo_anglais_1.png (gold S + "Slowtime / LET'S ANTICIPATE BETTER")
 *   Dark + any  → frame2.png badge  + "Slowtime" text
 */
export function AuthHeader({ title, subtitle, locale }: AuthHeaderProps) {
  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';

  return (
    <div className="mb-6">
      {/* Mobile-only top bar */}
      <div className="flex items-center justify-between mb-5 lg:hidden">

        {/* Light mode: full wordmark */}
        <Image
          src={lightLogoSrc}
          alt="Slowtime"
          width={140}
          height={36}
          className="object-contain h-8 w-auto dark:hidden"
          priority
        />

        {/* Dark mode: gold S badge + brand name */}
        <div className="hidden dark:flex items-center gap-2">
          <div className="rounded-lg bg-white/95 p-0.5 border border-gold/25 shadow-sm shrink-0">
            <Image
              src="/logo/frame2.png"
              alt=""
              width={28}
              height={28}
              className="w-7 h-7 object-contain"
              aria-hidden="true"
              priority
            />
          </div>
          <span className="text-lg font-bold text-white tracking-wide">
            Slowtime
          </span>
        </div>

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
      <h1 className="text-[26px] font-bold text-[#1A2116] dark:text-white leading-tight">
        {title}
      </h1>
      <p className="mt-1 text-[14px] text-[#5A6B54] dark:text-lavo-muted leading-snug">
        {subtitle}
      </p>
    </div>
  );
}

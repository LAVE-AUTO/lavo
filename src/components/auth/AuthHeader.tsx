import Image from 'next/image';
import { LangToggle } from './LangToggle';
import { ThemeToggle } from './ThemeToggle';

interface AuthHeaderProps {
  /** Page heading displayed above the tab switcher. */
  title: string;
  /** Short description displayed below the heading. */
  subtitle: string;
}

/**
 * Auth page header.
 *
 * - Mobile: top bar with logo + controls, then title + subtitle below.
 * - Desktop: only title + subtitle + controls (brand panel handles logo/branding).
 *
 * Logos use CSS dark-mode classes — no client-side JS needed.
 * Light mode: full horizontal wordmark (logo2_2.png)
 * Dark mode:  gold S icon (frame2.png) + "LAVO" text
 */
export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <div className="mb-6">
      {/* Mobile-only top bar: logo + controls */}
      <div className="flex items-center justify-between mb-5 lg:hidden">
        <div className="flex items-center gap-2">
          {/* Light mode: horizontal wordmark */}
          <Image
            src="/logo/logo2_2.png"
            alt="LAVO"
            width={120}
            height={32}
            className="object-contain h-8 w-auto dark:hidden"
            priority
          />
          {/* Dark mode: gold S medallion + wordmark text */}
          <div className="hidden dark:flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-gold/40 bg-white shrink-0">
              <Image
                src="/logo/frame2.png"
                alt=""
                width={32}
                height={32}
                className="w-full h-full object-cover"
                aria-hidden="true"
                priority
              />
            </div>
            <span className="text-lg font-bold text-white tracking-widest uppercase">
              LAVO
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LangToggle />
        </div>
      </div>

      {/* Desktop-only controls (top-right) */}
      <div className="hidden lg:flex justify-end gap-2 mb-4">
        <ThemeToggle />
        <LangToggle />
      </div>

      {/* Title + subtitle */}
      <h1 className="text-[26px] font-bold text-[#000C1F] dark:text-white leading-tight">
        {title}
      </h1>
      <p className="mt-1 text-[14px] text-[#555] dark:text-lavo-muted leading-snug">
        {subtitle}
      </p>
    </div>
  );
}

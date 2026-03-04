import { LangToggle } from './LangToggle';
import { ThemeToggle } from './ThemeToggle';

interface AuthHeaderProps {
  /** Page heading displayed above the tab switcher. */
  title: string;
  /** Short description displayed below the heading. */
  subtitle: string;
}

/**
 * Small car icon shown in the mobile header bar.
 */
function MiniCarIcon() {
  return (
    <svg viewBox="0 0 36 36" fill="none" width="28" height="28" aria-hidden="true">
      <path d="M5 20l3-8h20l3 8" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" />
      <rect x="4" y="18" width="28" height="10" rx="3" fill="#1A2116" stroke="#C49A1E" strokeWidth="1.5" />
      <circle cx="10" cy="28" r="3" fill="#C49A1E" />
      <circle cx="26" cy="28" r="3" fill="#C49A1E" />
    </svg>
  );
}

/**
 * Auth page header.
 *
 * - Mobile: top bar with logo + wordmark + controls, then title + subtitle below.
 * - Desktop: only title + subtitle + controls (brand panel handles logo/branding).
 */
export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <div className="mb-6">
      {/* Mobile-only top bar: logo + controls */}
      <div className="flex items-center justify-between mb-5 lg:hidden">
        <div className="flex items-center gap-2">
          <MiniCarIcon />
          <span className="text-lg font-bold text-[#000C1F] dark:text-white tracking-widest uppercase">
            LAVO
          </span>
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

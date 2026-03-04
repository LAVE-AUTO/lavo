import { LangToggle } from './LangToggle';
import { ThemeToggle } from './ThemeToggle';

interface AuthHeaderProps {
  title: string;
  subtitle: string;
}

/**
 * Car wash brand icon used inside the logo circle.
 */
function CarIcon() {
  return (
    <svg viewBox="0 0 36 36" fill="none" width="36" height="36" aria-hidden="true">
      <path
        d="M5 20l3-8h20l3 8"
        stroke="#C49A1E"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="4"
        y="18"
        width="28"
        height="10"
        rx="3"
        fill="#1A2116"
        stroke="#C49A1E"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="28" r="3" fill="#C49A1E" />
      <circle cx="26" cy="28" r="3" fill="#C49A1E" />
      <path d="M10 14l2-4h12l2 4" fill="#C49A1E" opacity="0.4" />
    </svg>
  );
}

/**
 * Auth page header with logo, title, subtitle, language toggle and theme toggle.
 *
 * @param title - Page heading
 * @param subtitle - Page sub-heading
 */
export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <div className="relative flex flex-col items-center pt-12 pb-6 px-6">
      <div className="absolute top-4 left-4">
        <ThemeToggle />
      </div>
      <div className="absolute top-4 right-4">
        <LangToggle />
      </div>

      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4 shadow-sm">
        <CarIcon />
      </div>

      <h1 className="text-2xl font-bold text-[#000C1F] dark:text-white text-center tracking-tight font-rajdhani">
        {title}
      </h1>
      <p className="text-[13px] text-[#555555] dark:text-lavo-muted text-center mt-1.5 leading-snug font-rajdhani">
        {subtitle}
      </p>
    </div>
  );
}

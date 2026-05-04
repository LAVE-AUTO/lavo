'use client';

import { useTranslations } from 'next-intl';

interface Props {
  endpoints: string[];
}

export function BackendMissingBanner({ endpoints }: Props) {
  const t = useTranslations('station_config');

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-amber-300/40 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-950/15"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#D97706"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] font-bold text-amber-800 dark:text-amber-300">
          {t('backend_missing_title')}
        </p>
        <p className="text-[12px] leading-snug text-amber-800/80 dark:text-amber-300/80">
          {t('backend_missing_desc')}
        </p>
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {endpoints.map((ep) => (
            <li
              key={ep}
              className="font-mono text-[11px] font-semibold text-amber-900/70 dark:text-amber-300/70"
            >
              {ep}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

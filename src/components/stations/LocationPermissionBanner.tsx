'use client';

import { useTranslations } from 'next-intl';
import { useGeolocationBanner } from './useUserLocation';

function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * In-app pre-prompt for the browser geolocation permission.
 * Renders only when the Permissions API reports `prompt` and the user
 * has not dismissed it this session. Clicking "Activer" triggers the
 * native browser dialog via `requestUserLocation()`.
 */
export function LocationPermissionBanner() {
  const t = useTranslations('location_banner');
  const { visible, request, dismiss } = useGeolocationBanner();

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="loc-banner-title"
      className="relative overflow-hidden rounded-xl border border-gold/25 bg-linear-to-br from-gold/[0.08] via-white to-white dark:from-gold/[0.12] dark:via-dark-card dark:to-dark-card backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] mb-4 animate-fade-in-up"
    >
      {/* Gold accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-gold to-transparent" aria-hidden="true" />

      {/* Dismiss */}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('aria_close')}
        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-[#666] dark:text-[#7a9a7d] hover:text-[#c8980a] hover:bg-gold/10 transition-colors"
      >
        <CloseIcon />
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 sm:p-6 pr-12">
        {/* Icon */}
        <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-[#c8980a]">
          <PinIcon />
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <h3 id="loc-banner-title" className="text-[15px] sm:text-[16px] font-bold text-[#1a1a1a] dark:text-[#fef9e7] leading-tight">
            {t('title')}
          </h3>
          <p className="mt-1 text-[13px] sm:text-[14px] text-[#4a6a4d] dark:text-[#a0c0a3] leading-relaxed">
            {t('description')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:flex-col sm:items-stretch sm:shrink-0 sm:w-[160px]">
          <button
            type="button"
            onClick={request}
            className="btn-shine inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#c8980a] hover:bg-[#e8b520] rounded-md text-[13px] font-bold uppercase tracking-[0.6px] text-[#0d1f0f] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(200,152,10,0.4)]"
          >
            {t('cta_allow')}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-2.5 rounded-md text-[13px] font-semibold text-[#4a6a4d] dark:text-[#a0c0a3] hover:text-[#c8980a] dark:hover:text-[#c8980a] transition-colors"
          >
            {t('cta_dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}

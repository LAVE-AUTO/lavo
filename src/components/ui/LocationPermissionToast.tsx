'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context';
import { useGeolocationBanner } from '@/components/stations/useUserLocation';

interface LocationPermissionToastProps {
  /** Auto-dismiss duration in ms. Default 10 000 ms. */
  duration?: number;
}

/**
 * Bottom-right toast that prompts authenticated users to activate geolocation.
 * Shown once per session to users who haven't granted browser location access.
 * Auto-dismisses after `duration` ms with a shrinking progress bar.
 */
export function LocationPermissionToast({ duration = 10_000 }: LocationPermissionToastProps) {
  const t = useTranslations('location_toast');
  const { isAuthenticated, isLoading, isClient } = useAuth();
  const { visible, request, dismiss } = useGeolocationBanner();

  const [progress, setProgress] = useState(100);
  const startRef = useRef<number | null>(null);
  const rafRef   = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) {
      setProgress(100);
      return;
    }
    startRef.current = performance.now();

    const tick = () => {
      if (startRef.current === null) return;
      const elapsed = performance.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        dismiss();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, duration, dismiss]);

  /* Distance-to-station only matters for clients browsing stations.
   * Admin and station accounts must never be prompted for geolocation. */
  if (isLoading || !isAuthenticated || !isClient || !visible) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-20 right-4 sm:bottom-6 z-[200] w-[300px] sm:w-[340px] max-w-[calc(100vw-2rem)] bg-white dark:bg-surface rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.16)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.55)] border border-[#E0E0D0] dark:border-border overflow-hidden animate-fade-in-up"
    >
      {/* Row 1 — icon + title */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-1.5">
        <span className="shrink-0 w-8 h-8 rounded-xl bg-gold/15 flex items-center justify-center text-[#DDAF3B]" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </span>
        <p className="text-[14px] sm:text-[17px] font-black text-[#001201] dark:text-white leading-tight">
          {t('title')}
        </p>
      </div>

      {/* Row 2 — description spanning full width */}
      <p className="px-4 pb-3 text-[11.5px] sm:text-[12.5px] text-foreground/65 dark:text-[#B0BFB1] leading-snug">
        {t('desc')}
      </p>

      {/* Row 3 — close + activate buttons */}
      <div className="flex gap-2 px-4 pb-4">
        <button
          type="button"
          onClick={dismiss}
          className="flex-1 py-2 rounded-xl border border-gold/55 text-[12.5px] font-bold text-[#DDAF3B] hover:bg-gold/8 transition-colors cursor-pointer"
        >
          {t('btn_close')}
        </button>
        <button
          type="button"
          onClick={() => void request()}
          className="flex-1 py-2 rounded-xl bg-gold hover:bg-gold-hover text-[12.5px] font-black text-dark-bg transition-colors cursor-pointer"
        >
          {t('btn_activate')}
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] bg-surface dark:bg-tab-inactive">
        <div
          className="h-full bg-gold"
          style={{ width: `${progress}%`, transition: 'none' }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

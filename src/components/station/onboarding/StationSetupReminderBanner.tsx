'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useStationSetupStatus } from './useStationSetupStatus';
import { SETUP_STEPS } from './setup-steps';

/** ~12 min — within the requested 10-15 min cadence. */
const REMINDER_INTERVAL_MS = 12 * 60 * 1000;

/**
 * Discreet, premium top banner that periodically reminds a logged-in merchant
 * of the next station-setup step while their configuration is incomplete.
 *
 * Every interval it re-reads the live status (so completed steps drop out) and
 * rotates to the next remaining step. Dismissing hides it until the next tick.
 * Renders nothing once setup is complete.
 */
export function StationSetupReminderBanner() {
  const t = useTranslations('station_dashboard');
  const { loading, status, allDone, refetch } = useStationSetupStatus();
  const [visible, setVisible] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (allDone) return;
    const id = setInterval(() => {
      void refetch().then(() => {
        setRotation((r) => r + 1);
        setVisible(true);
      });
    }, REMINDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [allDone, refetch]);

  if (loading || allDone || !visible) return null;

  const incomplete = SETUP_STEPS.filter((s) => !status[s.key]);
  if (incomplete.length === 0) return null;

  const step = incomplete[rotation % incomplete.length];

  return (
    <div
      role="status"
      className="animate-fade-in mx-4 mt-3 flex items-center gap-3 rounded-xl border border-[#DDAF3B]/30 bg-[#FFF7E2] px-4 py-2.5 shadow-sm dark:border-[#DDAF3B]/25 dark:bg-[#1A2210] sm:mx-5"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DDAF3B]/15 text-[#9A7A13] dark:text-[#DDAF3B]">
        {step.icon}
      </span>
      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#001201] dark:text-[#FFF9EC]">
        {t('onboarding_reminder', { step: t(`onboarding_${step.key}`) })}
      </p>
      <Link
        href={step.href}
        className="shrink-0 rounded-lg bg-[#DDAF3B] px-3 py-1.5 text-[12px] font-black text-[#001201] transition-colors hover:bg-[#d8b35d]"
      >
        {t('onboarding_configure')}
      </Link>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label={t('onboarding_reminder_dismiss')}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-black/5 hover:text-foreground dark:text-[#B0BFB1] dark:hover:bg-white/10"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

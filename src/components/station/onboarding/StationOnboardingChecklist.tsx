'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useStationSetupStatus, type SetupStepKey } from './useStationSetupStatus';

interface StepMeta {
  key: SetupStepKey;
  href: string;
  icon: ReactNode;
}

const PhotoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
  </svg>
);
const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const PostIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const ServiceIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 17l2-7h14l2 7" /><path d="M5 17v2h2v-2M17 17v2h2v-2" /><path d="M8 10V7a1 1 0 011-1h6a1 1 0 011 1v3" />
  </svg>
);
const PaymentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

const STEPS: StepMeta[] = [
  { key: 'photos', href: '/station/config?tab=commerce', icon: <PhotoIcon /> },
  { key: 'hours', href: '/station/config?tab=hours', icon: <ClockIcon /> },
  { key: 'posts', href: '/station/config?tab=capacity', icon: <PostIcon /> },
  { key: 'services', href: '/station/services', icon: <ServiceIcon /> },
  { key: 'payment', href: '/station/config?tab=payments', icon: <PaymentIcon /> },
];

/**
 * Premium setup checklist shown at the top of the station dashboard while the
 * merchant has not finished configuring their station. Renders nothing once
 * every step is complete, so it naturally reappears on each visit until done.
 */
export function StationOnboardingChecklist() {
  const t = useTranslations('station_dashboard');
  const { loading, status, completed, total, allDone } = useStationSetupStatus();

  if (loading || allDone) return null;

  const nextStep = STEPS.find((s) => !status[s.key]);
  const pct = Math.round((completed / total) * 100);

  return (
    <section className="mx-4 mt-4 mb-1 overflow-hidden rounded-2xl border border-[#DDAF3B]/30 bg-gradient-to-br from-[#FFF9EC] to-[#F7F0DA] shadow-[0_10px_40px_-12px_rgba(221,175,59,0.25)] dark:border-[#DDAF3B]/25 dark:from-[#1A2210] dark:to-[#141C12] sm:mx-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="text-[16px] font-black text-[#001201] dark:text-[#FFF9EC]">{t('onboarding_title')}</h2>
          <p className="mt-0.5 text-[13px] text-foreground/65 dark:text-[#B0BFB1]">{t('onboarding_desc')}</p>
        </div>
        {nextStep && (
          <Link
            href={nextStep.href}
            className="btn-shine shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#DDAF3B] px-4 py-2 text-[13px] font-black text-[#001201] transition-colors hover:bg-[#d8b35d]"
          >
            {t('onboarding_cta')}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3">
        <div className="flex items-center justify-between text-[11px] font-bold text-foreground/55 dark:text-[#B0BFB1]">
          <span>{t('onboarding_progress', { done: completed, total })}</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E4DCC2] dark:bg-[#0E1409]">
          <div
            className="h-full rounded-full bg-[#DDAF3B] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <ul className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step) => {
          const done = status[step.key];
          return (
            <li
              key={step.key}
              className={[
                'flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                done
                  ? 'border-[#22C47A]/35 bg-[#22C47A]/8 dark:bg-[#22C47A]/10'
                  : 'border-separator/30 bg-card-surface dark:border-[#1A2A14] dark:bg-[#182214]',
              ].join(' ')}
            >
              {/* Status circle */}
              <span
                aria-hidden="true"
                className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2',
                  done ? 'border-[#22C47A] bg-[#22C47A] text-white' : 'border-[#C8C8B4] text-foreground/45 dark:border-[#3A4A30]',
                ].join(' ')}
              >
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.icon
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-[#001201] dark:text-[#FFF9EC]">{t(`onboarding_${step.key}`)}</p>
                <p className={`text-[11px] font-bold ${done ? 'text-[#16A964] dark:text-[#3FD98A]' : 'text-foreground/50 dark:text-[#B0BFB1]'}`}>
                  {done ? t('onboarding_step_done') : t('onboarding_step_todo')}
                </p>
              </div>

              {!done && (
                <Link
                  href={step.href}
                  aria-label={`${t('onboarding_configure')} — ${t(`onboarding_${step.key}`)}`}
                  className="shrink-0 rounded-lg border border-[#DDAF3B]/40 px-2.5 py-1.5 text-[11.5px] font-bold text-[#9A7A13] transition-colors hover:bg-[#DDAF3B]/10 dark:text-[#DDAF3B]"
                >
                  {t('onboarding_configure')}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

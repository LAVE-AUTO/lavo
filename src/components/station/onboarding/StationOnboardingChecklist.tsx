'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useStationSetupStatus } from './useStationSetupStatus';
import { SETUP_STEPS } from './setup-steps';

/**
 * Premium setup checklist shown at the top of the station dashboard while the
 * merchant has not finished configuring their station. Renders nothing once
 * every step is complete, so it naturally reappears on each visit until done.
 */
export function StationOnboardingChecklist() {
  const t = useTranslations('station_dashboard');
  const { loading, error, status, completed, total, allDone, refetch } = useStationSetupStatus();

  if (loading || allDone) return null;

  /* Total failure: showing an all-empty checklist would wrongly suggest a
   * fully-configured station has done nothing. Surface the error + retry. */
  if (error && completed === 0) {
    return (
      <section className="mx-4 mt-4 mb-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DDAF3B]/30 bg-[#FFF9EC] px-5 py-4 dark:border-[#DDAF3B]/25 dark:bg-[#1A2210] sm:mx-5">
        <p className="text-[13px] font-semibold text-[#001201] dark:text-[#FFF9EC]">{t('onboarding_load_error')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="shrink-0 rounded-lg border border-[#DDAF3B]/40 px-3 py-1.5 text-[12px] font-bold text-[#9A7A13] transition-colors hover:bg-[#DDAF3B]/10 dark:text-[#DDAF3B]"
        >
          {t('onboarding_retry')}
        </button>
      </section>
    );
  }

  const nextStep = SETUP_STEPS.find((s) => !status[s.key]);
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

      {/* Partial load failure: keep the steps that did load, but let the
          merchant retry the ones that didn't instead of trusting them blindly. */}
      {error && (
        <div className="mx-5 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DDAF3B]/25 bg-[#DDAF3B]/8 px-3.5 py-2">
          <span className="text-[12px] font-semibold text-[#9A7A13] dark:text-[#DDAF3B]">{t('onboarding_load_error_partial')}</span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="shrink-0 text-[12px] font-bold text-[#9A7A13] underline-offset-2 hover:underline dark:text-[#DDAF3B]"
          >
            {t('onboarding_retry')}
          </button>
        </div>
      )}

      {/* Steps */}
      <ul className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {SETUP_STEPS.map((step) => {
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

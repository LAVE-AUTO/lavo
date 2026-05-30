'use client';

import { useTranslations } from 'next-intl';

interface StepperHeaderProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { key: 'step_account_label' as const, number: 1 },
  { key: 'step_commerce_label' as const, number: 2 },
  { key: 'step_documents_label' as const, number: 3 },
];

/**
 * 3-step visual progress indicator for the station onboarding form.
 * Marks each step as done, active, or inactive.
 */
export function StepperHeader({ currentStep }: StepperHeaderProps) {
  const t = useTranslations('station_apply');

  return (
    <div className="flex items-center justify-center mb-8 px-4">
      {STEPS.map(({ key, number }, idx) => {
        const isDone   = number < currentStep;
        const isActive = number === currentStep;

        return (
          <div key={number} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'w-9 h-9 rounded-full flex items-center justify-center font-bold text-[15px] transition-colors duration-200',
                  isDone
                    ? 'bg-gold text-dark-bg'
                    : isActive
                    ? 'bg-gold text-dark-bg ring-4 ring-gold/20'
                    : 'bg-[#CCCCCC] dark:bg-[#001A05] text-foreground/55 dark:text-Hurryline-muted',
                ].join(' ')}
                aria-current={isActive ? 'step' : undefined}
              >
                {isDone ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  number
                )}
              </div>
              <span className={[
                'text-[12px] font-semibold tracking-wide whitespace-nowrap',
                isActive ? 'text-gold' : isDone ? 'text-foreground/70 dark:text-Hurryline-muted' : 'text-[#AAAAAA] dark:text-[#3A4A36]',
              ].join(' ')}>
                {t(key)}
              </span>
            </div>

            {idx < STEPS.length - 1 && (
              <div className={[
                'mx-3 mb-5 h-[2px] w-12 sm:w-20 rounded-full transition-colors duration-200',
                number < currentStep ? 'bg-gold' : 'bg-[#CCCCCC] dark:bg-[#001A05]',
              ].join(' ')} aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

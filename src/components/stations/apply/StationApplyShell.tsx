'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { StationBrandPanel } from './StationBrandPanel';
import { StationApplyForm } from './StationApplyForm';
import { AuthModeSwitcher } from '@/components/auth/AuthModeSwitcher';
import { TabSwitcher } from '@/components/auth/TabSwitcher';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';
import { type WashTypeOption } from './StepCommerce';

interface StationApplyShellProps {
  washTypes: WashTypeOption[];
}

/**
 * Client wrapper for the station apply page.
 * Manages shared step state so the brand panel can animate per-step.
 */
export function StationApplyShell({ washTypes }: StationApplyShellProps) {
  const t = useTranslations('station_apply');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel - desktop only */}
      <aside className="hidden lg:block lg:w-[42%] xl:w-[45%] shrink-0 sticky top-0 h-screen">
        <StationBrandPanel step={currentStep} />
      </aside>

      {/* Right form panel */}
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen auth-form-bg overflow-y-auto scroll-smooth px-6 py-10">
        <div className="w-full max-w-2xl animate-fade-in">
          {/* Desktop controls */}
          <div className="hidden lg:flex justify-end gap-2 mb-4">
            <ThemeToggle />
            <LangToggle />
          </div>

          {/* Mobile top bar */}
          <div className="flex items-center justify-between mb-5 lg:hidden">
            <span className="text-[16px] font-bold text-dark-bg dark:text-white tracking-wide">Slowtime</span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LangToggle />
            </div>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-[26px] sm:text-[30px] font-bold text-dark-bg dark:text-white mb-2">
              {t('heading')}
            </h1>
            <p className="text-[15px] text-[#555] dark:text-lavo-muted">
              {t('subheading')}
            </p>
          </div>

          <AuthModeSwitcher mode="merchant" />

          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08),_0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-gold/10 py-8 px-6 sm:px-8 animate-fade-in-up">
            <div className="-mt-2 mb-6">
              <TabSwitcher
                activeTab="register"
                loginLabel={t('tab_login')}
                registerLabel={t('tab_register')}
                loginHref="/station/login"
                registerHref="/station/apply"
              />
            </div>
            <StationApplyForm washTypes={washTypes} onStepChange={setCurrentStep} />
          </div>
        </div>
      </main>
    </div>
  );
}

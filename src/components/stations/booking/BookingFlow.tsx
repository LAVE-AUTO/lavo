'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ExtrasStep } from './ExtrasStep';
import { ArrivalStep } from './ArrivalStep';
import { SummaryStep } from './SummaryStep';
import { PaymentStep } from './PaymentStep';
import type { StationDetailData, ServiceCategory, ServiceForfait, ServiceExtra, TimeSlot } from '@/types/station';

type ArrivalMode = 'queue_now' | 'queue_later' | 'book_slot';

interface BookingFlowProps {
  station: StationDetailData;
  category: ServiceCategory;
  forfait: ServiceForfait;
  onClose: () => void;
}

const STEPS = ['extras', 'arrival', 'summary', 'payment'] as const;
type Step = (typeof STEPS)[number];

export function BookingFlow({ station, category, forfait, onClose }: BookingFlowProps) {
  const t = useTranslations('booking');
  const [step, setStep] = useState<Step>('extras');
  const stepIndex = STEPS.indexOf(step);

  // Payment result
  const [paymentResult, setPaymentResult] = useState<'success' | 'error' | null>(null);

  // Extras state
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);

  // Arrival state
  const [arrivalMode, setArrivalMode] = useState<ArrivalMode | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [laterTime, setLaterTime] = useState<string | null>(null);

  const selectedExtras = station.extras.filter((e) => selectedExtraIds.includes(e.id));
  const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
  const extrasDuration = selectedExtras.reduce((sum, e) => sum + e.duration, 0);
  const grandTotal = forfait.price + extrasTotal;
  const totalDuration = forfait.duration + extrasDuration;

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const toggleExtra = useCallback((id: string) => {
    setSelectedExtraIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const goNext = useCallback(() => {
    const next = stepIndex + 1;
    if (next < STEPS.length) setStep(STEPS[next]);
  }, [stepIndex]);

  const goBack = useCallback(() => {
    const prev = stepIndex - 1;
    if (prev >= 0) setStep(STEPS[prev]);
  }, [stepIndex]);

  const handleSkipExtras = useCallback(() => {
    setSelectedExtraIds([]);
    setStep('arrival');
  }, []);

  const handleArrivalSetMode = useCallback((mode: ArrivalMode) => {
    setArrivalMode(mode);
    if (mode !== 'queue_later') setLaterTime(null);
    if (mode !== 'book_slot') {
      setSelectedDate(null);
      setSelectedSlot(null);
    }
  }, []);

  const handleArrivalSetDate = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  }, []);

  const handlePaymentConfirm = useCallback(() => {
    // Simulate: 90% success, 10% failure
    const success = Math.random() > 0.1;
    setPaymentResult(success ? 'success' : 'error');
  }, []);

  const handleRetryPayment = useCallback(() => {
    setPaymentResult(null);
  }, []);

  // Step labels for progress indicator
  const stepLabels = [
    t('step_extras'),
    t('step_arrival'),
    t('step_summary'),
    t('step_payment'),
  ];

  const renderStep = () => {
    switch (step) {
      case 'extras':
        return (
          <ExtrasStep
            forfait={forfait}
            extras={station.extras}
            selectedExtras={selectedExtraIds}
            onToggleExtra={toggleExtra}
            onContinue={goNext}
            onSkip={handleSkipExtras}
          />
        );
      case 'arrival':
        return (
          <ArrivalStep
            station={station}
            arrivalMode={arrivalMode}
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            laterTime={laterTime}
            onSetMode={handleArrivalSetMode}
            onSetDate={handleArrivalSetDate}
            onSetSlot={setSelectedSlot}
            onSetLaterTime={setLaterTime}
            onContinue={goNext}
            onBack={goBack}
          />
        );
      case 'summary':
        return (
          <SummaryStep
            station={station}
            forfait={forfait}
            selectedExtras={selectedExtras}
            arrivalMode={arrivalMode!}
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            laterTime={laterTime}
            grandTotal={grandTotal}
            totalDuration={totalDuration}
            onContinue={goNext}
            onBack={goBack}
          />
        );
      case 'payment':
        return (
          <PaymentStep
            grandTotal={grandTotal}
            onConfirm={handlePaymentConfirm}
            onBack={goBack}
          />
        );
    }
  };

  // Payment result screen
  const renderResultScreen = () => {
    const isSuccess = paymentResult === 'success';
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-12 gap-5">
        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isSuccess ? 'bg-lavo-success/15' : 'bg-lavo-error/15'}`}>
          {isSuccess ? (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          )}
        </div>

        <h3 className="text-[22px] font-black text-[#000C1F] dark:text-[#FFF8EC]">
          {isSuccess ? t('result_success_title') : t('result_error_title')}
        </h3>
        <p className="text-[15px] text-[#555] dark:text-[#B0B0A0] max-w-sm leading-relaxed">
          {isSuccess ? t('result_success_desc') : t('result_error_desc')}
        </p>

        {isSuccess && (
          <div className="bg-gold/10 dark:bg-gold/5 border-2 border-gold rounded-xl px-5 py-3 mt-2">
            <span className="text-[18px] font-black text-gold">{grandTotal}$</span>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
          {isSuccess ? (
            <>
              <Link
                href="/client/reservations"
                className="block w-full py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg text-center transition-colors cursor-pointer"
              >
                {t('result_view_coupons')}
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
              >
                {t('result_done')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
              >
                {t('close')}
              </button>
              <button
                type="button"
                onClick={handleRetryPayment}
                className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg transition-colors cursor-pointer"
              >
                {t('result_retry')}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // If payment result is shown, render the result screen
  if (paymentResult) {
    return (
      <>
        {/* Desktop */}
        <div className="hidden md:flex fixed inset-0 z-[60] items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#F5F5E6] dark:bg-[#1A1A18] rounded-2xl shadow-2xl">
            {renderResultScreen()}
          </div>
        </div>
        {/* Mobile */}
        <div className="md:hidden fixed inset-0 z-[60] bg-[#F5F5E6] dark:bg-[#1A1A18] flex items-center justify-center">
          {renderResultScreen()}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop: Modal overlay */}
      <div className="hidden md:flex fixed inset-0 z-[60] items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="relative w-full max-w-2xl bg-[#F5F5E6] dark:bg-[#1A1A18] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-5 pb-4 border-b border-[#D0D0C0] dark:border-tab-inactive">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-black text-[#000C1F] dark:text-[#FFF8EC]">
                {t('booking_title')}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#E8E8D8] dark:bg-tab-inactive flex items-center justify-center hover:bg-[#D0D0C0] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Progress steps */}
            <div className="flex items-center gap-1">
              {STEPS.map((s, i) => (
                <div key={s} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`h-1 w-full rounded-full transition-colors ${
                    i <= stepIndex ? 'bg-gold' : 'bg-[#D0D0C0] dark:bg-tab-inactive'
                  }`} />
                  <span className={`text-[11px] font-bold ${
                    i === stepIndex ? 'text-gold' : 'text-[#888]'
                  }`}>
                    {stepLabels[i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            {renderStep()}
          </div>
        </div>
      </div>

      {/* Mobile: Full screen */}
      <div className="md:hidden fixed inset-0 z-[60] bg-[#F5F5E6] dark:bg-[#1A1A18] flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-[#D0D0C0] dark:border-tab-inactive safe-area-top">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={stepIndex === 0 ? onClose : goBack}
              className="flex items-center gap-1 text-gold text-[14px] font-bold cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              {stepIndex === 0 ? t('close') : t('back')}
            </button>
            <span className="text-[13px] font-bold text-[#555] dark:text-[#A0A090]">
              {stepIndex + 1}/{STEPS.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  i <= stepIndex ? 'bg-gold' : 'bg-[#D0D0C0] dark:bg-tab-inactive'
                }`}
              />
            ))}
          </div>

          <h2 className="text-[17px] font-black text-[#000C1F] dark:text-[#FFF8EC] mt-3">
            {stepLabels[stepIndex]}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-6">
          {renderStep()}
        </div>
      </div>
    </>
  );
}

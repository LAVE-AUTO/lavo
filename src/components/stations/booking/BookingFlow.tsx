'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ExtrasStep } from './ExtrasStep';
import { ArrivalStep } from './ArrivalStep';
import { SummaryStep } from './SummaryStep';
import { PaymentStep } from './PaymentStep';
import { useUserLocation } from '../useUserLocation';
import { postWithApi } from '@/services/axios-service';
import { RESERVATIONS_MOCK_ENABLED } from '@/data/reservations-mock';
import type { StationDetailData, ServiceCategory, ServiceForfait, TimeSlot } from '@/types/station';

type ArrivalMode = 'queue_now' | 'queue_later' | 'book_slot';

interface BookingFlowProps {
  station: StationDetailData;
  category: ServiceCategory;
  forfait: ServiceForfait;
  qrToken?: string | null;
  qrVersion?: '1' | null;
  onClose: () => void;
}

const STEPS = ['extras', 'arrival', 'summary', 'payment'] as const;
type Step = (typeof STEPS)[number];

export function BookingFlow({ station, forfait, qrToken, qrVersion, onClose }: BookingFlowProps) {
  const t = useTranslations('booking');
  const userLocation = useUserLocation();
  const [step, setStep] = useState<Step>('extras');
  const stepIndex = STEPS.indexOf(step);
  const dialogRootRef = useRef<HTMLDivElement | null>(null);

  // Payment result
  const [paymentResult, setPaymentResult] = useState<'success' | 'error' | null>(null);

  // Reservation creation (book_slot only)
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

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

  // Lock body scroll and basic keyboard handling (Escape + initial focus)
  useEffect(() => {
    document.body.style.overflow = 'hidden';

    const dialogEl = dialogRootRef.current;
    if (dialogEl) {
      const focusable = dialogEl.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

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

  const devSkipPayment =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_DEV_SKIP_PAYMENT === 'true';

  // Called at SummaryStep "Passer au paiement":
  // - book_slot (real): creates reservation → gets client_secret → navigates to payment
  // - book_slot (devSkipPayment): skip API call, navigate directly
  // - queue modes (real): joins queue → gets client_secret → navigates to Stripe card form
  // - queue modes (devSkipPayment): navigate directly (API called later in handlePaymentConfirm)
  const handleSummaryContinue = useCallback(async () => {
    // Reset stale client secret so PaymentStep always renders the correct form.
    setClientSecret(null);
    setSummaryError(null);

    if (RESERVATIONS_MOCK_ENABLED) {
      goNext();
      return;
    }

    const isQueueMode = arrivalMode === 'queue_now' || arrivalMode === 'queue_later';

    if (isQueueMode) {
      if (devSkipPayment) {
        goNext();
        return;
      }
      setSummaryLoading(true);
      const [ok, data] = await postWithApi<{ data: { client_secret: string } }>(
        `/stations/${station.id}/queue/join`,
        { vehicle_format_id: forfait.id },
      );
      setSummaryLoading(false);
      if (!ok) {
        const errData = data as { code?: string } | null;
        if (errData?.code === 'CONFLICT') {
          setSummaryError(t('error_active_queue_entry'));
        } else {
          setSummaryError(t('error_queue_join_failed'));
        }
        return;
      }
      const queueData = data as { data: { client_secret: string } };
      setClientSecret(queueData.data?.client_secret ?? null);
      goNext();
      return;
    }

    // book_slot
    if (devSkipPayment) {
      goNext();
      return;
    }
    if (!selectedSlot) return;
    setSummaryLoading(true);
    const reservationPayload: Record<string, string> = {
      time_slot_id: selectedSlot.id,
      vehicle_format_id: forfait.id,
    };
    const hasValidQrContext = Boolean(qrToken && qrVersion === '1');
    if (hasValidQrContext) {
      reservationPayload.qr_token = qrToken!;
      reservationPayload.v = qrVersion!;
    }
    const [ok, data] = await postWithApi<{ data: { reservation_id: string; stripe_client_secret: string } }>(
      `/stations/${station.id}/reservations`,
      reservationPayload,
    );
    setSummaryLoading(false);
    if (!ok) {
      const errData = data as { code?: string } | null;
      if (errData?.code === 'SLOT_FULL') {
        setSummaryError(t('error_slot_full'));
      } else if (errData?.code === 'ACTIVE_RESERVATION_EXISTS') {
        setSummaryError(t('error_active_reservation'));
      } else {
        setSummaryError(t('error_reservation_failed'));
      }
      return;
    }
    const resData = data as { data: { stripe_client_secret: string } };
    setClientSecret(resData.data?.stripe_client_secret ?? null);
    goNext();
  }, [arrivalMode, station.id, forfait.id, selectedSlot, qrToken, qrVersion, devSkipPayment, goNext, t]);

  const handlePaymentConfirm = useCallback(async (): Promise<void> => {
    // TODO: remove mock block once Stripe is fully live in production
    if (RESERVATIONS_MOCK_ENABLED) {
      setPaymentResult('success');
      return;
    }

    const isQueueMode = arrivalMode === 'queue_now' || arrivalMode === 'queue_later';

    if (isQueueMode) {
      if (devSkipPayment) {
        // Dev bypass: call queue join directly (no Stripe payment)
        const [ok] = await postWithApi(`/stations/${station.id}/queue/join`, {
          vehicle_format_id: forfait.id,
        });
        setPaymentResult(ok ? 'success' : 'error');
      } else {
        // Stripe payment was confirmed in StripeCardForm via confirmCardPayment;
        // the PaymentIntent webhook updates the entry server-side.
        setPaymentResult('success');
      }
    } else if (arrivalMode === 'book_slot') {
      if (devSkipPayment && selectedSlot) {
        // Dev bypass: create confirmed reservation directly (skips Stripe)
        const hasValidQrContext = Boolean(qrToken && qrVersion === '1');
        const payload = {
          station_id: station.id,
          time_slot_id: selectedSlot.id,
          vehicle_format_id: forfait.id,
          ...(hasValidQrContext ? { qr_token: qrToken!, v: qrVersion! } : {}),
        };
        const [ok] = await postWithApi('/dev/reservations', payload);
        setPaymentResult(ok ? 'success' : 'error');
      } else {
        // Stripe payment was confirmed in StripeCardForm via confirmCardPayment;
        // the PaymentIntent webhook updates the reservation server-side.
        setPaymentResult('success');
      }
    }
  }, [arrivalMode, station.id, forfait.id, selectedSlot, qrToken, qrVersion, devSkipPayment]);

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
            loading={summaryLoading}
            error={summaryError}
            onContinue={handleSummaryContinue}
            onBack={goBack}
          />
        );
      case 'payment':
        return (
          <PaymentStep
            grandTotal={grandTotal}
            clientSecret={clientSecret}
            onConfirm={handlePaymentConfirm}
            onBack={goBack}
          />
        );
    }
  };

  // Google Maps itinerary URL
  const mapsUrl = (() => {
    const dest =
      station.latitude != null && station.longitude != null
        ? `${station.latitude},${station.longitude}`
        : encodeURIComponent(`${station.name}, ${station.address}, ${station.city}`);
    const origin =
      userLocation
        ? `&origin=${userLocation.latitude},${userLocation.longitude}`
        : '';
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}`;
  })();

  // Payment result screen (context-aware on success)
  const renderResultScreen = () => {
    const isSuccess = paymentResult === 'success';
    const isQueueNow = arrivalMode === 'queue_now';

    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-12 gap-5">
        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isSuccess ? 'bg-lavo-success/15' : 'bg-lavo-error/15'}`}>
          {isSuccess ? (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#E8472A" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          )}
        </div>

        <h3
          id="booking-result-title"
          className="text-[22px] font-black text-[#000C1F] dark:text-[#FFF8EC]"
        >
          {isSuccess ? t('result_success_title') : t('result_error_title')}
        </h3>
        <p className="text-[15px] text-[#555] dark:text-[#B0B0A0] max-w-sm leading-relaxed">
          {isSuccess
            ? isQueueNow ? t('result_queue_now_desc') : t('result_success_desc')
            : t('result_error_desc')}
        </p>

        {/* Amount badge */}
        {isSuccess && (
          <div className="bg-gold/10 dark:bg-gold/5 border-2 border-gold rounded-xl px-5 py-3">
            <span className="text-[18px] font-black text-gold">{grandTotal}$</span>
          </div>
        )}

        {/* Queue position info for non-now queue */}
        {isSuccess && !isQueueNow && arrivalMode === 'queue_later' && (
          <div className="bg-[#E8E8D8] dark:bg-dark-surface rounded-xl px-5 py-4 w-full max-w-xs text-left border border-[#D0D0C0] dark:border-tab-inactive">
            <div className="text-[13px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-2">
              {t('result_queue_position_label')}
            </div>
            <div className="text-[26px] font-black text-gold leading-none">#{station.queueCount + 1}</div>
            <div className="text-[13px] text-[#555] dark:text-[#B0B0A0] mt-1">{t('result_queue_arrival_time', { time: laterTime ?? '' })}</div>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
          {isSuccess ? (
            isQueueNow ? (
              <>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg text-center transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {t('result_open_maps')}
                </a>
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
                <Link
                  href="/client/reservations"
                  className="block w-full py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg text-center transition-colors"
                >
                  {t('result_view_reservations')}
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
                >
                  {t('result_done')}
                </button>
              </>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={handleRetryPayment}
                className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg transition-colors cursor-pointer"
              >
                {t('result_retry')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
              >
                {t('close')}
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
          <div
            className="relative w-full max-w-md bg-[#F5F5E6] dark:bg-dark-card rounded-2xl shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-result-title"
          >
            {renderResultScreen()}
          </div>
        </div>
        {/* Mobile */}
        <div className="md:hidden fixed inset-0 z-[60] bg-[#F5F5E6] dark:bg-dark-card flex items-center justify-center">
          {renderResultScreen()}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop: Modal overlay */}
        <div className="hidden md:flex fixed inset-0 z-[60] items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            ref={dialogRootRef}
            className="relative w-full max-w-2xl bg-[#F5F5E6] dark:bg-dark-card rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-dialog-title-desktop"
          >
          {/* Header */}
          <div className="p-5 pb-4 border-b border-[#D0D0C0] dark:border-tab-inactive">
            <div className="flex items-center justify-between mb-4">
              <h2
                id="booking-dialog-title-desktop"
                className="text-[18px] font-black text-[#000C1F] dark:text-[#FFF8EC]"
              >
                {t('booking_title')}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#E8E8D8] dark:bg-tab-inactive flex items-center justify-center hover:bg-[#D0D0C0] transition-colors cursor-pointer"
                aria-label={t('close')}
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
      <div
        className="md:hidden fixed inset-0 z-[60] bg-[#F5F5E6] dark:bg-dark-card flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-dialog-title-mobile"
      >
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

          <h2
            id="booking-dialog-title-mobile"
            className="text-[17px] font-black text-[#000C1F] dark:text-[#FFF8EC] mt-3"
          >
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

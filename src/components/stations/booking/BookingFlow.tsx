'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ServiceSelectionStep } from './ServiceSelectionStep';
import { FormatSelectionStep } from './FormatSelectionStep';
import { ExtrasStep } from './ExtrasStep';
import { ArrivalStep } from './ArrivalStep';
import { SummaryStep } from './SummaryStep';
import { PaymentStep } from './PaymentStep';
import { BookingReceipt, generateTicketCode } from './BookingReceipt';
import { useUserLocation } from '../useUserLocation';
import { postWithApi } from '@/services/axios-service';
import { RESERVATIONS_MOCK_ENABLED } from '@/data/reservations-mock';
import type {
  StationDetailData,
  StationServicePublic,
  StationServiceEntry,
  TimeSlot,
} from '@/types/station';

type ArrivalMode = 'queue_now' | 'queue_later' | 'book_slot';
type Step = 'service' | 'format' | 'extras' | 'arrival' | 'summary' | 'payment';

const ALL_STEPS: Step[] = ['service', 'format', 'extras', 'arrival', 'summary', 'payment'];

interface BookingFlowProps {
  station: StationDetailData;
  qrToken?: string | null;
  qrVersion?: '1' | null;
  onClose: () => void;
}

export function BookingFlow({ station, qrToken, qrVersion, onClose }: BookingFlowProps) {
  const t = useTranslations('booking');
  const userLocation = useUserLocation();
  const dialogRootRef = useRef<HTMLDivElement | null>(null);

  const [step, setStep] = useState<Step>('service');
  const [paymentResult, setPaymentResult] = useState<'success' | 'error' | null>(null);
  const [ticketCode, setTicketCode] = useState<string | null>(null);

  // Booking selections
  const [selectedService, setSelectedService] = useState<StationServicePublic | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<StationServiceEntry | null>(null);
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);

  // Arrival state
  const [arrivalMode, setArrivalMode] = useState<ArrivalMode | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [laterTime, setLaterTime] = useState<string | null>(null);

  // Summary/payment
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const needsFormat = selectedService?.category === 'hand_wash';
  const activeSteps = ALL_STEPS.filter((s) => s !== 'format' || needsFormat);
  const stepIndex = activeSteps.indexOf(step);

  const servicePrice = selectedEntry?.price ?? 0;
  const serviceDuration = selectedEntry?.duration ?? 0;
  const extras = selectedService?.extras ?? [];
  const selectedExtras = extras.filter((e) => selectedExtraIds.includes(e.id));
  const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
  const extrasDuration = selectedExtras.reduce((sum, e) => sum + e.duration, 0);
  const totalDuration = serviceDuration + extrasDuration;

  const reservationSurcharge = station.stationConfig?.reservationSurcharge ?? null;
  const surchargeAmount = arrivalMode === 'book_slot' ? (reservationSurcharge ?? 0) : 0;
  const grandTotal = servicePrice + extrasTotal + surchargeAmount;

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
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const goNext = useCallback(() => {
    const next = stepIndex + 1;
    if (next < activeSteps.length) setStep(activeSteps[next]);
  }, [stepIndex, activeSteps]);

  const goBack = useCallback(() => {
    const prev = stepIndex - 1;
    if (prev >= 0) setStep(activeSteps[prev]);
  }, [stepIndex, activeSteps]);

  const handleSelectService = useCallback((svc: StationServicePublic) => {
    setSelectedService(svc);
    setSelectedEntry(null);
    setSelectedExtraIds([]);
  }, []);

  const handleServiceContinue = useCallback(() => {
    if (selectedService && selectedService.category !== 'hand_wash') {
      // Auto-select first active entry for non-hand_wash services
      const firstEntry = selectedService.vehicleEntries[0] ?? null;
      setSelectedEntry(firstEntry);
    }
    goNext();
  }, [selectedService, goNext]);

  const handleSelectEntry = useCallback((entry: StationServiceEntry) => {
    setSelectedEntry(entry);
  }, []);

  const toggleExtra = useCallback((id: string) => {
    setSelectedExtraIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleSkipExtras = useCallback(() => {
    setSelectedExtraIds([]);
    setStep('arrival');
  }, []);

  const handleArrivalSetMode = useCallback((mode: ArrivalMode) => {
    setArrivalMode(mode);
    if (mode !== 'queue_later') setLaterTime(null);
    if (mode !== 'book_slot') { setSelectedDate(null); setSelectedSlot(null); }
  }, []);

  const handleArrivalSetDate = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  }, []);

  const devSkipPayment =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_DEV_SKIP_PAYMENT === 'true';

  const handleSummaryContinue = useCallback(async () => {
    setClientSecret(null);
    setSummaryError(null);

    if (RESERVATIONS_MOCK_ENABLED) { goNext(); return; }

    const isQueueMode = arrivalMode === 'queue_now' || arrivalMode === 'queue_later';

    if (isQueueMode) {
      if (devSkipPayment) { goNext(); return; }
      setSummaryLoading(true);
      const [ok, data] = await postWithApi<{ data: { client_secret: string; ticket_code?: string | null } }>(
        `/stations/${station.id}/queue/join`,
        {
          service_id: selectedService!.id,
          ...(selectedEntry?.vehicleFormatId ? { vehicle_format_id: selectedEntry.vehicleFormatId } : {}),
        },
      );
      setSummaryLoading(false);
      if (!ok) {
        const errData = data as { code?: string } | null;
        setSummaryError(
          errData?.code === 'CONFLICT' ? t('error_active_queue_entry') : t('error_queue_join_failed'),
        );
        return;
      }
      const queueData = data as { data: { client_secret: string; ticket_code?: string | null } };
      setClientSecret(queueData.data?.client_secret ?? null);
      setTicketCode(queueData.data?.ticket_code ?? null);
      goNext();
      return;
    }

    // book_slot - per-post availability flow: send start_time, server picks
    // the bay and creates the time_slot row atomically. selectedSlot.id holds
    // the ISO start_time returned by /stations/:id/availability.
    if (devSkipPayment) { goNext(); return; }
    if (!selectedSlot) return;
    setSummaryLoading(true);
    const reservationPayload: Record<string, string> = {
      start_time: selectedSlot.id,
      service_id: selectedService!.id,
    };
    if (selectedEntry?.vehicleFormatId) {
      reservationPayload.vehicle_format_id = selectedEntry.vehicleFormatId;
    }
    if (qrToken && qrVersion === '1') {
      reservationPayload.qr_token = qrToken;
      reservationPayload.v = qrVersion;
    }
    const [ok, data] = await postWithApi<{ data: { reservation_id: string; stripe_client_secret: string; ticket_code?: string | null } }>(
      `/stations/${station.id}/reservations`,
      reservationPayload,
    );
    setSummaryLoading(false);
    if (!ok) {
      const errData = data as { code?: string } | null;
      if (errData?.code === 'SLOT_FULL') setSummaryError(t('error_slot_full'));
      else if (errData?.code === 'ACTIVE_RESERVATION_EXISTS') setSummaryError(t('error_active_reservation'));
      else setSummaryError(t('error_reservation_failed'));
      return;
    }
    const resData = data as { data: { stripe_client_secret: string; ticket_code?: string | null } };
    setClientSecret(resData.data?.stripe_client_secret ?? null);
    setTicketCode(resData.data?.ticket_code ?? null);
    goNext();
  }, [arrivalMode, station.id, selectedService, selectedEntry, selectedSlot, qrToken, qrVersion, devSkipPayment, goNext, t]);

  const handlePaymentConfirm = useCallback(async (): Promise<void> => {
    if (RESERVATIONS_MOCK_ENABLED) { setPaymentResult('success'); return; }

    const isQueueMode = arrivalMode === 'queue_now' || arrivalMode === 'queue_later';

    if (isQueueMode) {
      if (devSkipPayment) {
        const [ok] = await postWithApi(`/stations/${station.id}/queue/join`, {
          service_id: selectedService!.id,
          ...(selectedEntry?.vehicleFormatId ? { vehicle_format_id: selectedEntry.vehicleFormatId } : {}),
        });
        setPaymentResult(ok ? 'success' : 'error');
      } else {
        setPaymentResult('success');
      }
    } else if (arrivalMode === 'book_slot') {
      if (devSkipPayment && selectedSlot) {
        const payload: Record<string, string> = {
          station_id: station.id,
          time_slot_id: selectedSlot.id,
          service_id: selectedService!.id,
        };
        if (selectedEntry?.vehicleFormatId) payload.vehicle_format_id = selectedEntry.vehicleFormatId;
        if (qrToken && qrVersion === '1') { payload.qr_token = qrToken; payload.v = qrVersion; }
        const [ok] = await postWithApi('/dev/reservations', payload);
        setPaymentResult(ok ? 'success' : 'error');
      } else {
        setPaymentResult('success');
      }
    }
  }, [arrivalMode, station.id, selectedService, selectedEntry, selectedSlot, qrToken, qrVersion, devSkipPayment]);

  /* The backend issues a ticket_code on entry creation and returns it in the
   * /queue/join and /reservations responses (see handleSummaryContinue).
   * Fallback to a locally-generated code only if the backend response did not
   * include one (legacy entries pre-migration, dev skip-payment path). */
  useEffect(() => {
    if (paymentResult === 'success' && !ticketCode) {
      setTicketCode(generateTicketCode());
    }
    if (paymentResult !== 'success' && ticketCode && !clientSecret) {
      setTicketCode(null);
    }
  }, [paymentResult, ticketCode, clientSecret]);

  const handleRetryPayment = useCallback(() => { setPaymentResult(null); }, []);

  const stepLabels: Record<Step, string> = {
    service: t('step_service'),
    format: t('step_format'),
    extras: t('step_extras'),
    arrival: t('step_arrival'),
    summary: t('step_summary'),
    payment: t('step_payment'),
  };

  const renderStep = () => {
    switch (step) {
      case 'service':
        return (
          <ServiceSelectionStep
            station={station}
            selectedService={selectedService}
            onSelectService={handleSelectService}
            onContinue={handleServiceContinue}
          />
        );
      case 'format':
        return (
          <FormatSelectionStep
            service={selectedService!}
            selectedEntry={selectedEntry}
            onSelectEntry={handleSelectEntry}
            onContinue={goNext}
            onBack={goBack}
          />
        );
      case 'extras':
        return (
          <ExtrasStep
            serviceName={selectedService?.name ?? ''}
            servicePrice={servicePrice}
            serviceDuration={serviceDuration}
            extras={extras}
            selectedExtras={selectedExtraIds}
            onToggleExtra={toggleExtra}
            onContinue={goNext}
            onSkip={handleSkipExtras}
            onBack={goBack}
          />
        );
      case 'arrival':
        return (
          <ArrivalStep
            station={station}
            stationConfig={station.stationConfig}
            serviceDuration={totalDuration}
            serviceBasePrice={servicePrice + extrasTotal}
            reservationSurcharge={reservationSurcharge}
            arrivalMode={arrivalMode}
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            laterTime={laterTime}
            serviceId={selectedService?.id ?? null}
            vehicleFormatId={selectedEntry?.vehicleFormatId ?? null}
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
            selectedService={selectedService!}
            selectedEntry={selectedEntry}
            selectedExtras={selectedExtras}
            arrivalMode={arrivalMode!}
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            laterTime={laterTime}
            grandTotal={grandTotal}
            totalDuration={totalDuration}
            reservationSurcharge={reservationSurcharge}
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

  const mapsUrl = (() => {
    const dest =
      station.latitude != null && station.longitude != null
        ? `${station.latitude},${station.longitude}`
        : encodeURIComponent(`${station.name}, ${station.address}, ${station.city}`);
    const origin = userLocation
      ? `&origin=${userLocation.latitude},${userLocation.longitude}`
      : '';
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}`;
  })();

  const renderResultScreen = () => {
    const isSuccess = paymentResult === 'success';
    const isQueueNow = arrivalMode === 'queue_now';

    if (isSuccess) {
      return (
        <div className="flex flex-col items-center px-4 sm:px-6 py-6 gap-4">
          <div className="w-16 h-16 rounded-full bg-lavo-success/15 flex items-center justify-center">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>

          <div className="text-center">
            <h3 id="booking-result-title" className="text-[20px] font-black text-[#000C1F] dark:text-[#FFF8EC]">
              {t('result_success_title')}
            </h3>
            <p className="text-[14px] text-[#555] dark:text-[#B0B0A0] max-w-sm leading-relaxed mt-1">
              {isQueueNow ? t('result_queue_now_desc') : t('result_success_desc')}
            </p>
          </div>

          {ticketCode && (
            <BookingReceipt
              station={station}
              service={selectedService}
              entry={selectedEntry}
              extras={selectedExtras}
              arrivalMode={arrivalMode!}
              selectedDate={selectedDate}
              laterTime={laterTime}
              selectedSlotTime={selectedSlot?.time ?? null}
              servicePrice={servicePrice}
              extrasTotal={extrasTotal}
              surchargeAmount={surchargeAmount}
              grandTotal={grandTotal}
              ticketCode={ticketCode}
              queuePosition={arrivalMode === 'queue_later' ? station.queueCount + 1 : null}
            />
          )}

          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md mt-2 lavo-receipt-actions">
            {isQueueNow ? (
              <>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-dark-bg hover:bg-[#243020] rounded-xl text-[14px] font-bold text-white text-center transition-colors"
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
                  className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#C0C0B0] hover:bg-[#F0F0E2] dark:hover:bg-tab-inactive transition-colors cursor-pointer"
                >
                  {t('result_done')}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/client/reservations"
                  className="flex-1 inline-flex items-center justify-center py-3 bg-dark-bg hover:bg-[#243020] rounded-xl text-[14px] font-bold text-white text-center transition-colors"
                >
                  {t('result_view_reservations')}
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#C0C0B0] hover:bg-[#F0F0E2] dark:hover:bg-tab-inactive transition-colors cursor-pointer"
                >
                  {t('result_done')}
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-12 gap-5">
        <div className="w-20 h-20 rounded-full bg-lavo-error/15 flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#E8472A" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </div>

        <h3 id="booking-result-title" className="text-[22px] font-black text-[#000C1F] dark:text-[#FFF8EC]">
          {t('result_error_title')}
        </h3>
        <p className="text-[15px] text-[#555] dark:text-[#B0B0A0] max-w-sm leading-relaxed">
          {t('result_error_desc')}
        </p>

        <div className="flex gap-2 w-full max-w-xs mt-2">
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
        </div>
      </div>
    );
  };

  if (paymentResult) {
    return (
      <>
        <div className="hidden md:flex fixed inset-0 z-60 items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#F5F5E6] dark:bg-dark-card rounded-2xl shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-result-title"
          >
            {renderResultScreen()}
          </div>
        </div>
        <div className="md:hidden fixed inset-0 z-60 bg-[#F5F5E6] dark:bg-dark-card overflow-y-auto">
          <div className="min-h-full flex items-start justify-center py-4">
            {renderResultScreen()}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop: Modal overlay */}
      <div
        className="hidden md:flex fixed inset-0 z-60 items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          ref={dialogRootRef}
          className="relative w-full max-w-2xl bg-[#F5F5E6] dark:bg-dark-card rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-dialog-title-desktop"
          onClick={(e) => e.stopPropagation()}
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
              {activeSteps.map((s, i) => (
                <div key={s} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`h-1 w-full rounded-full transition-colors ${
                    i <= stepIndex ? 'bg-gold' : 'bg-[#D0D0C0] dark:bg-tab-inactive'
                  }`} />
                  <span className={`text-[11px] font-bold ${i === stepIndex ? 'text-gold' : 'text-[#888]'}`}>
                    {stepLabels[s]}
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
        className="md:hidden fixed inset-0 z-60 bg-[#F5F5E6] dark:bg-dark-card flex flex-col"
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
              {stepIndex + 1}/{activeSteps.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1">
            {activeSteps.map((s, i) => (
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
            {stepLabels[step]}
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

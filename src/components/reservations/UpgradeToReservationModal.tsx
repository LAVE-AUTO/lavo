'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { getFromApi, postWithApi } from '@/services/axios-service';
import { useToast } from '@/context/toast-context';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import SlotPicker from './SlotPicker';
import type { AvailableSlot } from './SlotPicker';

/* ------------------------------------------------------------------ */
/* Stripe singleton                                                     */
/* ------------------------------------------------------------------ */

let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripePromise() {
  if (stripePromise !== null) return stripePromise;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (key) stripePromise = loadStripe(key);
  return stripePromise;
}

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface ApiTimeSlot {
  id: string;
  start_time: string;
  capacity: number;
  booked_count: number;
  status: string;
}

interface Props {
  entryId: string;
  stationId: string;
  onClose: () => void;
  onSuccess: (reservationId: string) => void;
}

/* ------------------------------------------------------------------ */
/* Stripe card sub-form                                                 */
/* ------------------------------------------------------------------ */

function UpgradeCardForm({
  clientSecret,
  onSuccess,
  onBack,
}: {
  clientSecret: string;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('queue_detail');
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;
    setProcessing(true);
    setError(null);
    try {
      const { error: stripeErr } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });
      if (!mountedRef.current) return;
      if (stripeErr) {
        setError(stripeErr.message ?? t('upgrade_error_payment'));
        return;
      }
      onSuccess();
    } catch {
      if (mountedRef.current) setError(t('upgrade_error_payment'));
    } finally {
      if (mountedRef.current) setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] text-center">
        {t('upgrade_payment_desc')}
      </p>

      <div className="rounded-xl border-2 border-[#D0D0C0] dark:border-tab-inactive bg-white dark:bg-dark-bg px-4 py-3">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '15px',
                color: '#000C1F',
                '::placeholder': { color: '#BBBBBB' },
                fontFamily: 'Rajdhani, sans-serif',
              },
              invalid: { color: '#E8472A' },
            },
            hidePostalCode: true,
          }}
        />
      </div>

      {error && (
        <p className="text-[13px] text-lavo-error text-center" role="alert">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={processing}
          className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] dark:hover:bg-[#222220] transition-colors cursor-pointer disabled:opacity-50"
        >
          {t('upgrade_btn_back')}
        </button>
        <button
          type="button"
          onClick={handlePay}
          disabled={!stripe || processing}
          className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {processing && (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          )}
          {processing ? t('upgrade_btn_paying') : t('upgrade_btn_pay')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main modal                                                           */
/* ------------------------------------------------------------------ */

export default function UpgradeToReservationModal({ entryId, stationId, onClose, onSuccess }: Props) {
  const t = useTranslations('queue_detail');
  const locale = useLocale();
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Steps: 'slot' → 'payment' → 'done'
  const [step, setStep] = useState<'slot' | 'payment'>('slot');
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);

  // Load available slots
  useEffect(() => {
    (async () => {
      setLoadingSlots(true);
      try {
        const [ok, data] = await getFromApi(`/stations/${stationId}`);
        if (!mountedRef.current) return;
        if (!ok) return;
        const station = (data as { data: { timeSlots: ApiTimeSlot[] } }).data;
        const now = new Date();
        const available: AvailableSlot[] = (station.timeSlots ?? [])
          .filter((s) => new Date(s.start_time) > now && s.status === 'available')
          .map((s) => ({
            id: s.id,
            startTime: s.start_time,
            isFull: s.booked_count >= s.capacity,
          }));
        setSlots(available);
      } catch {
        // keep empty slots on failure
      } finally {
        if (mountedRef.current) setLoadingSlots(false);
      }
    })();
  }, [stationId]);

  // Focus trap + Escape
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const el = dialogRef.current;
    if (el) {
      const focusable = el.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      focusable?.focus();
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const handleUpgrade = async () => {
    if (!selectedSlotId) return;
    setUpgrading(true);
    try {
      const [ok, data] = await postWithApi(`/me/entries/${entryId}/upgrade-to-reservation`, {
        time_slot_id: selectedSlotId,
      });
      if (!mountedRef.current) return;

      if (!ok) {
        const msg = (data as { message?: string })?.message ?? '';
        if (msg.includes('full') || msg.includes('SLOT_FULL')) {
          toastError(t('upgrade_error_slot_full'));
        } else {
          toastError(t('upgrade_error'));
        }
        return;
      }

      const result = (data as { data: { reservation_id: string; stripe_client_secret: string } }).data;

      if (result.stripe_client_secret) {
        setClientSecret(result.stripe_client_secret);
        setReservationId(result.reservation_id);
        setStep('payment');
      } else {
        toastSuccess(t('upgrade_success'));
        onSuccess(result.reservation_id);
      }
    } catch {
      if (mountedRef.current) toastError(t('upgrade_error'));
    } finally {
      if (mountedRef.current) setUpgrading(false);
    }
  };

  const handlePaymentSuccess = () => {
    toastSuccess(t('upgrade_success'));
    if (reservationId) {
      onSuccess(reservationId);
    }
  };

  const resolvedStripe = getStripePromise();

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-modal-title"
          className="bg-[#F5F5E6] dark:bg-[#1A1A18] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#af8408" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
                <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
            </div>
            <h3 id="upgrade-modal-title" className="text-[18px] font-black text-[#0A0A14] dark:text-white">
              {t('upgrade_modal_title')}
            </h3>
            <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-1">
              {step === 'slot' ? t('upgrade_modal_desc') : t('upgrade_payment_desc')}
            </p>
          </div>

          {/* Step: Slot selection */}
          {step === 'slot' && (
            <>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-[2px] border-gold border-t-transparent" />
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[13px] text-[#999] dark:text-[#666]">{t('upgrade_no_slots')}</p>
                </div>
              ) : (
                <SlotPicker
                  slots={slots}
                  selectedSlotId={selectedSlotId}
                  onSelect={setSelectedSlotId}
                  locale={locale}
                />
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={upgrading}
                  className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] dark:hover:bg-[#222220] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {t('upgrade_btn_cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleUpgrade}
                  disabled={!selectedSlotId || upgrading}
                  className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {upgrading && (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                  )}
                  {upgrading ? t('upgrade_btn_upgrading') : t('upgrade_btn_continue')}
                </button>
              </div>
            </>
          )}

          {/* Step: Stripe payment */}
          {step === 'payment' && clientSecret && (
            resolvedStripe ? (
              <Elements stripe={resolvedStripe} options={{ clientSecret }}>
                <UpgradeCardForm
                  clientSecret={clientSecret}
                  onSuccess={handlePaymentSuccess}
                  onBack={() => setStep('slot')}
                />
              </Elements>
            ) : (
              <div className="text-center py-6">
                <p className="text-[13px] text-lavo-error">{t('upgrade_error_stripe')}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 px-4 py-2 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] cursor-pointer"
                >
                  {t('upgrade_btn_cancel')}
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}

'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getFromApi, postWithApi } from '@/services/axios-service';
import { useToast } from '@/context/toast-context';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { AvailableSlot } from './SlotPicker';

let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripePromise() {
  if (stripePromise !== null) return stripePromise;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (key) stripePromise = loadStripe(key);
  return stripePromise;
}

interface AvailabilitySlot {
  start_time: string;
  end_time: string;
}

interface Props {
  entryId: string;
  stationId: string;
  onClose: () => void;
  onSuccess: (reservationId: string) => void;
}


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
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

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
        <p className="text-[13px] text-Hurryline-error text-center" role="alert">{error}</p>
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


export default function UpgradeToReservationModal({ entryId, stationId, onClose, onSuccess }: Props) {
  const t = useTranslations('queue_detail');
  const locale = useLocale();
  const { success: toastSuccess, error: toastError } = useToast();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [step, setStep] = useState<'slot' | 'payment'>('slot');
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);

  const loadAvailableSlots = useCallback(async (): Promise<AvailableSlot[]> => {
    const [stationOk, stationData] = await getFromApi(`/stations/${stationId}`);
    if (!stationOk) return [];
    const station = (stationData as { data: { stationConfig?: { wash_duration_minutes?: number } | null } }).data;
    const durationMin = Math.max(1, station?.stationConfig?.wash_duration_minutes ?? 30);

    const now = new Date();
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });

    const slotsByStart = new Map<string, AvailabilitySlot>();
    for (const day of days) {
      const [ok, data] = await getFromApi(
        `/stations/${stationId}/availability?date=${day}&duration_min=${durationMin}`
      );
      if (!ok) continue;
      const slots = (data as { data?: { slots?: AvailabilitySlot[] } })?.data?.slots ?? [];
      for (const s of slots) {
        if (!slotsByStart.has(s.start_time)) {
          slotsByStart.set(s.start_time, s);
        }
      }
    }

    return Array.from(slotsByStart.values())
      .filter((s) => new Date(s.start_time).getTime() > Date.now())
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((s) => ({
        id: s.start_time,
        startTime: s.start_time,
        isFull: false,
      }));
  }, [stationId]);

  useEffect(() => {
    (async () => {
      setLoadingSlots(true);
      try {
        const available = await loadAvailableSlots();
        if (!mountedRef.current) return;
        setSlots(available);
      } catch {
        // keep empty slots on failure
      } finally {
        if (mountedRef.current) setLoadingSlots(false);
      }
    })();
  }, [loadAvailableSlots]);

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
      // Revalidate availability right before upgrade to avoid stale slot picks.
      const fresh = await loadAvailableSlots();
      if (!mountedRef.current) return;
      setSlots(fresh);
      const stillAvailable = fresh.some((s) => s.id === selectedSlotId);
      if (!stillAvailable) {
        setSelectedSlotId(null);
        toastError(t('upgrade_error_slot_full'));
        return;
      }

      const [ok, data] = await postWithApi(`/me/entries/${entryId}/upgrade-to-reservation`, {
        start_time: selectedSlotId,
      });
      if (!mountedRef.current) return;

      if (!ok) {
        const errBody = data as { message?: string; code?: string } | null;
        const code = errBody?.code ?? '';
        const msg  = errBody?.message ?? '';
        // Slot raced into capacity between picker render and submit.
        if (code === 'SLOT_FULL' || msg.toLowerCase().includes('full')) {
          const refreshed = await loadAvailableSlots();
          if (mountedRef.current) {
            setSlots(refreshed);
            setSelectedSlotId(null);
          }
          toastError(t('upgrade_error_slot_full'));
        // Slot is too far in advance (advance booking window exceeded).
        } else if (msg.toLowerCase().includes('advance')) {
          toastError(t('upgrade_error_advance_limit'));
        // Station has no Stripe Connect account configured (typically dev / sandbox).
        } else if (code === 'CONFLICT' && msg.toLowerCase().includes('payment')) {
          toastError(t('upgrade_error_stripe'));
        } else {
          toastError(t('upgrade_error'));
        }
        return;
      }

      // Backend returns successResponse({ reservation_id, stripe_client_secret, ...entryFields }).
      // Read both shapes defensively in case the wrapper changes.
      const responseBody = data as { data?: { reservation_id?: string; stripe_client_secret?: string } };
      const result = responseBody?.data;
      if (!result?.reservation_id) {
        toastError(t('upgrade_error'));
        return;
      }

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
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#F5F5E6] dark:bg-[#1A1A18] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] flex flex-col animate-fade-in-up"
      >
        {/* = Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('upgrade_modal_close')}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#666] dark:text-[#B0B0A0] hover:text-gold transition-colors cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* = Header */}
        <div className="px-6 pt-6 pb-4 text-center shrink-0">
          <div className="w-12 h-12 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#af8408" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

        {/* = Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6">
          {step === 'slot' && (
            loadingSlots ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-[2px] border-gold border-t-transparent" />
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[13px] text-[#999] dark:text-[#666]">{t('upgrade_no_slots')}</p>
              </div>
            ) : (
              <SlotStepPicker
                slots={slots}
                selectedSlotId={selectedSlotId}
                onSelect={setSelectedSlotId}
                locale={locale}
                pickDateLabel={t('upgrade_pick_date')}
                pickTimeLabel={t('upgrade_pick_time')}
                emptyDayLabel={t('upgrade_no_slots_for_date')}
              />
            )
          )}

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
              <div className="text-center py-8">
                <p className="text-[13px] text-Hurryline-error">{t('upgrade_error_stripe')}</p>
              </div>
            )
          )}
        </div>

        {/* = Footer actions (slot step only) */}
        {step === 'slot' && (
          <div className="px-6 pt-3 pb-5 border-t border-[#D0D0C0] dark:border-tab-inactive flex gap-3 shrink-0 bg-[#F5F5E6] dark:bg-[#1A1A18]">
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
              disabled={!selectedSlotId || upgrading || slots.length === 0}
              className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {upgrading && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              )}
              {upgrading ? t('upgrade_btn_upgrading') : t('upgrade_btn_continue')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


interface SlotStepPickerProps {
  slots: AvailableSlot[];
  selectedSlotId: string | null;
  onSelect: (slotId: string) => void;
  locale: string;
  pickDateLabel: string;
  pickTimeLabel: string;
  emptyDayLabel: string;
}

function SlotStepPicker({ slots, selectedSlotId, onSelect, locale, pickDateLabel, pickTimeLabel, emptyDayLabel }: SlotStepPickerProps) {
  const dateFmtLocale = locale === 'en' ? 'en-CA' : 'fr-FR';

  /* Index slots by ISO local date so the chip strip only shows days that have slots. */
  const grouped = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const slot of slots) {
      const d = new Date(slot.startTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([key, daySlots]) => {
      const sample = new Date(daySlots[0].startTime);
      return {
        key,
        dayShort: sample.toLocaleDateString(dateFmtLocale, { weekday: 'short' }).slice(0, 3),
        dayFull:  sample.toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long' }),
        dateNum:  sample.getDate(),
        slots:    daySlots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
      };
    }).sort((a, b) => a.key.localeCompare(b.key));
  }, [slots, dateFmtLocale]);

  /* Default to the first day that has any slot, or the day of the currently selected slot. */
  const initialDate = useMemo(() => {
    if (selectedSlotId) {
      const sel = slots.find((s) => s.id === selectedSlotId);
      if (sel) {
        const d = new Date(sel.startTime);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    return grouped[0]?.key ?? null;
  }, [selectedSlotId, slots, grouped]);

  const [activeDate, setActiveDate] = useState<string | null>(initialDate);
  const activeGroup = grouped.find((g) => g.key === activeDate) ?? null;

  return (
    <div className="space-y-5 pb-2">
      {/* = Date selection strip */}
      <div>
        <p className="text-[11px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-2">
          {pickDateLabel}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {grouped.map((g) => {
            const isActive = g.key === activeDate;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => setActiveDate(g.key)}
                aria-pressed={isActive}
                aria-label={g.dayFull}
                className={[
                  'shrink-0 flex flex-col items-center justify-center w-[56px] py-2 rounded-xl border-2 transition-all cursor-pointer',
                  isActive
                    ? 'border-gold bg-gold text-dark-bg shadow-sm'
                    : 'border-[#D0D0C0] dark:border-tab-inactive text-[#0A0A14] dark:text-white hover:border-gold/60',
                ].join(' ')}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">{g.dayShort}</span>
                <span className="text-[18px] font-black leading-none mt-0.5">{g.dateNum}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* = Time slot selection for the picked day */}
      <div>
        <p className="text-[11px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-2">
          {pickTimeLabel}
        </p>
        {activeGroup && activeGroup.slots.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {activeGroup.slots.map((slot) => {
              const d = new Date(slot.startTime);
              const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              const isSelected = slot.id === selectedSlotId;
              const isDisabled = slot.isFull;
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onSelect(slot.id)}
                  aria-pressed={isSelected}
                  className={[
                    'py-2.5 rounded-[10px] text-[14px] font-bold border-2 transition-all',
                    'font-[family-name:var(--font-roboto-mono)]',
                    isDisabled
                      ? 'border-[#D0D0C0] dark:border-tab-inactive text-[#CCC] dark:text-[#555] cursor-not-allowed line-through'
                      : isSelected
                        ? 'border-gold bg-gold text-dark-bg shadow-sm cursor-pointer'
                        : 'border-[#D0D0C0] dark:border-tab-inactive text-[#0A0A14] dark:text-white hover:border-gold/60 cursor-pointer',
                  ].join(' ')}
                >
                  {time}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-[#999] dark:text-[#666] text-center py-6">{emptyDayLabel}</p>
        )}
      </div>
    </div>
  );
}

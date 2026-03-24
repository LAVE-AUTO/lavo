'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { useToast } from '@/context/toast-context';
import { getFromApi, postWithApi } from '@/services/axios-service';
import { RESERVATIONS_MOCK_ENABLED, findMockReservation } from '@/data/reservations-mock';
import type { AvailableSlot } from '@/components/reservations/SlotPicker';
import RescheduleSuccessView from '@/components/reservations/RescheduleSuccessView';

/* ------------------------------------------------------------------ */
/* Shapes API                                                           */
/* ------------------------------------------------------------------ */

interface ApiEntry {
  id: string;
  entry_type: 'reservation' | 'queue';
  time_slot_id: string | null;
  station_id: string;
  vehicle_format_id: string | null;
  status: string;
  amount_paid: string | null;
  created_at: string;
}

interface ApiTimeSlot {
  id: string;
  start_time: string;
  status: string;
  booked_count: number;
  capacity: number;
}

interface ApiStation {
  id: string;
  name: string;
  vehicleFormats: Array<{ id: string; label: string; price: string }>;
  timeSlots: ApiTimeSlot[];
  stationConfig?: { wash_duration_minutes: number } | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/* Constantes                                                           */
/* ------------------------------------------------------------------ */

/* Frais de report appliqués si le créneau actuel est dans moins de 2h */
const RESCHEDULE_FEE = 5;
const LATE_RESCHEDULE_THRESHOLD_MINUTES = 120;

function safeFloat(v: string | null | undefined): number {
  const n = parseFloat(v ?? '');
  return isNaN(n) ? 0 : n;
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export default function RescheduleReservationPage() {
  const t      = useTranslations('reschedule');
  const locale = useLocale();
  const params = useParams();
  const id     = params.id as string;
  useToast();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [loading, setLoading]                 = useState(true);
  const [loadError, setLoadError]             = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [done, setDone]                       = useState(false);
  const [selectedDate, setSelectedDate]       = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId]   = useState<string | null>(null);
  const [availableSlots, setAvailableSlots]   = useState<AvailableSlot[]>([]);
  const [currentLabel, setCurrentLabel]       = useState('');
  const [forfaitLabel, setForfaitLabel]       = useState('');
  const [stationName, setStationName]         = useState('');
  const [amount, setAmount]                   = useState(0);
  const [hasFee, setHasFee]                   = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const confirmDialogRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    // TODO: remove mock block once booking flow is connected to Stripe
    if (RESERVATIONS_MOCK_ENABLED) {
      const mock = findMockReservation(id);
      if (!mock) { setLoadError(true); setLoading(false); return; }

      const now = Date.now();
      const slotDate = new Date(`${mock.date}T${mock.timeSlot}`);
      const label = slotDate.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
        weekday: 'short', day: 'numeric', month: 'short',
      }) + ' ' + mock.timeSlot;
      setCurrentLabel(label);

      const minutesUntil = (slotDate.getTime() - now) / 60000;
      setHasFee(minutesUntil > 0 && minutesUntil < LATE_RESCHEDULE_THRESHOLD_MINUTES);

      setForfaitLabel(mock.forfaitName);
      setStationName(mock.stationName);
      setAmount(mock.totalPrice);

      /* Créneaux fictifs disponibles sur les 5 prochains jours */
      const hours = [8, 9, 10, 11, 14, 15, 16, 17];
      const fullSlots = new Set([1, 4, 6]); /* indices marqués complets pour réalisme */
      const mockSlots: AvailableSlot[] = [];
      let idx = 0;
      for (let day = 1; day <= 5; day++) {
        const base = new Date(now);
        base.setDate(base.getDate() + day);
        for (const hour of hours) {
          const s = new Date(base);
          s.setHours(hour, 0, 0, 0);
          mockSlots.push({ id: `mock-slot-${idx}`, startTime: s.toISOString(), isFull: fullSlots.has(idx) });
          idx++;
        }
      }
      setAvailableSlots(mockSlots);
      setLoading(false);
      return;
    }

    const [entriesOk, entriesData] = await getFromApi('/me/entries?per_page=100');
    if (!mountedRef.current) return;

    if (!entriesOk) { setLoadError(true); setLoading(false); return; }

    const entries: ApiEntry[] = (entriesData as { data: { entries: ApiEntry[] } })?.data?.entries ?? [];
    const entry = entries.find((e) => e.id === id && e.entry_type === 'reservation');

    if (!entry) { setLoadError(true); setLoading(false); return; }

    const [stationOk, stationData] = await getFromApi(`/stations/${entry.station_id}`);
    if (!mountedRef.current) return;

    if (!stationOk) { setLoadError(true); setLoading(false); return; }

    const station = (stationData as { data: ApiStation }).data;

    /* Créneau actuel */
    const currentSlot = entry.time_slot_id
      ? station.timeSlots.find((s) => s.id === entry.time_slot_id)
      : null;

    const now = Date.now();

    if (currentSlot) {
      const slotDate = new Date(currentSlot.start_time);
      const label = slotDate.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
        weekday: 'short', day: 'numeric', month: 'short',
      }) + ' ' + String(slotDate.getHours()).padStart(2, '0') + ':' + String(slotDate.getMinutes()).padStart(2, '0');
      setCurrentLabel(label);

      const minutesUntil = (slotDate.getTime() - now) / 60000;
      setHasFee(minutesUntil > 0 && minutesUntil < LATE_RESCHEDULE_THRESHOLD_MINUTES);
    }

    const format = station.vehicleFormats.find((f) => f.id === entry.vehicle_format_id);
    setForfaitLabel(format?.label ?? '—');
    setStationName(station.name);
    setAmount(safeFloat(entry.amount_paid));

    /* Créneaux disponibles : futurs, pas pleins, différents du créneau actuel */
    const future: AvailableSlot[] = station.timeSlots
      .filter((s) => new Date(s.start_time).getTime() > now && s.id !== entry.time_slot_id)
      .map((s) => ({
        id: s.id,
        startTime: s.start_time,
        isFull: s.status === 'full' || s.booked_count >= s.capacity,
      }));
    setAvailableSlots(future);
    setLoading(false);
  }, [id, locale]);

  useEffect(() => { loadData(); }, [loadData]);

  /* Dates disponibles — une entrée par jour ayant au moins un créneau */
  const availableDates = useMemo(() => {
    const seen = new Set<string>();
    const result: { key: string; dayShort: string; dateNum: number }[] = [];
    const fmtLocale = locale === 'en' ? 'en-CA' : 'fr-FR';
    for (const slot of availableSlots) {
      const d = new Date(slot.startTime);
      const key = toLocalDateKey(d);
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          key,
          dayShort: d.toLocaleDateString(fmtLocale, { weekday: 'short' }).slice(0, 3),
          dateNum: d.getDate(),
        });
      }
    }
    return result;
  }, [availableSlots, locale]);

  /* Créneaux pour la date sélectionnée, enrichis d'un champ time HH:MM */
  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    return availableSlots
      .filter((s) => toLocalDateKey(new Date(s.startTime)) === selectedDate)
      .map((s) => {
        const d = new Date(s.startTime);
        return {
          ...s,
          time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
        };
      });
  }, [availableSlots, selectedDate]);

  /* Libellé du créneau sélectionné pour la modale de confirmation */
  const selectedSlotLabel = useMemo(() => {
    const slot = availableSlots.find((s) => s.id === selectedSlotId);
    if (!slot) return '';
    const d = new Date(slot.startTime);
    const datePart = d.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${datePart} — ${h}:${m}`;
  }, [selectedSlotId, availableSlots, locale]);

  /* Focus trap pour la modale de confirmation */
  useEffect(() => {
    if (!showConfirmModal) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialogEl = confirmDialogRef.current;
    if (dialogEl) {
      const focusable = dialogEl.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setShowConfirmModal(false); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [showConfirmModal]);

  const handleSelectDate = (key: string) => {
    setSelectedDate(key);
    setSelectedSlotId(null);
  };

  const handleConfirm = () => {
    if (!selectedSlotId || submitting) return;
    setShowConfirmModal(true);
  };

  const handleSubmitReschedule = async () => {
    if (!selectedSlotId || submitting) return;
    setShowConfirmModal(false);
    setSubmitting(true);

    const [ok] = await postWithApi(`/reservations/${id}/reschedule`, { new_time_slot_id: selectedSlotId });
    if (!mountedRef.current) return;
    setSubmitting(false);
    if (ok) { setDone(true); return; }
    setLoadError(true);
  };

  if (done) return <RescheduleSuccessView />;

  /* État chargement */
  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] flex items-center justify-center pb-24 sm:pb-8">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      </main>
    );
  }

  /* État erreur */
  if (loadError) {
    return (
      <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] flex flex-col items-center justify-center gap-3 pb-24 sm:pb-8">
        <p className="text-[15px] font-semibold text-[#555] dark:text-[#B0B0A0] text-center px-4">
          {t('error_load')}
        </p>
        <button
          type="button"
          onClick={loadData}
          className="rounded-[10px] border border-gold/50 px-4 py-2 text-[13px] font-semibold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
        >
          {t('btn_retry')}
        </button>
      </main>
    );
  }

  const feeTotal = hasFee ? RESCHEDULE_FEE : 0;
  const canConfirm = selectedSlotId !== null && !submitting;

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] pb-24 sm:pb-8">
      {/* En-tête */}
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto">
        <Link
          href={`/client/reservations/${id}`}
          className="inline-flex items-center gap-2 text-[14px] font-bold text-gold hover:text-gold-hover transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t('btn_back')}
        </Link>
        <h1 className="text-[22px] font-black text-[#0A0A14] dark:text-white mt-3">
          {t('page_title')}
        </h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4">
        {/* Récapitulatif de la réservation actuelle */}
        <CurrentBookingCard
          stationName={stationName}
          forfait={forfaitLabel}
          currentLabel={currentLabel}
          amount={amount}
          t={t}
        />

        {/* Avertissement frais de report */}
        {hasFee && <FeeWarningBanner fee={RESCHEDULE_FEE} t={t} />}

        {/* Sélecteur de créneau */}
        <section className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-5 space-y-4">
          <h2 className="text-[16px] font-black text-[#0A0A14] dark:text-white">
            {t('select_slot')}
          </h2>

          {availableDates.length === 0 ? (
            <p className="text-[14px] text-[#666] dark:text-[#B0B0A0]">{t('no_slots')}</p>
          ) : (
            <>
              {/* Sélecteur de date — défilement horizontal */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {availableDates.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => handleSelectDate(d.key)}
                    className={[
                      'flex flex-col items-center min-w-[58px] py-2 px-3 rounded-xl border-2 transition-colors cursor-pointer shrink-0',
                      selectedDate === d.key
                        ? 'bg-gold border-gold text-dark-bg'
                        : 'border-[#D0D0C0] dark:border-tab-inactive text-[#0A0A14] dark:text-[#FFF8EC] hover:border-gold/40',
                    ].join(' ')}
                  >
                    <span className={`text-[11px] font-bold uppercase ${selectedDate === d.key ? 'text-dark-bg' : 'text-[#888]'}`}>
                      {d.dayShort}
                    </span>
                    <span className="text-[18px] font-black leading-snug">{d.dateNum}</span>
                  </button>
                ))}
              </div>

              {/* Grille des créneaux horaires pour la date sélectionnée */}
              {selectedDate && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slotsForDate.map((slot) => {
                    const isSelected = slot.id === selectedSlotId;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={slot.isFull}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={[
                          'py-2.5 rounded-[10px] text-[14px] font-bold border transition-all font-[family-name:var(--font-roboto-mono)]',
                          slot.isFull
                            ? 'border-[#D0D0C0] dark:border-tab-inactive text-[#CCC] dark:text-[#555] cursor-not-allowed opacity-50'
                            : isSelected
                              ? 'border-gold bg-gold text-dark-bg shadow-sm cursor-pointer'
                              : 'border-[#D0D0C0] dark:border-tab-inactive text-[#0A0A14] dark:text-white hover:border-gold/60 cursor-pointer',
                        ].join(' ')}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* Résumé financier + bouton */}
        {selectedSlotId && (
          <ConfirmSection
            amount={amount}
            fee={feeTotal}
            hasFee={hasFee}
            submitting={submitting}
            canConfirm={canConfirm}
            onConfirm={handleConfirm}
            t={t}
          />
        )}
      </div>

      {/* Modale de confirmation */}
      {showConfirmModal && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowConfirmModal(false)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              ref={confirmDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-reschedule-title"
              className="bg-[#F5F5E6] dark:bg-[#1A1A18] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            >
              <div className="w-14 h-14 rounded-full bg-gold/15 flex items-center justify-center mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#af8408" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>

              <h3
                id="confirm-reschedule-title"
                className="text-[18px] font-black text-[#0A0A14] dark:text-white text-center"
              >
                {t('confirm_modal_title')}
              </h3>
              <p className="text-[14px] text-[#555] dark:text-[#B0B0A0] text-center leading-relaxed">
                {t('confirm_modal_desc')}
              </p>
              <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 text-center">
                <p className="text-[14px] font-black text-gold leading-snug">{selectedSlotLabel}</p>
              </div>

              {hasFee && (
                <div className="flex justify-between text-[14px] px-1">
                  <span className="text-[#999] dark:text-[#888]">{t('fee_label')}</span>
                  <span className="font-bold text-[#FF8800]">+{RESCHEDULE_FEE.toFixed(2)}$</span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                  className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] dark:hover:bg-dark-surface transition-colors cursor-pointer disabled:opacity-50"
                >
                  {t('confirm_modal_keep')}
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReschedule}
                  disabled={submitting}
                  className="flex-1 py-3 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                  )}
                  {t('confirm_modal_confirm')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Sous-composants                                                      */
/* ------------------------------------------------------------------ */

function CurrentBookingCard({
  stationName, forfait, currentLabel, amount, t,
}: {
  stationName: string;
  forfait: string;
  currentLabel: string;
  amount: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-5 space-y-3">
      <h2 className="text-[16px] font-black text-[#0A0A14] dark:text-white">{t('current_booking')}</h2>
      <div className="space-y-2 text-[14px]">
        <Row label={t('label_station')} value={stationName} />
        <Row label={t('label_forfait')} value={forfait} />
        {currentLabel && <Row label={t('label_date')} value={currentLabel} />}
        <div className="pt-2 border-t border-[#D0D0C0] dark:border-tab-inactive flex items-center justify-between">
          <span className="font-bold text-[#0A0A14] dark:text-white">{t('total')}</span>
          <span className="text-[18px] font-black text-gold">{amount.toFixed(2)}$</span>
        </div>
      </div>
    </div>
  );
}

function FeeWarningBanner({ fee, t }: { fee: number; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex gap-3 bg-[#FF8800]/10 border border-[#FF8800]/30 rounded-xl px-4 py-3">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF8800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <p className="text-[13px] font-semibold text-[#FF8800] leading-relaxed">
        {t('fee_warning')} ({fee.toFixed(2)}$)
      </p>
    </div>
  );
}

function ConfirmSection({
  amount, fee, hasFee, submitting, canConfirm, onConfirm, t,
}: {
  amount: number;
  fee: number;
  hasFee: boolean;
  submitting: boolean;
  canConfirm: boolean;
  onConfirm: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-5 space-y-4">
      {hasFee && (
        <div className="space-y-2 text-[14px]">
          <div className="flex justify-between text-[#555] dark:text-[#C0C0B0]">
            <span>{t('subtotal')}</span>
            <span>{amount.toFixed(2)}$</span>
          </div>
          <div className="flex justify-between text-[#FF8800]">
            <span>{t('fee_label')}</span>
            <span>+{fee.toFixed(2)}$</span>
          </div>
          <div className="pt-2 border-t border-[#D0D0C0] dark:border-tab-inactive flex justify-between font-black text-[#0A0A14] dark:text-white text-[16px]">
            <span>{t('total')}</span>
            <span className="text-gold">{(amount + fee).toFixed(2)}$</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onConfirm}
        disabled={!canConfirm}
        className="w-full py-3.5 rounded-[10px] bg-gold hover:bg-gold-hover text-dark-bg text-[15px] font-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting && (
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        )}
        {submitting ? t('processing') : t('btn_confirm')}
      </button>

      {hasFee && (
        <p className="text-[11px] text-[#999] dark:text-[#888] text-center flex items-center justify-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          {t('payment_secured')}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[#999] dark:text-[#888] shrink-0">{label}</span>
      <span className="font-semibold text-[#0A0A14] dark:text-white text-right">{value}</span>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { getFromApi, postWithApi } from '@/services/axios-service';
import type { AvailableSlot } from '@/components/reservations/SlotPicker';
import RescheduleSuccessView from '@/components/reservations/RescheduleSuccessView';

/* ------------------------------------------------------------------ */
/* Shapes API                                                           */
/* ------------------------------------------------------------------ */

interface ApiRichEntry {
  id: string;
  entry_type: 'reservation' | 'queue';
  time_slot_id: string | null;
  station_id: string;
  vehicle_format_id: string | null;
  status: string;
  amount_paid: string | null;
  created_at: string;
  slot_start_time: string | null;
  slot_end_time: string | null;
  station: { id: string; name: string } | null;
  vehicle_format: { id: string; label: string; price: string } | null;
}

interface ApiAvailabilitySlot {
  start_time: string;
  end_time: string;
}

interface ApiAvailabilityResponse {
  data: {
    date: string;
    slots: ApiAvailabilitySlot[];
  };
}

/* How many days ahead we expose in the date picker. Bound at 14 to keep the
 * parallel availability fetches cheap; matches the typical booking horizon. */
const RESCHEDULE_HORIZON_DAYS = 14;

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

    /* Fetch the rich entry directly (denormalised station + vehicle format +
     * slot times) to avoid an N+1 list scan. */
    const [entryOk, entryData] = await getFromApi(`/me/entries/${id}`);
    if (!mountedRef.current) return;

    if (!entryOk) { setLoadError(true); setLoading(false); return; }

    const entry = (entryData as { data: ApiRichEntry })?.data;
    if (!entry || entry.entry_type !== 'reservation') {
      setLoadError(true); setLoading(false); return;
    }

    const now = Date.now();

    /* Current slot label + late-fee detection from the original slot times. */
    let currentSlotMs = 0;
    if (entry.slot_start_time) {
      const slotDate = new Date(entry.slot_start_time);
      currentSlotMs = slotDate.getTime();
      const label = slotDate.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
        weekday: 'short', day: 'numeric', month: 'short',
      }) + ' ' + String(slotDate.getHours()).padStart(2, '0') + ':' + String(slotDate.getMinutes()).padStart(2, '0');
      setCurrentLabel(label);

      const minutesUntil = (currentSlotMs - now) / 60000;
      setHasFee(minutesUntil > 0 && minutesUntil < LATE_RESCHEDULE_THRESHOLD_MINUTES);
    }

    setForfaitLabel(entry.vehicle_format?.label ?? '-');
    setStationName(entry.station?.name ?? '-');
    setAmount(safeFloat(entry.amount_paid));

    /* Duration is inherited from the original slot. Used as `duration_min`
     * for every availability call. Default to 30 min when missing. */
    let durationMin = 30;
    if (entry.slot_start_time && entry.slot_end_time) {
      durationMin = Math.max(
        1,
        Math.round((new Date(entry.slot_end_time).getTime() - new Date(entry.slot_start_time).getTime()) / 60_000),
      );
    }

    /* Build the next 14 calendar days, skipping today if we are past closing.
     * Then fan out availability calls in parallel. The composite slot id is
     * the ISO start_time itself — that's what the modern booking flow uses
     * and what the reschedule endpoint expects in `new_start_time`. */
    const candidateDays: string[] = [];
    for (let day = 0; day < RESCHEDULE_HORIZON_DAYS; day++) {
      const d = new Date(now);
      d.setDate(d.getDate() + day);
      candidateDays.push(toLocalDateKey(d));
    }

    const results = await Promise.all(
      candidateDays.map((date) =>
        getFromApi(`/stations/${entry.station_id}/availability?date=${date}&duration_min=${durationMin}`),
      ),
    );
    if (!mountedRef.current) return;

    const aggregated: AvailableSlot[] = [];
    for (const [ok, data] of results) {
      if (!ok) continue;
      const payload = (data as ApiAvailabilityResponse | null)?.data;
      const slots = payload?.slots ?? [];
      for (const s of slots) {
        const startMs = new Date(s.start_time).getTime();
        if (Number.isNaN(startMs) || startMs <= now) continue;
        if (currentSlotMs && startMs === currentSlotMs) continue;
        aggregated.push({ id: s.start_time, startTime: s.start_time, isFull: false });
      }
    }
    setAvailableSlots(aggregated);
    setLoading(false);
  }, [id, locale]);

  useEffect(() => { loadData(); }, [loadData]);

  /* Dates disponibles - une entrée par jour ayant au moins un créneau */
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
    return `${datePart} - ${h}:${m}`;
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

    /* selectedSlotId is the ISO start_time (composite id from the availability
     * endpoint). The backend creates the time_slots row server-side. */
    const [ok] = await postWithApi(`/reservations/${id}/reschedule`, { new_start_time: selectedSlotId });
    if (!mountedRef.current) return;
    setSubmitting(false);
    if (ok) { setDone(true); return; }
    setLoadError(true);
  };

  if (done) return <RescheduleSuccessView />;

  /* État chargement */
  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center pb-24 sm:pb-8">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      </main>
    );
  }

  /* État erreur */
  if (loadError) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 pb-24 sm:pb-8">
        <p className="text-[15px] font-semibold text-foreground/70 text-center px-4">
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
    <main className="min-h-screen bg-background pb-24 sm:pb-8">
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
        <h1 className="text-[22px] font-black text-foreground mt-3">
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
        <section className="bg-surface rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-[16px] font-black text-foreground">
            {t('select_slot')}
          </h2>

          {availableDates.length === 0 ? (
            <p className="text-[14px] text-foreground/65">{t('no_slots')}</p>
          ) : (
            <>
              {/* Sélecteur de date - défilement horizontal */}
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
                        : 'border-border text-foreground dark:text-foreground hover:border-gold/40',
                    ].join(' ')}
                  >
                    <span className={`text-[11px] font-bold uppercase ${selectedDate === d.key ? 'text-dark-bg' : 'text-foreground/55'}`}>
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
                          'py-2.5 rounded-[10px] text-[16px] font-bebas tracking-wider border transition-all',
                          slot.isFull
                            ? 'border-border text-[#CCC] dark:text-foreground/70 cursor-not-allowed opacity-50'
                            : isSelected
                              ? 'border-gold bg-gold text-dark-bg shadow-sm cursor-pointer'
                              : 'border-border text-foreground hover:border-gold/60 cursor-pointer',
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
              className="bg-background dark:bg-[#1A1A18] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            >
              <div className="w-14 h-14 rounded-full bg-gold/15 flex items-center justify-center mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>

              <h3
                id="confirm-reschedule-title"
                className="text-[18px] font-black text-foreground text-center"
              >
                {t('confirm_modal_title')}
              </h3>
              <p className="text-[14px] text-foreground/70 text-center leading-relaxed">
                {t('confirm_modal_desc')}
              </p>
              <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 text-center">
                <p className="text-[14px] font-black text-gold leading-snug">{selectedSlotLabel}</p>
              </div>

              {hasFee && (
                <div className="flex justify-between text-[14px] px-1">
                  <span className="text-[#999] dark:text-foreground/55">{t('fee_label')}</span>
                  <span className="font-bold text-[#FF8800]">+{RESCHEDULE_FEE.toFixed(2)}$</span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                  className="flex-1 py-3 border-2 border-border rounded-xl text-[14px] font-bold text-foreground/70 hover:bg-surface dark:hover:bg-dark-surface transition-colors cursor-pointer disabled:opacity-50"
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
    <div className="bg-surface rounded-xl border border-border p-5 space-y-3">
      <h2 className="text-[16px] font-black text-foreground">{t('current_booking')}</h2>
      <div className="space-y-2 text-[14px]">
        <Row label={t('label_station')} value={stationName} />
        <Row label={t('label_forfait')} value={forfait} />
        {currentLabel && <Row label={t('label_date')} value={currentLabel} />}
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="font-bold text-foreground">{t('total')}</span>
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
    <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
      {hasFee && (
        <div className="space-y-2 text-[14px]">
          <div className="flex justify-between text-foreground/70">
            <span>{t('subtotal')}</span>
            <span>{amount.toFixed(2)}$</span>
          </div>
          <div className="flex justify-between text-[#FF8800]">
            <span>{t('fee_label')}</span>
            <span>+{fee.toFixed(2)}$</span>
          </div>
          <div className="pt-2 border-t border-border flex justify-between font-black text-foreground text-[16px]">
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
        <p className="text-[11px] text-[#999] dark:text-foreground/55 text-center flex items-center justify-center gap-1.5">
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
      <span className="text-[#999] dark:text-foreground/55 shrink-0">{label}</span>
      <span className="font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}

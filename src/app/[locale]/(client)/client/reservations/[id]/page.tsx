'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { useToast } from '@/context/toast-context';
import { getFromApi, patchWithApi } from '@/services/axios-service';
import { RESERVATIONS_MOCK_ENABLED, findMockReservation } from '@/data/reservations-mock';

/* ------------------------------------------------------------------ */
/* API shapes                                                           */
/* ------------------------------------------------------------------ */

interface ApiEntry {
  id: string;
  entry_type: 'reservation' | 'queue';
  time_slot_id: string | null;
  station_id: string;
  vehicle_format_id: string | null;
  status: string;
  queue_position: number | null;
  amount_paid: string | null;
  created_at: string;
}

interface ApiVehicleFormat { id: string; label: string; price: string; is_active: boolean }
interface ApiTimeSlot { id: string; start_time: string }
interface ApiStation {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: string | null;
  longitude: string | null;
  vehicleFormats: ApiVehicleFormat[];
  timeSlots: ApiTimeSlot[];
  stationConfig?: { wash_duration_minutes: number } | null;
}

/* ------------------------------------------------------------------ */
/* Enriched reservation shape                                           */
/* ------------------------------------------------------------------ */

interface EnrichedReservation {
  id: string;
  stationName: string;
  stationAddress: string;
  stationImageUrl: string;
  stationLatitude: number;
  stationLongitude: number;
  forfaitName: string;
  date: string;
  timeSlot: string;
  duration: number;
  totalPrice: number;
  status: string;
}

function slotToDateParts(startTime: string): { date: string; timeSlot: string } {
  const d = new Date(startTime);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, timeSlot: `${h}:${m}` };
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function ReservationDetailPage() {
  const t = useTranslations('coupons');
  const router = useRouter();
  const params = useParams();
  const locale = useLocale();
  const id = params.id as string;

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [reservation, setReservation] = useState<EnrichedReservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const cancelDialogRef = useRef<HTMLDivElement | null>(null);
  const { success: showSuccess, error: showError } = useToast();

  const loadReservation = useCallback(async () => {
    setLoading(true);

    // TODO: remove mock block once booking flow is connected to Stripe
    if (RESERVATIONS_MOCK_ENABLED) {
      const mock = findMockReservation(id);
      if (!mock) { setNotFound(true); setLoading(false); return; }
      setReservation({
        id: mock.id,
        stationName: mock.stationName,
        stationAddress: mock.stationAddress,
        stationImageUrl: mock.stationImageUrl,
        stationLatitude: mock.stationLatitude,
        stationLongitude: mock.stationLongitude,
        forfaitName: mock.forfaitName,
        date: mock.date,
        timeSlot: mock.timeSlot,
        duration: mock.duration,
        totalPrice: mock.totalPrice,
        status: mock.status,
      });
      setLoading(false);
      return;
    }

    const [ok, data] = await getFromApi('/me/entries?per_page=100');
    if (!mountedRef.current) return;

    if (!ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const res = data as { data: { entries: ApiEntry[] } };
    const entries: ApiEntry[] = res?.data?.entries ?? [];
    const entry = entries.find((e) => e.id === id);

    if (!entry) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    /* Fetch station to enrich */
    const [stationOk, stationData] = await getFromApi(`/stations/${entry.station_id}`);
    if (!mountedRef.current) return;

    const station = stationOk && stationData
      ? (stationData as { data: ApiStation }).data
      : null;

    const format = station?.vehicleFormats.find((f) => f.id === entry.vehicle_format_id);
    const slot = entry.time_slot_id
      ? station?.timeSlots.find((s) => s.id === entry.time_slot_id)
      : undefined;

    const { date, timeSlot } = slot
      ? slotToDateParts(slot.start_time)
      : { date: entry.created_at.split('T')[0], timeSlot: '00:00' };

    setReservation({
      id: entry.id,
      stationName: station?.name ?? `#${entry.station_id.slice(0, 8)}`,
      stationAddress: station ? `${station.address}, ${station.city}` : '',
      stationImageUrl: '',
      stationLatitude: parseFloat(station?.latitude ?? '0'),
      stationLongitude: parseFloat(station?.longitude ?? '0'),
      forfaitName: format?.label ?? '—',
      date,
      timeSlot,
      duration: station?.stationConfig?.wash_duration_minutes ?? 30,
      totalPrice: parseFloat(entry.amount_paid ?? '0'),
      status: entry.status,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { loadReservation(); }, [loadReservation]);

  useEffect(() => {
    if (!showCancelModal) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialogEl = cancelDialogRef.current;
    if (dialogEl) {
      const focusable = dialogEl.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setShowCancelModal(false); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [showCancelModal]);

  /* Loading */
  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] flex items-center justify-center pb-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      </main>
    );
  }

  /* Not found */
  if (notFound || !reservation) {
    return (
      <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] flex items-center justify-center pb-20">
        <div className="text-center">
          <p className="text-[18px] font-bold text-[#555] dark:text-[#B0B0A0]">{t('not_found')}</p>
          <Link href="/client/reservations" className="mt-4 inline-block text-gold font-bold">{t('back_to_coupons')}</Link>
        </div>
      </main>
    );
  }

  const slotDateTime = new Date(`${reservation.date}T${reservation.timeSlot}`);
  const now = new Date();
  const minutesUntilSlot = (slotDateTime.getTime() - now.getTime()) / 60000;

  /* Start button: active 30–45 min before slot time */
  const canStart = minutesUntilSlot >= 0 && minutesUntilSlot <= 45;
  /* Cancel warning: if less than 1h before slot, warn about fees */
  const cancelHasFees = minutesUntilSlot < 60 && minutesUntilSlot >= 0;
  const isUpcoming = reservation.status === 'confirmed' && minutesUntilSlot > 0;
  const isPast = reservation.status === 'completed' || reservation.status === 'cancelled';

  const dateLabel = slotDateTime.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const statusColors: Record<string, string> = {
    confirmed:       'bg-lavo-success/15 text-lavo-success',
    in_progress:     'bg-gold/15 text-gold',
    completed:       'bg-[#999]/15 text-[#666]',
    cancelled:       'bg-lavo-error/15 text-lavo-error',
    pending:         'bg-blue-500/15 text-blue-500',
    pending_payment: 'bg-[#999]/15 text-[#888]',
  };

  const handleStartNavigation = () => {
    const destination = encodeURIComponent(`${reservation.stationLatitude},${reservation.stationLongitude}`);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleConfirmCancel = async () => {
    if (!reservation) return;
    setCancelLoading(true);

    // TODO: remove mock block once booking flow is connected to Stripe
    if (RESERVATIONS_MOCK_ENABLED) {
      setCancelLoading(false);
      setShowCancelModal(false);
      showSuccess(t('toast_cancel_success'));
      router.push('/client/reservations');
      return;
    }

    const [ok] = await patchWithApi(`/me/entries/${reservation.id}/cancel`, {});
    setCancelLoading(false);
    if (ok) {
      setShowCancelModal(false);
      showSuccess(t('toast_cancel_success'));
      router.push('/client/reservations');
    } else {
      showError(t('toast_cancel_error'));
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] pb-24 sm:pb-8">
      {/* Back header */}
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto">
        <Link
          href="/client/reservations"
          className="inline-flex items-center gap-2 text-[14px] font-bold text-gold hover:text-gold-hover transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          {t('back_to_coupons')}
        </Link>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4">
        {/* Hero image */}
        <div className="relative h-[180px] rounded-xl overflow-hidden bg-[#D0D0C0] dark:bg-[#1A1A18]">
          {reservation.stationImageUrl && (
            <img src={reservation.stationImageUrl} alt={reservation.stationName} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <h1 className="text-[20px] font-black text-white drop-shadow">{reservation.stationName}</h1>
            <p className="text-[13px] text-white/80">{reservation.stationAddress}</p>
          </div>
          <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[12px] font-bold ${statusColors[reservation.status] || 'bg-gray-200 text-gray-600'}`}>
            {t(`status_${reservation.status}`)}
          </span>
        </div>

        {/* Details card */}
        <div className="bg-[#E8E8D8] dark:bg-[#1A1A18] rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-5 space-y-4">
          <h2 className="text-[16px] font-black text-[#0A0A14] dark:text-white">{t('detail_summary')}</h2>

          <div className="space-y-3">
            <DetailRow icon="calendar" label={t('detail_date')} value={dateLabel} />
            <DetailRow icon="clock" label={t('detail_time')} value={reservation.timeSlot} />
            <DetailRow icon="tag" label={t('detail_forfait')} value={reservation.forfaitName} />
            <DetailRow icon="timer" label={t('detail_duration')} value={`${reservation.duration} min`} />

            <div className="pt-3 border-t border-[#D0D0C0] dark:border-tab-inactive flex items-center justify-between">
              <span className="text-[15px] font-bold text-[#0A0A14] dark:text-white">{t('detail_total')}</span>
              <span className="text-[20px] font-black text-gold">{reservation.totalPrice.toFixed(2)}$</span>
            </div>
          </div>
        </div>

        {/* Action buttons (only for upcoming reservations) */}
        {isUpcoming && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={canStart ? handleStartNavigation : undefined}
              disabled={!canStart}
              className={[
                'w-full py-3.5 rounded-xl text-[15px] font-black text-center transition-all flex items-center justify-center gap-2',
                canStart
                  ? 'bg-gold hover:bg-gold-hover text-dark-bg cursor-pointer'
                  : 'bg-[#D0D0C0] dark:bg-[#2A2A28] text-[#999] dark:text-[#666] cursor-not-allowed',
              ].join(' ')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
              {t('start_now')}
            </button>
            {!canStart && minutesUntilSlot > 45 && (
              <p className="text-[12px] text-[#999] dark:text-[#777] text-center">
                {t('start_available_in', { minutes: Math.ceil(minutesUntilSlot - 45) })}
              </p>
            )}
            {canStart && (
              <p className="text-[12px] text-lavo-success text-center font-semibold">{t('start_ready')}</p>
            )}

            <Link
              href={`/client/reservations/${id}/reschedule`}
              className="block w-full py-3.5 rounded-xl text-[15px] font-bold text-center text-[#0A0A14] dark:text-white border-2 border-[#D0D0C0] dark:border-tab-inactive hover:border-gold/50 hover:bg-[#E8E8D8] dark:hover:bg-dark-card transition-colors"
            >
              {t('reschedule_btn')}
            </Link>

            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="w-full py-3.5 rounded-xl text-[15px] font-bold text-lavo-error border-2 border-lavo-error/30 hover:bg-lavo-error/5 transition-colors cursor-pointer"
            >
              {t('cancel_reservation')}
            </button>
          </div>
        )}

        {isPast && (
          <div className="bg-[#E8E8D8] dark:bg-[#1A1A18] rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-4 space-y-3">
            <p className="text-[14px] text-[#666] dark:text-[#B0B0A0] text-center">
              {reservation.status === 'completed' ? t('past_completed') : t('past_cancelled')}
            </p>
            {reservation.status === 'completed' && (
              <>
                <Link
                  href={`/client/reservations/${id}/rate`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-gold/40 text-[14px] font-bold text-gold hover:bg-gold/10 hover:border-gold/60 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  {t('rate_btn')}
                </Link>
                <Link
                  href={`/client/reservations/${id}/tip`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-[#D0D0C0] dark:border-tab-inactive text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:border-gold/30 hover:text-gold transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                  {t('tip_btn')}
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCancelModal(false)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              ref={cancelDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-reservation-title"
              className="bg-[#F5F5E6] dark:bg-[#1A1A18] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            >
              <div className="w-14 h-14 rounded-full bg-lavo-error/15 flex items-center justify-center mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              </div>

              <h3
                id="cancel-reservation-title"
                className="text-[18px] font-black text-[#0A0A14] dark:text-white text-center"
              >
                {t('cancel_modal_title')}
              </h3>
              <p className="text-[14px] text-[#555] dark:text-[#B0B0A0] text-center leading-relaxed">
                {t('cancel_modal_desc')}
              </p>

              {cancelHasFees && (
                <div className="flex gap-2.5 bg-lavo-error/10 border border-lavo-error/20 rounded-xl px-3.5 py-3 text-left">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8472A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <p className="text-[12px] font-semibold text-lavo-error leading-relaxed">
                    {t('cancel_modal_fees_warning')}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelLoading}
                  className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {t('cancel_modal_keep')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={cancelLoading}
                  className="flex-1 py-3 bg-lavo-error hover:bg-lavo-error/90 rounded-xl text-[14px] font-bold text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancelLoading && (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                  )}
                  {t('cancel_modal_confirm')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

/* ---- Detail Row ---- */
function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const icons: Record<string, ReactNode> = {
    calendar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    clock:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    tag:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>,
    timer:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 007 17.828V22M7 2v4.172a2 2 0 00.586 1.414L12 12l4.414-4.414A2 2 0 0017 6.172V2" /></svg>,
  };

  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icons[icon]}</span>
      <div>
        <p className="text-[13px] text-[#999] dark:text-[#888]">{label}</p>
        <p className="text-[14px] font-semibold text-[#0A0A14] dark:text-white">{value}</p>
      </div>
    </div>
  );
}

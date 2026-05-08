'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { useToast } from '@/context/toast-context';
import { getFromApi, patchWithApi, postWithApi } from '@/services/axios-service';
import { RESERVATIONS_MOCK_ENABLED, findMockReservation } from '@/data/reservations-mock';

/* ------------------------------------------------------------------ */
/* API shapes (rich entry returned by GET /me/entries)                  */
/* ------------------------------------------------------------------ */

interface ApiRichStation {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: string | null;
  longitude: string | null;
  image_url: string | null;
  free_cancellation_minutes: number | null;
}

interface ApiRichEntry {
  id: string;
  entry_type: 'reservation' | 'queue';
  time_slot_id: string | null;
  station_id: string;
  vehicle_format_id: string | null;
  status: string;
  queue_position: number | null;
  ticket_code: string | null;
  amount_paid: string | null;
  created_at: string;
  station: ApiRichStation;
  vehicle_format: { id: string; label: string; price: string } | null;
  is_rated?: boolean;
  is_tipped?: boolean;
  slot_start_time: string | null;
  slot_end_time: string | null;
}

/* ------------------------------------------------------------------ */
/* Enriched reservation shape                                           */
/* ------------------------------------------------------------------ */

interface EnrichedReservation {
  id: string;
  stationId: string;
  stationName: string;
  stationAddress: string;
  stationImageUrl: string;
  stationLatitude: number;
  stationLongitude: number;
  forfaitName: string;
  date: string;
  timeSlot: string;
  /** ISO start_time used for past/upcoming + cancel-window detection. */
  slotStart: string | null;
  duration: number;
  totalPrice: number;
  status: string;
  ticketCode: string | null;
  isRated: boolean;
  isTipped: boolean;
}

/** Free cancellation rule: more than 1h before service start. */
const FREE_CANCEL_THRESHOLD_MS = 60 * 60 * 1000;

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
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeAmount, setDisputeAmount] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);
  const disputeDialogRef = useRef<HTMLDivElement | null>(null);
  const [confirmPresenceLoading, setConfirmPresenceLoading] = useState(false);
  const [presenceConfirmed, setPresenceConfirmed] = useState(false);
  const { success: showSuccess, error: showError } = useToast();

  const loadReservation = useCallback(async () => {
    setLoading(true);

    // TODO: remove mock block once booking flow is connected to Stripe
    if (RESERVATIONS_MOCK_ENABLED) {
      const mock = findMockReservation(id);
      if (!mock) { setNotFound(true); setLoading(false); return; }
      setReservation({
        id: mock.id,
        stationId: mock.stationId ?? '',
        stationName: mock.stationName,
        stationAddress: mock.stationAddress,
        stationImageUrl: mock.stationImageUrl,
        stationLatitude: mock.stationLatitude,
        stationLongitude: mock.stationLongitude,
        forfaitName: mock.forfaitName,
        date: mock.date,
        timeSlot: mock.timeSlot,
        slotStart: `${mock.date}T${mock.timeSlot}`,
        duration: mock.duration,
        totalPrice: mock.totalPrice,
        status: mock.status,
        ticketCode: null,
        isRated: false,
        isTipped: false,
      });
      setLoading(false);
      return;
    }

    /* Rich entries already include denormalised station, slot times, vehicle
     * format, ticket_code and is_rated/is_tipped flags - no extra fetch
     * needed. */
    const [ok, data] = await getFromApi('/me/entries?per_page=100');
    if (!mountedRef.current) return;

    if (!ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const res = data as { data: { entries: ApiRichEntry[] } };
    const entries: ApiRichEntry[] = res?.data?.entries ?? [];
    const entry = entries.find((e) => e.id === id);

    if (!entry) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const { date, timeSlot } = entry.slot_start_time
      ? slotToDateParts(entry.slot_start_time)
      : { date: entry.created_at.split('T')[0], timeSlot: '00:00' };

    const duration = (() => {
      if (!entry.slot_start_time || !entry.slot_end_time) return 30;
      const ms = new Date(entry.slot_end_time).getTime() - new Date(entry.slot_start_time).getTime();
      return Math.max(1, Math.round(ms / 60_000));
    })();

    setReservation({
      id: entry.id,
      stationId: entry.station_id,
      stationName: entry.station?.name ?? `#${entry.station_id.slice(0, 8)}`,
      stationAddress: entry.station ? `${entry.station.address}, ${entry.station.city}` : '',
      stationImageUrl: entry.station?.image_url ?? '',
      stationLatitude: entry.station?.latitude ? parseFloat(entry.station.latitude) : 0,
      stationLongitude: entry.station?.longitude ? parseFloat(entry.station.longitude) : 0,
      forfaitName: entry.vehicle_format?.label ?? '-',
      date,
      timeSlot,
      slotStart: entry.slot_start_time,
      duration,
      totalPrice: parseFloat(entry.amount_paid ?? '0'),
      status: entry.status,
      ticketCode: entry.ticket_code,
      isRated: Boolean(entry.is_rated),
      isTipped: Boolean(entry.is_tipped),
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

    return () => {
      previouslyFocused?.focus();
    };
  }, [showCancelModal]);

  useEffect(() => {
    if (!showDisputeModal) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialogEl = disputeDialogRef.current;
    if (dialogEl) {
      const focusable = dialogEl.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setShowDisputeModal(false); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [showDisputeModal]);

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

  const slotDateTime = reservation.slotStart
    ? new Date(reservation.slotStart)
    : new Date(`${reservation.date}T${reservation.timeSlot}`);
  const now = new Date();
  const msUntilSlot = slotDateTime.getTime() - now.getTime();
  const minutesUntilSlot = msUntilSlot / 60000;

  /* Start button: active 30-45 min before slot time. */
  const canStart = minutesUntilSlot >= 0 && minutesUntilSlot <= 45;
  /* Cancel warning: applies fees within the last hour before service start. */
  const cancelHasFees = msUntilSlot > 0 && msUntilSlot <= FREE_CANCEL_THRESHOLD_MS;
  /* Past = cancelled / completed OR slot already started. */
  const isPast =
    reservation.status === 'completed' ||
    reservation.status === 'cancelled' ||
    msUntilSlot <= 0;
  const isUpcoming = !isPast && (reservation.status === 'confirmed' || reservation.status === 'pending');

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

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation || !disputeReason.trim()) return;
    setDisputeLoading(true);

    const payload: Record<string, unknown> = {
      reservation_id: reservation.id,
      reason: disputeReason.trim(),
    };
    if (disputeDescription.trim()) payload.description = disputeDescription.trim();
    const amt = parseFloat(disputeAmount);
    if (!isNaN(amt) && amt > 0) payload.requested_amount = amt;

    try {
      const [ok, data] = await postWithApi('/disputes', payload);
      if (!mountedRef.current) return;

      if (ok) {
        setShowDisputeModal(false);
        setDisputeReason('');
        setDisputeDescription('');
        setDisputeAmount('');
        showSuccess(t('dispute_success'));
      } else {
        const errData = data as { code?: string; message?: string } | null;
        if (errData?.code === 'CONFLICT' || errData?.code === 'DISPUTE_ALREADY_EXISTS') {
          showError(t('dispute_already_exists'));
        } else {
          showError(t('dispute_error'));
        }
      }
    } catch {
      if (mountedRef.current) showError(t('dispute_error'));
    } finally {
      if (mountedRef.current) setDisputeLoading(false);
    }
  };

  const handleConfirmPresence = async () => {
    if (!reservation) return;
    setConfirmPresenceLoading(true);
    try {
      const [ok] = await postWithApi(`/reservations/${reservation.id}/confirm-presence`, {});
      if (!mountedRef.current) return;
      if (ok) {
        setPresenceConfirmed(true);
        showSuccess(t('confirm_presence_success'));
      } else {
        showError(t('confirm_presence_error'));
      }
    } catch {
      if (mountedRef.current) showError(t('confirm_presence_error'));
    } finally {
      if (mountedRef.current) setConfirmPresenceLoading(false);
    }
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

    try {
      const [ok] = await patchWithApi(`/me/entries/${reservation.id}/cancel`, {});
      if (!mountedRef.current) return;
      if (ok) {
        setShowCancelModal(false);
        showSuccess(t('toast_cancel_success'));
        router.push('/client/reservations');
      } else {
        showError(t('toast_cancel_error'));
      }
    } catch {
      if (mountedRef.current) showError(t('toast_cancel_error'));
    } finally {
      if (mountedRef.current) setCancelLoading(false);
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
            {canStart && !presenceConfirmed && (
              <button
                type="button"
                onClick={handleConfirmPresence}
                disabled={confirmPresenceLoading}
                className="w-full py-3.5 rounded-xl text-[15px] font-black text-center transition-all flex items-center justify-center gap-2 bg-lavo-success hover:bg-lavo-success/90 text-white cursor-pointer disabled:opacity-50"
              >
                {confirmPresenceLoading ? (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {confirmPresenceLoading ? t('confirm_presence_loading') : t('confirm_presence_btn')}
              </button>
            )}
            {canStart && presenceConfirmed && (
              <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-lavo-success/10 border border-lavo-success/30">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-[14px] font-bold text-lavo-success">{t('confirm_presence_done')}</span>
              </div>
            )}

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

            <Link
              href={`/client/reservations/${id}/signal-delay`}
              className="block w-full py-3.5 rounded-xl text-[15px] font-bold text-center text-[#555] dark:text-[#B0B0A0] border-2 border-[#D0D0C0] dark:border-tab-inactive hover:border-lavo-error/40 hover:text-lavo-error transition-colors"
            >
              {t('signal_delay_btn')}
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
                {/* Rate/tip surface only while the action is still pending.
                 * Once `is_rated` / `is_tipped` flips on the server, the
                 * button disappears so we never push a duplicate prompt. */}
                {!reservation.isRated && (
                  <Link
                    href={`/client/reservations/${id}/rate`}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-gold/40 text-[14px] font-bold text-gold hover:bg-gold/10 hover:border-gold/60 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {t('rate_btn')}
                  </Link>
                )}
                {!reservation.isTipped && (
                  <Link
                    href={`/client/reservations/${id}/tip`}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-[#D0D0C0] dark:border-tab-inactive text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:border-gold/30 hover:text-gold transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                    </svg>
                    {t('tip_btn')}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(true)}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-lavo-error/30 text-[14px] font-bold text-lavo-error hover:bg-lavo-error/5 hover:border-lavo-error/50 transition-colors cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {t('dispute_btn')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Dispute modal */}
      {showDisputeModal && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDisputeModal(false)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              ref={disputeDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dispute-modal-title"
              className="bg-[#F5F5E6] dark:bg-[#1A1A18] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="w-14 h-14 rounded-full bg-lavo-error/15 flex items-center justify-center mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8472A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>

              <h3
                id="dispute-modal-title"
                className="text-[18px] font-black text-[#0A0A14] dark:text-white text-center"
              >
                {t('dispute_modal_title')}
              </h3>
              <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] text-center leading-relaxed">
                {t('dispute_modal_desc')}
              </p>

              <form onSubmit={handleSubmitDispute} className="space-y-4">
                {/* Reason (required) */}
                <div>
                  <label htmlFor="dispute-reason" className="block text-[13px] font-bold text-[#0A0A14] dark:text-white mb-1.5">
                    {t('dispute_field_reason')} <span className="text-lavo-error">*</span>
                  </label>
                  <textarea
                    id="dispute-reason"
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder={t('dispute_field_reason_placeholder')}
                    maxLength={500}
                    rows={3}
                    required
                    className="w-full rounded-xl border border-[#D0D0C0] dark:border-tab-inactive bg-white dark:bg-[#131310] px-3.5 py-2.5 text-[13px] text-[#0A0A14] dark:text-white outline-none transition-colors placeholder:text-[#BBBBAA] dark:placeholder:text-[#555] focus:border-gold resize-none"
                  />
                  <p className="mt-1 text-[11px] text-[#999] dark:text-[#666] text-right">{disputeReason.length}/500</p>
                </div>

                {/* Description (optional) */}
                <div>
                  <label htmlFor="dispute-description" className="block text-[13px] font-bold text-[#0A0A14] dark:text-white mb-1.5">
                    {t('dispute_field_description')}
                  </label>
                  <textarea
                    id="dispute-description"
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
                    placeholder={t('dispute_field_description_placeholder')}
                    maxLength={2000}
                    rows={4}
                    className="w-full rounded-xl border border-[#D0D0C0] dark:border-tab-inactive bg-white dark:bg-[#131310] px-3.5 py-2.5 text-[13px] text-[#0A0A14] dark:text-white outline-none transition-colors placeholder:text-[#BBBBAA] dark:placeholder:text-[#555] focus:border-gold resize-none"
                  />
                  <p className="mt-1 text-[11px] text-[#999] dark:text-[#666] text-right">{disputeDescription.length}/2000</p>
                </div>

                {/* Requested amount (optional) */}
                <div>
                  <label htmlFor="dispute-amount" className="block text-[13px] font-bold text-[#0A0A14] dark:text-white mb-1.5">
                    {t('dispute_field_amount')}
                  </label>
                  <div className="relative">
                    <input
                      id="dispute-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="100000"
                      value={disputeAmount}
                      onChange={(e) => setDisputeAmount(e.target.value)}
                      placeholder={t('dispute_field_amount_placeholder')}
                      className="w-full rounded-xl border border-[#D0D0C0] dark:border-tab-inactive bg-white dark:bg-[#131310] px-3.5 py-2.5 pr-10 text-[13px] text-[#0A0A14] dark:text-white outline-none transition-colors placeholder:text-[#BBBBAA] dark:placeholder:text-[#555] focus:border-gold"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-[#999] dark:text-[#666]">$</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDisputeModal(false)}
                    disabled={disputeLoading}
                    className="flex-1 py-3 border-2 border-[#D0D0C0] dark:border-tab-inactive rounded-xl text-[14px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] dark:hover:bg-[#222220] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {t('dispute_btn_cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={disputeLoading || !disputeReason.trim()}
                    className="flex-1 py-3 bg-lavo-error hover:bg-lavo-error/90 rounded-xl text-[14px] font-bold text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {disputeLoading && (
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    )}
                    {disputeLoading ? t('dispute_btn_submitting') : t('dispute_btn_submit')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
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

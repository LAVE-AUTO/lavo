'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getFromApi, patchWithApi } from '@/services/axios-service';
import { useToast } from '@/context';
import { useAuth } from '@/context/auth-context';
import { RESERVATIONS_MOCK_ENABLED, MOCK_RESERVATIONS, MOCK_QUEUE_ENTRIES } from '@/data/reservations-mock';

type Tab = 'reservations' | 'queue';
type ReservationStatus = 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'pending_payment' | 'pending';
type QueueStatus = 'waiting' | 'in_progress';

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
  estimated_wait_minutes: number | null;
  slot_start_time: string | null;
  slot_end_time: string | null;
  is_rated?: boolean;
  is_tipped?: boolean;
}

/* ------------------------------------------------------------------ */
/* Client-side mapped shapes                                            */
/* ------------------------------------------------------------------ */

interface ClientReservation {
  id: string;
  stationId: string;
  stationName: string;
  stationAddress: string;
  stationImageUrl: string;
  stationLatitude: number;
  stationLongitude: number;
  forfaitName: string;
  categoryLabel: string;
  extras: string[];
  date: string;
  timeSlot: string;
  /** ISO start_time (used for past/upcoming sectioning + cancellation window). */
  slotStart: string | null;
  duration: number;
  totalPrice: number;
  status: ReservationStatus;
  ticketCode: string | null;
  createdAt: string;
  freeCancellationMinutes: number;
  isRated: boolean;
  isTipped: boolean;
}

interface ClientQueueEntry {
  id: string;
  stationId: string;
  stationName: string;
  stationAddress: string;
  stationImageUrl: string;
  stationLatitude: number;
  stationLongitude: number;
  forfaitName: string;
  categoryLabel: string;
  extras: string[];
  position: number;
  estimatedWaitMinutes: number;
  totalPrice: number;
  status: QueueStatus;
  ticketCode: string | null;
  joinedAt: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/** Free cancellation rule: more than 1h before service start (3 600 000 ms). */
const FREE_CANCEL_THRESHOLD_MS = 60 * 60 * 1000;

/** Signal-delay window: button surfaces only within the last 2h before start. */
const SIGNAL_DELAY_WINDOW_MS = 2 * 60 * 60 * 1000;

function msUntilStart(slotStart: string | null): number {
  if (!slotStart) return Infinity;
  return new Date(slotStart).getTime() - Date.now();
}

/**
 * `isWithinFeeWindow` is true when cancelling now would trigger the fee.
 * UX rule: free cancellation if more than 1h before start, fee otherwise.
 */
function isWithinFeeWindow(slotStart: string | null): boolean {
  const ms = msUntilStart(slotStart);
  return ms > 0 && ms <= FREE_CANCEL_THRESHOLD_MS;
}

/** Surface the "I'm running late" button only within the last 2 hours. */
function canSignalDelay(slotStart: string | null): boolean {
  const ms = msUntilStart(slotStart);
  return ms > 0 && ms <= SIGNAL_DELAY_WINDOW_MS;
}

function isPastReservation(r: ClientReservation): boolean {
  if (r.status === 'completed' || r.status === 'cancelled') return true;
  if (!r.slotStart) return false;
  return new Date(r.slotStart).getTime() <= Date.now();
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

function enrichEntry(entry: ApiRichEntry): ClientReservation | ClientQueueEntry {
  const stationName = entry.station?.name ?? `#${entry.station_id.slice(0, 8)}`;
  const stationAddress = entry.station ? `${entry.station.address}, ${entry.station.city}` : '';
  const stationLatitude = entry.station?.latitude ? parseFloat(entry.station.latitude) : 0;
  const stationLongitude = entry.station?.longitude ? parseFloat(entry.station.longitude) : 0;
  const stationImageUrl = entry.station?.image_url ?? '';
  const forfaitName = entry.vehicle_format?.label ?? '-';
  const totalPrice = parseFloat(entry.amount_paid ?? '0');

  const base = {
    stationId: entry.station_id,
    stationName,
    stationAddress,
    stationImageUrl,
    stationLatitude,
    stationLongitude,
    forfaitName,
    categoryLabel: '',
    extras: [] as string[],
    ticketCode: entry.ticket_code,
  };

  if (entry.entry_type === 'reservation') {
    const { date, timeSlot } = entry.slot_start_time
      ? slotToDateParts(entry.slot_start_time)
      : { date: entry.created_at.split('T')[0], timeSlot: '00:00' };
    /* duration: derive from slot when both timestamps are present, fall back to 30 min. */
    const duration = (() => {
      if (!entry.slot_start_time || !entry.slot_end_time) return 30;
      const ms = new Date(entry.slot_end_time).getTime() - new Date(entry.slot_start_time).getTime();
      return Math.max(1, Math.round(ms / 60_000));
    })();
    return {
      id: entry.id,
      ...base,
      date,
      timeSlot,
      slotStart: entry.slot_start_time,
      duration,
      totalPrice,
      status: entry.status as ReservationStatus,
      createdAt: entry.created_at,
      freeCancellationMinutes: entry.station?.free_cancellation_minutes ?? 60,
      isRated: Boolean(entry.is_rated),
      isTipped: Boolean(entry.is_tipped),
    };
  }

  return {
    id: entry.id,
    ...base,
    position: entry.queue_position ?? 1,
    estimatedWaitMinutes: entry.estimated_wait_minutes ?? 0,
    totalPrice,
    status: (entry.status === 'in_progress' ? 'in_progress' : 'waiting') as QueueStatus,
    joinedAt: entry.created_at,
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function ClientReservationsPage() {
  const t      = useTranslations('coupons');
  const locale = useLocale();
  const { success, error } = useToast();
  const { isLoading: authLoading } = useAuth();
  const router = useRouter();

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [tab, setTab]                     = useState<Tab>('reservations');
  const [reservations, setReservations]   = useState<ClientReservation[]>([]);
  const [queueEntries, setQueueEntries]   = useState<ClientQueueEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState(false);
  const [cancelTarget, setCancelTarget]   = useState<ClientReservation | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  /* Queue actions: leave (refund) or leave + book a slot at the same station. */
  const [queueAction, setQueueAction] = useState<{ entry: ClientQueueEntry; mode: 'leave' | 'leave_and_book' } | null>(null);
  const [queueActionLoading, setQueueActionLoading] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    // TODO: remove mock block once booking flow is connected to Stripe
    if (RESERVATIONS_MOCK_ENABLED) {
      setReservations(MOCK_RESERVATIONS as unknown as ClientReservation[]);
      setQueueEntries(MOCK_QUEUE_ENTRIES as unknown as ClientQueueEntry[]);
      setLoading(false);
      return;
    }

    /* /me/entries returns rich entries with denormalised station, vehicle format
     * and slot times - no N+1 fetch needed. */
    const [ok, data] = await getFromApi('/me/entries?per_page=100');
    if (!mountedRef.current) return;

    if (!ok) {
      setLoadError(true);
      setLoading(false);
      error(t('error_load'));
      return;
    }

    const res = data as { data: { entries: ApiRichEntry[] } };
    const entries: ApiRichEntry[] = res?.data?.entries ?? [];

    const resArr: ClientReservation[] = [];
    const queueArr: ClientQueueEntry[] = [];
    for (const entry of entries) {
      const enriched = enrichEntry(entry);
      if (entry.entry_type === 'reservation') resArr.push(enriched as ClientReservation);
      else queueArr.push(enriched as ClientQueueEntry);
    }
    setReservations(resArr);
    setQueueEntries(queueArr);
    setLoading(false);
  }, [error, t]);

  useEffect(() => {
    if (!authLoading) loadEntries();
  }, [authLoading, loadEntries]);

  /* Sectioning by time, not by status:
   *  - upcoming: slot is in the future AND status is not terminal (cancelled / completed)
   *  - past:     status is cancelled / completed OR slot has passed
   * Sort upcoming by slot ASC (next first) and past by slot DESC (most recent first). */
  const upcoming = useMemo(
    () =>
      [...reservations]
        .filter((r) => !isPastReservation(r))
        .sort((a, b) => {
          const ta = a.slotStart ? new Date(a.slotStart).getTime() : Infinity;
          const tb = b.slotStart ? new Date(b.slotStart).getTime() : Infinity;
          return ta - tb;
        }),
    [reservations],
  );
  const past = useMemo(
    () =>
      [...reservations]
        .filter(isPastReservation)
        .sort((a, b) => {
          const ta = a.slotStart ? new Date(a.slotStart).getTime() : new Date(a.createdAt).getTime();
          const tb = b.slotStart ? new Date(b.slotStart).getTime() : new Date(b.createdAt).getTime();
          return tb - ta;
        }),
    [reservations],
  );
  /* Top-of-page prompts surface only the most recent COMPLETED reservation
   * that still needs a rating / tip. The card-level buttons handle older
   * un-rated entries. Once `is_rated` / `is_tipped` flips to true, both the
   * top prompt and the card button disappear automatically. */
  const pendingRating = useMemo(
    () =>
      [...reservations]
        .filter((r) => r.status === 'completed' && !r.isRated)
        .sort((a, b) => {
          const ta = a.slotStart ? new Date(a.slotStart).getTime() : new Date(a.createdAt).getTime();
          const tb = b.slotStart ? new Date(b.slotStart).getTime() : new Date(b.createdAt).getTime();
          return tb - ta;
        })[0],
    [reservations],
  );
  const pendingTip = useMemo(
    () =>
      [...reservations]
        .filter((r) => r.status === 'completed' && !r.isTipped)
        .sort((a, b) => {
          const ta = a.slotStart ? new Date(a.slotStart).getTime() : new Date(a.createdAt).getTime();
          const tb = b.slotStart ? new Date(b.slotStart).getTime() : new Date(b.createdAt).getTime();
          return tb - ta;
        })[0],
    [reservations],
  );

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    const [ok] = await patchWithApi(`/me/entries/${cancelTarget.id}/cancel`, {});
    setCancelLoading(false);
    if (ok) {
      setCancelTarget(null);
      success(t('toast_cancel_success'));
      await loadEntries();
    } else {
      error(t('toast_cancel_error'));
    }
  };

  /**
   * Both queue actions cancel the queue entry first (full refund). The
   * "leave + book" variant then redirects to the station detail so the user
   * can pick a service slot via the per-post booking flow.
   */
  const handleQueueActionConfirm = async () => {
    if (!queueAction) return;
    setQueueActionLoading(true);
    const [ok] = await patchWithApi(`/me/entries/${queueAction.entry.id}/cancel`, {});
    setQueueActionLoading(false);
    if (!ok) {
      error(t('toast_cancel_error'));
      return;
    }
    success(t('toast_queue_leave_success'));
    const stationId = queueAction.entry.stationId;
    const mode = queueAction.mode;
    setQueueAction(null);
    if (mode === 'leave_and_book') {
      router.push(`/stations/${stationId}`);
      return;
    }
    await loadEntries();
  };

  /* Loading state */
  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] flex items-center justify-center pb-24 sm:pb-8">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      </main>
    );
  }

  /* Error state */
  if (loadError) {
    return (
      <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] flex flex-col items-center justify-center gap-3 pb-24 sm:pb-8 text-center">
        <p className="text-[15px] font-semibold text-[#555] dark:text-[#B0B0A0]">{t('error_load')}</p>
        <button
          type="button"
          onClick={loadEntries}
          className="rounded-[10px] border border-gold/50 px-4 py-2 text-[13px] font-semibold text-gold transition-colors hover:bg-gold/10"
        >
          {t('btn_retry')}
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-[#0F0F0D] pb-24 sm:pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <h1 className="text-[22px] font-black text-[#0A0A14] dark:text-white">{t('title')}</h1>
      </div>

      {/* Rating prompt - shown when a completed reservation has not yet been rated */}
      {pendingRating && (
        <div className="px-4 max-w-2xl mx-auto mb-4">
          <div className="flex items-center gap-3 bg-gold/10 border border-gold/30 rounded-xl p-4">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#af8408" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-[#0A0A14] dark:text-white leading-snug">{t('rating_prompt_title')}</p>
              <p className="text-[12px] text-[#666] dark:text-[#B0B0A0] mt-0.5 truncate">{pendingRating.stationName}</p>
            </div>
            <Link
              href={`/client/reservations/${pendingRating.id}/rate`}
              className="shrink-0 px-3 py-2 bg-gold hover:bg-gold-hover rounded-[10px] text-[13px] font-black text-dark-bg transition-colors"
            >
              {t('rate_btn')}
            </Link>
          </div>
        </div>
      )}

      {/* Tip prompt - shown when a completed reservation has not yet received a tip */}
      {pendingTip && (
        <div className="px-4 max-w-2xl mx-auto mb-4">
          <div className="flex items-center gap-3 bg-[#E8E8D8] dark:bg-dark-card border border-[#D0D0C0] dark:border-tab-inactive rounded-xl p-4">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#af8408" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-[#0A0A14] dark:text-white leading-snug">{t('tip_prompt_title')}</p>
              <p className="text-[12px] text-[#666] dark:text-[#B0B0A0] mt-0.5 truncate">{pendingTip.stationName}</p>
            </div>
            <Link
              href={`/client/reservations/${pendingTip.id}/tip`}
              className="shrink-0 px-3 py-2 border border-gold/50 rounded-[10px] text-[13px] font-bold text-gold hover:bg-gold/10 transition-colors"
            >
              {t('tip_btn')}
            </Link>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 max-w-2xl mx-auto">
        <div className="flex bg-[#E0E0D0] dark:bg-dark-card rounded-xl p-1 mb-6">
          {(['reservations', 'queue'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                'flex-1 py-2.5 rounded-lg text-[14px] font-bold transition-all cursor-pointer',
                tab === key
                  ? 'bg-gold text-dark-bg shadow-sm'
                  : 'text-[#555] dark:text-[#B0B0A0] hover:text-[#0A0A14] dark:hover:text-white',
              ].join(' ')}
            >
              {t(`tab_${key}`)}
              <span className="ml-1.5 text-[12px] font-semibold opacity-70">
                ({key === 'reservations' ? reservations.length : queueEntries.length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 max-w-2xl mx-auto">
        {tab === 'reservations' ? (
          <div className="space-y-6">
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-[15px] font-black text-[#555] dark:text-[#B0B0A0] uppercase tracking-widest mb-3">
                  {t('upcoming')}
                  <span className="ml-2 text-[12px] font-semibold opacity-70">({upcoming.length})</span>
                </h2>
                <div className="space-y-3">
                  {upcoming.map((res) => (
                    <ReservationCard
                      key={res.id}
                      reservation={res}
                      t={t}
                      locale={locale}
                      variant="upcoming"
                      onCancel={
                        res.status === 'confirmed' || res.status === 'pending'
                          ? () => setCancelTarget(res)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="text-[15px] font-black text-[#555] dark:text-[#B0B0A0] uppercase tracking-widest mb-3">
                  {t('past')}
                  <span className="ml-2 text-[12px] font-semibold opacity-70">({past.length})</span>
                </h2>
                <div className="space-y-3">
                  {past.map((res) => (
                    <ReservationCard
                      key={res.id}
                      reservation={res}
                      t={t}
                      locale={locale}
                      variant="past"
                    />
                  ))}
                </div>
              </section>
            )}

            {reservations.length === 0 && (
              <EmptyState
                title={t('empty_reservations_title')}
                description={t('empty_reservations_desc')}
                ctaLabel={t('empty_reservations_cta')}
                ctaHref="/stations"
                historyLabel={t('empty_reservations_history')}
              />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {queueEntries.length > 0 ? (
              queueEntries.map((entry) => (
                <QueueCard
                  key={entry.id}
                  entry={entry}
                  t={t}
                  onLeave={() => setQueueAction({ entry, mode: 'leave' })}
                  onLeaveAndBook={() => setQueueAction({ entry, mode: 'leave_and_book' })}
                />
              ))
            ) : (
              <EmptyState
                title={t('empty_queue_title')}
                description={t('empty_queue_desc')}
                ctaLabel={t('empty_queue_cta')}
                ctaHref="/stations"
                historyLabel={t('empty_queue_history')}
              />
            )}
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <CancelModal
          reservation={cancelTarget}
          loading={cancelLoading}
          t={t}
          locale={locale}
          onConfirm={handleCancelConfirm}
          onClose={() => { if (!cancelLoading) setCancelTarget(null); }}
        />
      )}

      {/* Queue leave / leave + book confirmation */}
      <ConfirmDialog
        open={queueAction !== null}
        title={
          queueAction?.mode === 'leave_and_book'
            ? t('queue_leave_and_book_title')
            : t('queue_leave_title')
        }
        message={
          queueAction?.mode === 'leave_and_book'
            ? t('queue_leave_and_book_message')
            : t('queue_leave_message')
        }
        variant={queueAction?.mode === 'leave_and_book' ? 'default' : 'danger'}
        confirmLabel={
          queueAction?.mode === 'leave_and_book'
            ? t('queue_leave_and_book')
            : t('queue_leave')
        }
        cancelLabel={t('cancel_modal_keep')}
        loading={queueActionLoading}
        onConfirm={handleQueueActionConfirm}
        onCancel={() => { if (!queueActionLoading) setQueueAction(null); }}
      />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Reservation card                                                     */
/* ------------------------------------------------------------------ */

function ReservationCard({
  reservation: r,
  t,
  locale,
  variant,
  onCancel,
}: {
  reservation: ClientReservation;
  t: ReturnType<typeof useTranslations>;
  locale: string;
  variant: 'upcoming' | 'past';
  onCancel?: () => void;
}) {
  const dateObj   = new Date(`${r.date}T${r.timeSlot}`);
  const dateLabel = dateObj.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  const statusColors: Record<string, string> = {
    confirmed:       'bg-lavo-success/15 text-lavo-success',
    in_progress:     'bg-gold/15 text-gold',
    completed:       'bg-[#999]/15 text-[#666]',
    cancelled:       'bg-lavo-error/15 text-lavo-error',
    pending:         'bg-blue-500/15 text-blue-500',
    pending_payment: 'bg-[#999]/15 text-[#888]',
  };

  /* Upcoming actions are hidden once the entry is in_progress (only the
   * station can act on it from that point). Two time-based rules:
   *   - signalDelay: surfaces only within the last 2h before service start
   *     (no point warning a station 5 days in advance)
   *   - reschedule:  available for confirmed/pending entries until start */
  const canReschedule = variant === 'upcoming' && (r.status === 'confirmed' || r.status === 'pending');
  const showSignalDelay = variant === 'upcoming' && r.status === 'confirmed' && canSignalDelay(r.slotStart);

  /* Past completed reservations keep rate/tip buttons until each is filled. */
  const showRateAction = variant === 'past' && r.status === 'completed' && !r.isRated;
  const showTipAction  = variant === 'past' && r.status === 'completed' && !r.isTipped;

  const showActions =
    variant === 'upcoming'
      ? onCancel || canReschedule || showSignalDelay
      : showRateAction || showTipAction;

  return (
    <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive overflow-hidden hover:border-gold/30 transition-colors">
      <Link href={`/client/reservations/${r.id}`} className="block p-4">
        <div className="flex gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#D0D0C0] dark:bg-tab-inactive flex items-center justify-center">
            {r.stationImageUrl ? (
              <img src={r.stationImageUrl} alt={r.stationName} className="w-full h-full object-cover" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 17l2-7h14l2 7" /><path d="M5 17v2h2v-2M17 17v2h2v-2" /><circle cx="7.5" cy="17" r="1.5" fill="#9A9A8A" /><circle cx="16.5" cy="17" r="1.5" fill="#9A9A8A" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-bold text-[#0A0A14] dark:text-white leading-tight truncate">
                {r.stationName}
              </h3>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${statusColors[r.status] || 'bg-gray-200 text-gray-600'}`}>
                {t(`status_${r.status}`)}
              </span>
            </div>

            <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-0.5 truncate">
              {r.forfaitName}
            </p>

            <div className="flex items-center gap-3 mt-2 text-[13px]">
              <span className="flex items-center gap-1 text-[#555] dark:text-[#C0C0B0]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                {dateLabel}
              </span>
              <span className="flex items-center gap-1 text-[#555] dark:text-[#C0C0B0]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                {r.timeSlot}
              </span>
              <span className="ml-auto font-bold text-gold">{r.totalPrice.toFixed(2)}$</span>
            </div>

            {/* Service code reminder for upcoming entries */}
            {variant === 'upcoming' && r.ticketCode && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gold/10 border border-gold/30 text-[11px] font-bold text-gold">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <span className="font-mono tracking-[2px]">{r.ticketCode}</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {showActions && (
        <div className="px-4 pb-3 pt-2 border-t border-[#D0D0C0] dark:border-tab-inactive flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {canReschedule && (
            <Link
              href={`/client/reservations/${r.id}/reschedule`}
              className="text-[13px] font-semibold text-gold hover:opacity-75 transition-opacity"
            >
              {t('reschedule_btn')}
            </Link>
          )}
          {showSignalDelay && (
            <Link
              href={`/client/reservations/${r.id}/signal-delay`}
              className="text-[13px] font-semibold text-[#666] dark:text-[#B0B0A0] hover:text-gold transition-colors"
            >
              {t('signal_delay_btn')}
            </Link>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[13px] font-semibold text-lavo-error hover:opacity-75 transition-opacity cursor-pointer"
            >
              {t('cancel_reservation')}
            </button>
          )}
          {showRateAction && (
            <Link
              href={`/client/reservations/${r.id}/rate`}
              className="text-[13px] font-semibold text-gold hover:opacity-75 transition-opacity"
            >
              {t('rate_btn')}
            </Link>
          )}
          {showTipAction && (
            <Link
              href={`/client/reservations/${r.id}/tip`}
              className="text-[13px] font-semibold text-[#666] dark:text-[#B0B0A0] hover:text-gold transition-colors"
            >
              {t('tip_btn')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cancel confirmation modal                                            */
/* ------------------------------------------------------------------ */

function CancelModal({
  reservation: r,
  loading,
  t,
  locale,
  onConfirm,
  onClose,
}: {
  reservation: ClientReservation;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
  locale: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();

    /* Focus trap - keep Tab cycling within the modal */
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  /* UX rule: free cancellation if more than 1h before service start. Within
   * the last hour, the station applies a fee. */
  const showFeesWarning = isWithinFeeWindow(r.slotStart);
  const dateLabel = new Date(`${r.date}T${r.timeSlot}`).toLocaleDateString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { weekday: 'short', day: 'numeric', month: 'short' },
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
        className="w-full sm:max-w-sm bg-[#F5F5E6] dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up mb-14 sm:mb-0"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#D0D0C0] dark:border-tab-inactive">
          <h2 id="cancel-modal-title" className="text-[17px] font-black text-[#0A0A14] dark:text-white">{t('cancel_modal_title')}</h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div className="rounded-xl bg-[#E8E8D8] dark:bg-dark-card border border-[#D0D0C0] dark:border-tab-inactive p-3.5">
            <p className="text-[14px] font-bold text-[#0A0A14] dark:text-white">{r.stationName}</p>
            <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-0.5">
              {r.forfaitName} &mdash; {dateLabel} {r.timeSlot}
            </p>
            <p className="text-[15px] font-black text-gold mt-1">{r.totalPrice.toFixed(2)}$</p>
          </div>

          <p className="text-[13px] text-[#555] dark:text-[#C0C0B0]">{t('cancel_modal_desc')}</p>

          {showFeesWarning && (
            <div className="flex gap-2.5 bg-lavo-error/10 border border-lavo-error/20 rounded-xl px-3.5 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8472A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-[12px] font-semibold text-lavo-error leading-relaxed">
                {t('cancel_modal_fees_warning')}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[#D0D0C0] dark:border-tab-inactive flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-xl text-[14px] font-bold border-2 border-[#D0D0C0] dark:border-tab-inactive text-[#555] dark:text-[#B0B0A0] hover:bg-[#E0E0D0] dark:hover:bg-tab-inactive transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('cancel_modal_keep')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-xl text-[14px] font-black text-white bg-lavo-error hover:bg-lavo-error/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            )}
            {t('cancel_modal_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Queue card                                                           */
/* ------------------------------------------------------------------ */

function QueueCard({
  entry: q,
  t,
  onLeave,
  onLeaveAndBook,
}: {
  entry: ClientQueueEntry;
  t: ReturnType<typeof useTranslations>;
  onLeave: () => void;
  onLeaveAndBook: () => void;
}) {
  const isActive = q.status === 'in_progress';
  /* In-progress entries are being served right now: only the station can act
   * on them. Cancellation buttons disappear in that state. */
  const showActions = !isActive;

  return (
    <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive overflow-hidden hover:border-gold/30 transition-colors">
      <Link href={`/client/reservations/queue/${q.id}`} className="block p-4">
        <div className="flex gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#D0D0C0] dark:bg-tab-inactive flex items-center justify-center">
            {q.stationImageUrl ? (
              <img src={q.stationImageUrl} alt={q.stationName} className="w-full h-full object-cover" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 17l2-7h14l2 7" /><path d="M5 17v2h2v-2M17 17v2h2v-2" /><circle cx="7.5" cy="17" r="1.5" fill="#9A9A8A" /><circle cx="16.5" cy="17" r="1.5" fill="#9A9A8A" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-bold text-[#0A0A14] dark:text-white leading-tight truncate">
                {q.stationName}
              </h3>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${isActive ? 'bg-gold/15 text-gold' : 'bg-blue-500/15 text-blue-500'}`}>
                {isActive ? t('queue_in_progress') : t('queue_waiting')}
              </span>
            </div>

            <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-0.5 truncate">{q.forfaitName}</p>

            <div className="flex items-center gap-3 mt-2 text-[13px]">
              <span className="flex items-center gap-1 text-[#555] dark:text-[#C0C0B0]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
                {t('queue_position', { position: q.position })}
              </span>
              <span className="ml-auto font-bold text-gold">{q.totalPrice.toFixed(2)}$</span>
            </div>

            {q.ticketCode && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gold/10 border border-gold/30 text-[11px] font-bold text-gold">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <span className="font-mono tracking-[2px]">{q.ticketCode}</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {showActions && (
        <div className="px-4 pb-3 pt-2 border-t border-[#D0D0C0] dark:border-tab-inactive flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <button
            type="button"
            onClick={onLeaveAndBook}
            className="text-[13px] font-semibold text-gold hover:opacity-75 transition-opacity cursor-pointer"
          >
            {t('queue_leave_and_book')}
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="text-[13px] font-semibold text-lavo-error hover:opacity-75 transition-opacity cursor-pointer"
          >
            {t('queue_leave')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                          */
/* ------------------------------------------------------------------ */

function EmptyState({
  title,
  description,
  ctaLabel,
  ctaHref,
  historyLabel,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: '/stations';
  historyLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16 gap-5 text-center px-4">
      <div className="w-20 h-20 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#af8408" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 9a2 2 0 012-2h16a2 2 0 012 2v1a2 2 0 010 4v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1a2 2 0 010-4V9z" />
          <path d="M9 7v10" strokeDasharray="2 2" />
        </svg>
      </div>
      <div className="max-w-sm">
        <h2 className="text-[17px] sm:text-[19px] font-black text-[#0A0A14] dark:text-white">{title}</h2>
        <p className="mt-2 text-[14px] text-[#666] dark:text-[#B0B0A0] leading-relaxed">{description}</p>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto pt-2">
        <Link
          href={ctaHref}
          className="btn-shine inline-flex items-center justify-center gap-2 px-7 py-3 bg-gold hover:bg-gold-hover rounded-md text-[14px] font-bold text-dark-bg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(200,152,10,0.35)]"
        >
          {ctaLabel}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
        <Link
          href="/client/history"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-[#D0D0C0] dark:border-tab-inactive hover:border-gold/50 rounded-md text-[14px] font-semibold text-[#555] dark:text-[#B0B0A0] hover:text-gold transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {historyLabel}
        </Link>
      </div>
    </div>
  );
}

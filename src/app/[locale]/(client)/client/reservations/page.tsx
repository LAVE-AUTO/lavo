'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getFromApi, patchWithApi } from '@/services/axios-service';
import { useToast } from '@/context';
import { useAuth } from '@/context/auth-context';
import { RESERVATIONS_MOCK_ENABLED, MOCK_RESERVATIONS, MOCK_QUEUE_ENTRIES } from '@/data/reservations-mock';

type Tab = 'reservations' | 'queue';
type ReservationStatus = 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'pending_payment' | 'pending';
type QueueStatus = 'waiting' | 'in_progress';

/* ------------------------------------------------------------------ */
/* API shapes (match backend response)                                  */
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
/* Enriched client-side shapes                                          */
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
  duration: number;
  totalPrice: number;
  status: ReservationStatus;
  createdAt: string;
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
  joinedAt: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function isWithinOneHour(date: string, timeSlot: string): boolean {
  const slotTime = new Date(`${date}T${timeSlot}`);
  const diff = slotTime.getTime() - Date.now();
  return diff > 0 && diff < 60 * 60 * 1000;
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

function enrichEntry(entry: ApiEntry, stationsMap: Map<string, ApiStation>): ClientReservation | ClientQueueEntry {
  const station = stationsMap.get(entry.station_id);
  const format = station?.vehicleFormats.find((f) => f.id === entry.vehicle_format_id);
  const slot = entry.time_slot_id
    ? station?.timeSlots.find((s) => s.id === entry.time_slot_id)
    : undefined;

  const stationName = station?.name ?? `#${entry.station_id.slice(0, 8)}`;
  const stationAddress = station ? `${station.address}, ${station.city}` : '';
  const stationLatitude = parseFloat(station?.latitude ?? '0');
  const stationLongitude = parseFloat(station?.longitude ?? '0');
  const forfaitName = format?.label ?? '—';
  const totalPrice = parseFloat(entry.amount_paid ?? '0');
  const duration = station?.stationConfig?.wash_duration_minutes ?? 30;

  const base = {
    stationId: entry.station_id,
    stationName,
    stationAddress,
    stationImageUrl: '',
    stationLatitude,
    stationLongitude,
    forfaitName,
    categoryLabel: '',
    extras: [] as string[],
  };

  if (entry.entry_type === 'reservation') {
    const { date, timeSlot } = slot
      ? slotToDateParts(slot.start_time)
      : { date: entry.created_at.split('T')[0], timeSlot: '00:00' };
    return {
      id: entry.id,
      ...base,
      date,
      timeSlot,
      duration,
      totalPrice,
      status: entry.status as ReservationStatus,
      createdAt: entry.created_at,
    };
  }

  return {
    id: entry.id,
    ...base,
    position: entry.queue_position ?? 0,
    estimatedWaitMinutes: 0,
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

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [tab, setTab]                     = useState<Tab>('reservations');
  const [reservations, setReservations]   = useState<ClientReservation[]>([]);
  const [queueEntries, setQueueEntries]   = useState<ClientQueueEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState(false);
  const [cancelTarget, setCancelTarget]   = useState<ClientReservation | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

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

    const [ok, data] = await getFromApi('/me/entries?per_page=50');
    if (!mountedRef.current) return;

    if (!ok) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    const res = data as { data: { entries: ApiEntry[] } };
    const entries: ApiEntry[] = res?.data?.entries ?? [];

    /* Batch-fetch unique stations to enrich entries with name/address/formats/slots */
    const stationIds = [...new Set(entries.map((e) => e.station_id))];
    const stationResults = await Promise.all(
      stationIds.map((id) => getFromApi(`/stations/${id}`)),
    );
    if (!mountedRef.current) return;

    const stationsMap = new Map<string, ApiStation>();
    stationIds.forEach((id, i) => {
      const [stationOk, stationData] = stationResults[i];
      if (stationOk && stationData) {
        stationsMap.set(id, (stationData as { data: ApiStation }).data);
      }
    });

    const resArr: ClientReservation[] = [];
    const queueArr: ClientQueueEntry[] = [];
    for (const entry of entries) {
      const enriched = enrichEntry(entry, stationsMap);
      if (entry.entry_type === 'reservation') resArr.push(enriched as ClientReservation);
      else queueArr.push(enriched as ClientQueueEntry);
    }
    setReservations(resArr);
    setQueueEntries(queueArr);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) loadEntries();
  }, [authLoading, loadEntries]);

  const upcoming = useMemo(
    () => reservations.filter((r) => r.status === 'confirmed' || r.status === 'in_progress' || r.status === 'pending'),
    [reservations],
  );
  const past = useMemo(
    () => reservations.filter((r) => r.status === 'completed' || r.status === 'cancelled'),
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
                ({key === 'reservations' ? upcoming.length : queueEntries.length})
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
                </h2>
                <div className="space-y-3">
                  {upcoming.map((res) => (
                    <ReservationCard
                      key={res.id}
                      reservation={res}
                      t={t}
                      locale={locale}
                      onCancel={res.status === 'confirmed' ? () => setCancelTarget(res) : undefined}
                    />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="text-[15px] font-black text-[#555] dark:text-[#B0B0A0] uppercase tracking-widest mb-3">
                  {t('past')}
                </h2>
                <div className="space-y-3">
                  {past.map((res) => (
                    <ReservationCard key={res.id} reservation={res} t={t} locale={locale} />
                  ))}
                </div>
              </section>
            )}

            {reservations.length === 0 && <EmptyState message={t('empty_reservations')} />}
          </div>
        ) : (
          <div className="space-y-3">
            {queueEntries.length > 0 ? (
              queueEntries.map((entry) => (
                <QueueCard key={entry.id} entry={entry} t={t} />
              ))
            ) : (
              <EmptyState message={t('empty_queue')} />
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
  onCancel,
}: {
  reservation: ClientReservation;
  t: ReturnType<typeof useTranslations>;
  locale: string;
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

  return (
    <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive overflow-hidden hover:border-gold/30 transition-colors">
      <Link href={`/client/reservations/${r.id}`} className="block p-4">
        <div className="flex gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#D0D0C0] dark:bg-tab-inactive">
            {r.stationImageUrl && (
              <img src={r.stationImageUrl} alt={r.stationName} className="w-full h-full object-cover" />
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

            <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-0.5">
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
          </div>
        </div>
      </Link>

      {onCancel && (
        <div className="px-4 pb-3 pt-2 border-t border-[#D0D0C0] dark:border-tab-inactive">
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] font-semibold text-lavo-error hover:opacity-75 transition-opacity cursor-pointer"
          >
            {t('cancel_reservation')}
          </button>
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

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const showFeesWarning = isWithinOneHour(r.date, r.timeSlot);
  const dateLabel = new Date(`${r.date}T${r.timeSlot}`).toLocaleDateString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { weekday: 'short', day: 'numeric', month: 'short' },
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
        className="w-full sm:max-w-sm bg-[#F5F5E6] dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up mb-14 sm:mb-0"
        onClick={(e) => e.stopPropagation()}
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

function QueueCard({ entry: q, t }: { entry: ClientQueueEntry; t: ReturnType<typeof useTranslations> }) {
  const isActive = q.status === 'in_progress';
  return (
    <Link
      href={`/client/reservations/queue/${q.id}`}
      className="block bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-4 hover:border-gold/30 transition-colors"
    >
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#D0D0C0] dark:bg-tab-inactive">
          {q.stationImageUrl && (
            <img src={q.stationImageUrl} alt={q.stationName} className="w-full h-full object-cover" />
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

          <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-0.5">{q.forfaitName}</p>

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
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                          */
/* ------------------------------------------------------------------ */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[#E0E0D0] dark:bg-dark-card flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 9a2 2 0 012-2h16a2 2 0 012 2v1a2 2 0 010 4v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1a2 2 0 010-4V9z" />
          <path d="M9 7v10" strokeDasharray="2 2" />
        </svg>
      </div>
      <p className="text-[15px] text-[#555] dark:text-[#C0C0B0] max-w-xs">{message}</p>
    </div>
  );
}

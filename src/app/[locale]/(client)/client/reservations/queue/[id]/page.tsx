'use client';

import { use, useEffect, useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { getFromApi } from '@/services/axios-service';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import UpgradeToReservationModal from '@/components/reservations/UpgradeToReservationModal';

/* ------------------------------------------------------------------ */
/* API shapes                                                           */
/* ------------------------------------------------------------------ */

interface ApiEntry {
  id: string;
  entry_type: 'reservation' | 'queue';
  station_id: string;
  vehicle_format_id: string | null;
  status: string;
  queue_position: number | null;
  amount_paid: string | null;
  created_at: string;
}

interface ApiVehicleFormat { id: string; label: string }
interface ApiStation {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: string | null;
  longitude: string | null;
  vehicleFormats: ApiVehicleFormat[];
}

interface QueueEntry {
  id: string;
  stationId: string;
  stationName: string;
  stationAddress: string;
  stationLatitude: number;
  stationLongitude: number;
  forfaitName: string;
  position: number;
  totalPrice: number;
  status: 'waiting' | 'in_progress';
}

/* ------------------------------------------------------------------ */
/* Simulate real-time position by decrementing every 30s               */
/* ------------------------------------------------------------------ */

function useRealtimePosition(initial: number) {
  const [position, setPosition] = useState(initial);
  useEffect(() => { setPosition(initial); }, [initial]);
  useEffect(() => {
    if (position <= 1) return;
    const id = setInterval(() => setPosition((p) => (p > 1 ? p - 1 : p)), 30_000);
    return () => clearInterval(id);
  }, [position]);
  return position;
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function QueueDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const t = useTranslations('queue_detail');
  const router = useRouter();
  const { error: showError } = useToast();
  const { isLoading: authLoading } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [entry, setEntry]   = useState<QueueEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const loadEntry = useCallback(async () => {
    setLoading(true);
    try {
      const [ok, data] = await getFromApi('/me/entries?per_page=100');
      if (!mountedRef.current) return;

      if (!ok) { setMissing(true); showError(t('error_load')); return; }

      const res = data as { data: { entries: ApiEntry[] } };
      const found = (res?.data?.entries ?? []).find((e) => e.id === id && e.entry_type === 'queue');

      if (!found) { setMissing(true); showError(t('error_not_found')); return; }

      const [stationOk, stationData] = await getFromApi(`/stations/${found.station_id}`);
      if (!mountedRef.current) return;

      const station = stationOk && stationData
        ? (stationData as { data: ApiStation }).data
        : null;

      const format = station?.vehicleFormats.find((f) => f.id === found.vehicle_format_id);

      setEntry({
        id: found.id,
        stationId: found.station_id,
        stationName: station?.name ?? `#${found.station_id.slice(0, 8)}`,
        stationAddress: station ? `${station.address}, ${station.city}` : '',
        stationLatitude: parseFloat(station?.latitude ?? '0'),
        stationLongitude: parseFloat(station?.longitude ?? '0'),
        forfaitName: format?.label ?? '—',
        position: found.queue_position ?? 0,
        totalPrice: parseFloat(found.amount_paid ?? '0'),
        status: found.status === 'in_progress' ? 'in_progress' : 'waiting',
      });
    } catch {
      if (mountedRef.current) { setMissing(true); showError(t('error_load')); }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading) loadEntry();
  }, [authLoading, loadEntry]);

  const position = useRealtimePosition(entry?.position ?? 0);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F5E6] dark:bg-dark-bg flex items-center justify-center pb-24">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      </main>
    );
  }

  if (missing || !entry) {
    return (
      <main className="min-h-screen bg-[#F5F5E6] dark:bg-dark-bg flex flex-col items-center justify-center gap-4 pb-24">
        <p className="text-[14px] font-semibold text-[#555] dark:text-[#B0B0A0]">{t('error_not_found')}</p>
        <Link
          href="/client/reservations"
          className="rounded-[10px] border-[1.5px] border-gold/50 px-4 py-2 text-[13px] font-semibold text-gold hover:bg-gold/10 transition-colors"
        >
          {t('back')}
        </Link>
      </main>
    );
  }

  const q        = entry;
  const isActive = q.status === 'in_progress';

  const mapsUrl = q.stationLatitude !== 0
    ? `https://www.google.com/maps/dir/?api=1&destination=${q.stationLatitude},${q.stationLongitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${q.stationName}, ${q.stationAddress}`)}`;

  return (
    <main className="min-h-screen bg-[#F5F5E6] dark:bg-dark-bg pb-24 sm:pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto flex items-center gap-3">
        <Link
          href="/client/reservations"
          className="w-9 h-9 rounded-full bg-[#E8E8D8] dark:bg-dark-card flex items-center justify-center hover:bg-[#D0D0C0] dark:hover:bg-tab-inactive transition-colors"
          aria-label={t('back')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </Link>
        <h1 className="text-[20px] font-black text-[#0A0A14] dark:text-white">{t('title')}</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4">

        {/* Station card */}
        <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-4">
          <h2 className="text-[17px] font-black text-[#0A0A14] dark:text-white">{q.stationName}</h2>
          <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-0.5">{q.stationAddress}</p>
          <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-1">{q.forfaitName}</p>
        </div>

        {/* Live position panel */}
        <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 animate-pulse ${isActive ? 'bg-gold' : 'bg-lavo-success'}`} />
            <span className="text-[12px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider">
              {isActive ? t('status_in_progress') : t('status_waiting')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-white/50 dark:bg-dark-bg/40 rounded-xl py-5">
              <div className="text-[44px] font-black text-gold leading-none">#{position}</div>
              <div className="text-[13px] text-[#555] dark:text-[#B0B0A0] mt-2 font-semibold">{t('your_position')}</div>
            </div>
            <div className="bg-white/50 dark:bg-dark-bg/40 rounded-xl py-5">
              <div className="text-[44px] font-black text-[#0A0A14] dark:text-white leading-none">{position}</div>
              <div className="text-[13px] text-[#555] dark:text-[#B0B0A0] mt-2 font-semibold">{t('wait_minutes')}</div>
            </div>
          </div>

          {position === 1 && (
            <div className="mt-4 px-4 py-3 bg-lavo-success/10 border border-lavo-success/30 rounded-xl text-center">
              <span className="text-[14px] font-bold text-lavo-success">{t('next_up')}</span>
            </div>
          )}
        </div>

        {/* Service summary */}
        <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-4 space-y-2">
          <h3 className="text-[14px] font-black text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-3">{t('summary')}</h3>
          <div className="flex justify-between text-[14px]">
            <span className="text-[#555] dark:text-[#B0B0A0]">{t('service')}</span>
            <span className="font-bold text-[#0A0A14] dark:text-white">{q.forfaitName}</span>
          </div>
          <div className="flex justify-between text-[14px] pt-2 border-t border-[#D0D0C0] dark:border-tab-inactive">
            <span className="font-bold text-[#0A0A14] dark:text-white">{t('total')}</span>
            <span className="text-[17px] font-black text-gold">{q.totalPrice.toFixed(2)}$</span>
          </div>
        </div>

        {/* Upgrade to reservation */}
        <button
          type="button"
          onClick={() => setShowUpgradeModal(true)}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-[15px] font-bold text-gold border-2 border-gold/40 hover:bg-gold/10 hover:border-gold/60 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
            <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          {t('upgrade_btn')}
        </button>

        {/* Google Maps CTA */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-gold hover:bg-gold-hover rounded-xl text-[15px] font-black text-dark-bg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {t('open_maps')}
        </a>
      </div>

      {/* Upgrade modal */}
      {showUpgradeModal && entry && (
        <UpgradeToReservationModal
          entryId={entry.id}
          stationId={entry.stationId}
          onClose={() => setShowUpgradeModal(false)}
          onSuccess={(reservationId) => {
            setShowUpgradeModal(false);
            router.push(`/client/reservations/${reservationId}`);
          }}
        />
      )}
    </main>
  );
}

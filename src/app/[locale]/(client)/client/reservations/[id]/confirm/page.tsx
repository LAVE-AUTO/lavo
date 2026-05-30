'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getFromApi } from '@/services/axios-service';
import { useAuth } from '@/context/auth-context';

interface ApiEntry {
  id: string;
  entry_type: 'reservation' | 'queue';
  station_id: string;
  vehicle_format_id: string | null;
  status: string;
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

interface ConfirmedEntry {
  id: string;
  shortCode: string;
  stationName: string;
  stationAddress: string;
  stationLatitude: number;
  stationLongitude: number;
  forfaitName: string;
  amountPaid: number;
  status: string;
}

type ConfirmState = 'loading' | 'pending' | 'success' | 'failed' | 'missing';

const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_MS = 30_000;

function resolveRedirectStatus(status: string | null): 'succeeded' | 'processing' | 'failed' | null {
  if (status === 'succeeded') return 'succeeded';
  if (status === 'processing' || status === 'requires_action') return 'processing';
  if (status === 'requires_payment_method' || status === 'failed' || status === 'canceled') return 'failed';
  return null;
}

export default function ClientReservationConfirmPage() {
  const t = useTranslations('coupons');
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const redirectStatus = resolveRedirectStatus(searchParams.get('redirect_status'));

  const { isLoading: authLoading } = useAuth();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [entry, setEntry] = useState<ConfirmedEntry | null>(null);
  const [screen, setScreen] = useState<ConfirmState>(
    redirectStatus === 'failed' ? 'failed' : 'loading',
  );

  const loadEntry = useCallback(async (): Promise<ApiEntry | null> => {
    const [ok, data] = await getFromApi('/me/entries?per_page=100');
    if (!mountedRef.current) return null;
    if (!ok) return null;
    const res = data as { data: { entries: ApiEntry[] } } | null;
    return (res?.data?.entries ?? []).find((e) => e.id === id) ?? null;
  }, [id]);

  const enrichWithStation = useCallback(async (apiEntry: ApiEntry): Promise<ConfirmedEntry | null> => {
    const [stationOk, stationData] = await getFromApi(`/stations/${apiEntry.station_id}`);
    if (!mountedRef.current) return null;
    const station = stationOk && stationData
      ? (stationData as { data: ApiStation }).data
      : null;
    const format = station?.vehicleFormats.find((f) => f.id === apiEntry.vehicle_format_id);
    return {
      id: apiEntry.id,
      shortCode: apiEntry.id.slice(0, 8).toUpperCase(),
      stationName: station?.name ?? `#${apiEntry.station_id.slice(0, 8)}`,
      stationAddress: station ? `${station.address}, ${station.city}` : '',
      stationLatitude: parseFloat(station?.latitude ?? '0'),
      stationLongitude: parseFloat(station?.longitude ?? '0'),
      forfaitName: format?.label ?? '-',
      amountPaid: parseFloat(apiEntry.amount_paid ?? '0'),
      status: apiEntry.status,
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (redirectStatus === 'failed') return;

    let cancelled = false;
    const startedAt = Date.now();

    const tick = async () => {
      const apiEntry = await loadEntry();
      if (!mountedRef.current || cancelled) return;

      if (!apiEntry) {
        if (redirectStatus === 'processing' && Date.now() - startedAt < POLL_MAX_MS) {
          setScreen('pending');
          setTimeout(tick, POLL_INTERVAL_MS);
          return;
        }
        setScreen('missing');
        return;
      }

      const enriched = await enrichWithStation(apiEntry);
      if (!mountedRef.current || cancelled) return;
      if (!enriched) { setScreen('missing'); return; }

      setEntry(enriched);

      const isPending = enriched.status === 'pending_payment' || enriched.status === 'pending';
      if (isPending && Date.now() - startedAt < POLL_MAX_MS) {
        setScreen('pending');
        setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }
      setScreen('success');
    };

    tick();
    return () => { cancelled = true; };
  }, [authLoading, redirectStatus, loadEntry, enrichWithStation]);

  if (screen === 'loading' || authLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center pb-24">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
      </main>
    );
  }

  if (screen === 'missing') {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4 pb-24 text-center">
        <p className="text-[14px] font-semibold text-foreground/70">
          {t('confirm_error_load')}
        </p>
        <Link
          href="/client/reservations"
          className="rounded-[10px] border-[1.5px] border-gold/50 px-4 py-2 text-[13px] font-semibold text-gold transition-colors hover:bg-gold/10"
        >
          {t('back_to_coupons')}
        </Link>
      </main>
    );
  }

  if (screen === 'failed') {
    return (
      <main className="min-h-screen bg-background px-4 pb-24 sm:pb-8">
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-Hurryline-error/15 text-Hurryline-error">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <h1 className="text-[22px] font-black text-foreground">
            {t('confirm_failed_title')}
          </h1>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-foreground/70">
            {t('confirm_failed_desc')}
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
            <Link
              href="/stations"
              className="flex items-center justify-center gap-2 rounded-xl bg-gold py-3.5 text-[15px] font-black text-dark-bg transition-colors hover:bg-gold-hover"
            >
              {t('confirm_cta_retry')}
            </Link>
            <Link
              href="/client/reservations"
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-gold/40 py-3.5 text-[14px] font-bold text-gold transition-colors hover:bg-gold/10 hover:border-gold/60"
            >
              {t('confirm_cta_my_reservations')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (screen === 'pending' || !entry) {
    return (
      <main className="min-h-screen bg-background px-4 pb-24 sm:pb-8">
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
          <div className="mb-6 h-12 w-12 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
          <h1 className="text-[22px] font-black text-foreground">
            {t('confirm_pending_title')}
          </h1>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-foreground/70">
            {t('confirm_pending_desc')}
          </p>
        </div>
      </main>
    );
  }

  const mapsUrl = entry.stationLatitude !== 0
    ? `https://www.google.com/maps/dir/?api=1&destination=${entry.stationLatitude},${entry.stationLongitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${entry.stationName}, ${entry.stationAddress}`)}`;

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-10 sm:pb-8">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-Hurryline-success/15 text-Hurryline-success">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-[22px] font-black text-foreground">
            {t('confirm_title')}
          </h1>
          <p className="mt-2 text-[14px] font-semibold text-foreground/70">
            {t('confirm_subtitle')}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 dark:border-border dark:bg-surface">
          <div className="text-[11px] font-bold uppercase tracking-wider text-foreground/70 dark:text-[#B0BFB1]">
            {t('confirm_reservation_code')}
          </div>
          <div className="mt-1 font-mono text-[20px] font-black text-gold">{entry.shortCode}</div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-surface p-4 dark:border-border dark:bg-surface">
          <Row label={t('confirm_station')} value={entry.stationName} secondary={entry.stationAddress} />
          <Row label={t('confirm_service')} value={entry.forfaitName} />
          <div className="flex items-center justify-between border-t border-border pt-3 dark:border-border">
            <span className="text-[13px] font-semibold text-foreground/70">
              {t('confirm_amount')}
            </span>
            <span className="text-[18px] font-black text-gold">{entry.amountPaid.toFixed(2)}$</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/client/reservations"
            className="flex items-center justify-center gap-2 rounded-xl bg-gold py-3.5 text-[15px] font-black text-dark-bg transition-colors hover:bg-gold-hover"
          >
            {t('confirm_cta_my_reservations')}
          </Link>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-gold/40 py-3.5 text-[14px] font-bold text-gold transition-colors hover:bg-gold/10 hover:border-gold/60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {t('confirm_cta_directions')}
          </a>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value, secondary }: { label: string; value: string; secondary?: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-foreground/70 dark:text-[#B0BFB1]">
        {label}
      </div>
      <div className="mt-0.5 text-[15px] font-bold text-foreground">{value}</div>
      {secondary && (
        <div className="text-[12px] text-foreground/65">{secondary}</div>
      )}
    </div>
  );
}

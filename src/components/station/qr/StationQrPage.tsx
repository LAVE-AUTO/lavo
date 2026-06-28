'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services';
import { QrDisplay } from './QrDisplay';
import { QrActions } from './QrActions';
import { StationPromoBanner } from '../promo/StationPromoBanner';

interface StationMe {
  data: {
    id: string;
    name: string;
    city?: string;
  };
}

interface StationQrTokenResponse {
  data: {
    station_id: string;
    qr_token: string;
    v: '1';
    qr_url: string;
  };
}

/**
 * Renders the station-facing QR download and print screen
 *
 * Loads both the authenticated station profile and the canonical QR payload,
 * validates that both responses stay consistent, and then displays a branded
 * card with preview, URL, and export actions. The component keeps its own
 * loading and error states so station users can retry transient failures.
 *
 * @returns {JSX.Element} Station QR management screen with loading, error, and ready states
 * @throws {None} Async failures are handled through local component state instead of thrown errors
 *
 * @example
 * <StationQrPage />
 *
 * @example
 * export default function Page() {
 *   return <StationQrPage />;
 * }
 *
 * @example
 * const page = <StationQrPage />;
 */
export function StationQrPage() {
  const t = useTranslations('station_qr');

  const [stationId, setStationId] = useState<string | null>(null);
  const [stationName, setStationName] = useState('');
  const [stationCity, setStationCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const [publicUrl, setPublicUrl] = useState('');

  /**
   * Loads the station profile and canonical QR payload in parallel
   *
   * The screen needs both the display metadata from `/station/me` and the QR
   * payload from `/station/qr-token`, so it fetches them together and verifies
   * that the returned station ids and token data stay coherent before updating UI state.
   *
   * @returns {Promise<void>} Promise that resolves once the state has been updated for success or failure
   * @throws {None} Network and payload-shape failures are converted into local error state
   *
   * @example
   * await loadStation();
   *
   * @example
   * void loadStation();
   *
   * @example
   * <button type="button" onClick={loadStation}>Retry</button>
   */
  const loadStation = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [[ok, data], [okToken, tokenData]] = await Promise.all([
        getFromApi('/station/me'),
        getFromApi('/station/qr-token'),
      ]);
      if (!mountedRef.current) return;
      if (ok && okToken) {
        const res = data as StationMe;
        const tokenRes = tokenData as StationQrTokenResponse;
        const token = tokenRes?.data?.qr_token;
        const version = tokenRes?.data?.v;
        const tokenStationId = tokenRes?.data?.station_id;
        const nextQrUrl = tokenRes?.data?.qr_url;
        const hasValidToken = typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);
        if (
          !res?.data?.id ||
          !res?.data?.name ||
          !hasValidToken ||
          version !== '1' ||
          tokenStationId !== res.data.id ||
          typeof nextQrUrl !== 'string' ||
          nextQrUrl.length === 0
        ) {
          setError(true);
          setLoading(false);
          return;
        }
        setStationId(res.data.id);
        setStationName(res.data.name);
        setStationCity(res.data.city ?? null);
        setPublicUrl(nextQrUrl);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadStation(); }, [loadStation]);

  /* Loading state */
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
      </div>
    );
  }

  /* Error state */
  if (error || !stationId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="text-[14px] font-semibold text-[#999] dark:text-[#B0BFB1]">
          {t('error_load')}
        </span>
        <button
          type="button"
          onClick={loadStation}
          className="rounded-[10px] border border-[#DDAF3B]/50 px-4 py-2 text-[13px] font-semibold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/10"
        >
          {t('btn_retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <StationPromoBanner />
      </div>

      {/* Print hint - bold, at the top of the page */}
      <p className="mb-6 max-w-md text-center text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]">
        {t('print_hint')}
      </p>

      {/* Branded card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-white via-white to-[#F7F3E4] p-8 shadow-2xl dark:from-[#1A2218] dark:via-[#161E12] dark:to-[#001201]">
        {/* Top gold accent line */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#DDAF3B] to-transparent" />
        {/* Diagonal subtle pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, #DDAF3B 0 1px, transparent 1px 14px)',
          }}
          aria-hidden="true"
        />

        {/* Brand wordmark */}
        <div className="relative flex items-center justify-center">
          <Image
            src="/logo/logo_anglais_1.png"
            alt="Hurryline"
            width={160}
            height={64}
            className="h-10 w-auto"
            priority
          />
        </div>

        {/* Station name */}
        <div className="relative mt-6 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#DDAF3B]">
            {t('station_name_label')}
          </div>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-[#001201] dark:text-[#FFF9EC]">
            {stationName}
          </h1>
          {stationCity && (
            <div className="mt-0.5 text-[12px] font-semibold text-foreground/55 dark:text-[#B0BFB1]">
              {stationCity}
            </div>
          )}
        </div>

        {/* QR with brackets */}
        <div className="relative mt-8 flex justify-center">
          <QrDisplay url={publicUrl} stationName={stationName} />
        </div>

        {/* Scan instruction */}
        <div className="relative mt-8 flex items-center justify-center gap-2">
          <ScanIcon />
          <span className="text-[13px] font-bold uppercase tracking-wider text-[#001201] dark:text-[#FFF9EC]">
            {t('scan_label')}
          </span>
        </div>

        {/* URL preview */}
        <div className="relative mt-3 rounded-xl border border-[#FFF9EC] bg-[#FFF9EC] px-3 py-2 dark:border-[#001A05] dark:bg-dark-bg">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#999] dark:text-[#5A5A4A]">
            {t('station_url_label')}
          </div>
          <p className="mt-0.5 break-all font-mono text-[11px] text-foreground/65 dark:text-[#B0BFB1]">
            {publicUrl}
          </p>
        </div>

        {/* Actions */}
        <div className="relative mt-5">
          <QrActions url={publicUrl} stationName={stationName} />
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the gold scan indicator icon used on the station QR card
 *
 * Keeps the scan label visually distinct from the rest of the card while
 * avoiding repeated inline SVG markup in the main component tree.
 *
 * @returns {JSX.Element} Decorative scan icon SVG
 * @throws {None} This component does not throw under normal runtime conditions
 *
 * @example
 * <ScanIcon />
 *
 * @example
 * <div className="flex items-center gap-2"><ScanIcon /></div>
 *
 * @example
 * const icon = <ScanIcon />;
 */
const ScanIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <line x1="7" y1="12" x2="17" y2="12" />
  </svg>
);

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getFromApi } from '@/services';
import { QrDisplay } from './QrDisplay';
import { QrActions } from './QrActions';

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
  };
}

export function StationQrPage() {
  const t = useTranslations('station_qr');
  const locale = useLocale();

  const [stationId, setStationId] = useState<string | null>(null);
  const [stationName, setStationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrVersion, setQrVersion] = useState<'1' | null>(null);

  const [origin, setOrigin] = useState('');
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const publicUrl = stationId && origin && qrToken && qrVersion
    ? `${origin}/${locale}/stations/${stationId}?qr_token=${encodeURIComponent(qrToken)}&v=${encodeURIComponent(qrVersion)}`
    : '';

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
        // Validate the response shape before using it
        const token = tokenRes?.data?.qr_token;
        const version = tokenRes?.data?.v;
        const tokenStationId = tokenRes?.data?.station_id;
        const hasValidToken = typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);
        if (
          !res?.data?.id ||
          !res?.data?.name ||
          !hasValidToken ||
          version !== '1' ||
          tokenStationId !== res.data.id
        ) {
          setError(true);
          setLoading(false);
          return;
        }
        setStationId(res.data.id);
        setStationName(res.data.name);
        setQrToken(token);
        setQrVersion(version);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadStation(); }, [loadStation]);

  /* Loading state */
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
      </div>
    );
  }

  /* Error state */
  if (error || !stationId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="text-[14px] font-semibold text-[#999] dark:text-[#9A9A8A]">
          {t('error_load')}
        </span>
        <button
          type="button"
          onClick={loadStation}
          className="rounded-[10px] border border-[#C49A1E]/50 px-4 py-2 text-[13px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/10"
        >
          {t('btn_retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      {/* Header */}
      <h1 className="text-center text-[20px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
        {t('page_title')}
      </h1>
      <p className="mt-1 max-w-md text-center text-[13px] text-[#888] dark:text-[#9A9A8A]">
        {t('page_subtitle')}
      </p>

      {/* QR card */}
      <div className="mt-8 w-full max-w-sm rounded-xl border border-[#E8E4DC] bg-white p-6 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        {/* Station name */}
        <div className="mb-5 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#BBBBAA] dark:text-[#4A4A3A]">
            {t('station_name_label')}
          </span>
          <p className="mt-0.5 text-[16px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
            {stationName}
          </p>
        </div>

        {/* QR code canvas */}
        <QrDisplay url={publicUrl} stationName={stationName} />

        {/* Public URL preview */}
        <div className="mt-4 rounded-lg bg-[#F7F6F2] px-3 py-2 dark:bg-[#0F1A0C]">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#BBBBAA] dark:text-[#4A4A3A]">
            {t('station_url_label')}
          </span>
          <p className="mt-0.5 break-all font-mono text-[12px] text-[#666] dark:text-[#A0A090]">
            {publicUrl}
          </p>
        </div>

        {/* Action buttons */}
        <QrActions url={publicUrl} stationName={stationName} />
      </div>

      {/* Print hint */}
      <p className="mt-6 max-w-sm text-center text-[12px] text-[#BBBBAA] dark:text-[#4A4A3A]">
        {t('print_hint')}
      </p>
    </div>
  );
}

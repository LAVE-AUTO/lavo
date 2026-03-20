'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getFromApi } from '@/services/axios-service';

interface ApiStation {
  id: string;
  name: string;
  city: string;
  address: string;
  wash_post_count: number | null;
  service_scope: string | null;
  created_at: string;
}

export function PendingStationsList() {
  const t      = useTranslations('admin_stations');
  const locale = useLocale();

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [stations, setStations]   = useState<ApiStation[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadStations = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const [ok, data] = await getFromApi('/admin/stations');
    if (!mountedRef.current) return;
    if (!ok) { setLoadError(true); setLoading(false); return; }
    const res = data as { data: ApiStation[] };
    setStations(res?.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadStations(); }, [loadStations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <span className="text-[14px] font-semibold text-[#555] dark:text-[#B0B0A0]">{t('error_load')}</span>
        <button
          type="button"
          onClick={loadStations}
          className="rounded-[10px] border border-[#C49A1E]/50 px-4 py-2 text-[13px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/10"
        >
          {t('btn_retry')}
        </button>
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8E8D8] dark:bg-[#1E2A1A]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div>
          <p className="text-[15px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('empty_title')}</p>
          <p className="mt-0.5 text-[13px] text-[#888] dark:text-[#6A6A5A]">{t('empty_desc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {stations.map((s) => {
        const submittedAt = new Date(s.created_at).toLocaleDateString(
          locale === 'en' ? 'en-CA' : 'fr-CA',
          { day: 'numeric', month: 'short', year: 'numeric' },
        );
        return (
          <div
            key={s.id}
            className="flex items-center gap-4 rounded-xl border border-[#E8E4DC] bg-white px-5 py-4 shadow-sm transition-colors hover:border-[#C49A1E]/40 dark:border-[#1A2A14] dark:bg-[#182214]"
          >
            {/* Status dot */}
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{s.name}</p>
              <p className="truncate text-[12px] text-[#888] dark:text-[#6A6A5A]">
                {s.city} — {s.address}
              </p>
            </div>

            {/* Date */}
            <span className="shrink-0 text-[12px] text-[#BBBBAA] dark:text-[#4A4A3A]">{submittedAt}</span>

            {/* Review link */}
            <Link
              href={`/admin/stations/${s.id}`}
              className="shrink-0 rounded-[8px] border border-[#C49A1E]/50 px-3 py-1.5 text-[12px] font-semibold text-[#C49A1E] transition-all hover:border-[#C49A1E] hover:bg-[#FDF8EC] dark:hover:bg-[#1A1A08]"
            >
              {t('btn_review')}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

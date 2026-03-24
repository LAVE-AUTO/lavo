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
  documents?: { id: string }[];
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
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
    setStations((data as { data: ApiStation[] }).data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadStations(); }, [loadStations]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-[#F5F5EE] dark:bg-[#0C1209]">

      {/* Page header */}
      <div className="border-b border-[#E8E4D8] bg-white px-7 py-5 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-black text-[#0F1A0C] dark:text-[#F0EDD4]">{t('page_title')}</h1>
          {!loading && !loadError && (
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#C49A1E] px-2 text-[11px] font-black text-white">
              {stations.length}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-[#999] dark:text-[#5A5A4A]">{t('page_subtitle')}</p>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 px-7 py-6">

        {/* Loading */}
        {loading && (
          <div className="flex flex-1 items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
          </div>
        )}

        {/* Error */}
        {!loading && loadError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
            <p className="text-[14px] font-semibold text-[#555] dark:text-[#B0B0A0]">{t('error_load')}</p>
            <button type="button" onClick={loadStations}
              className="rounded-xl border border-[#C49A1E]/50 px-4 py-2 text-[13px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/10">
              {t('btn_retry')}
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !loadError && stations.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('empty_title')}</p>
              <p className="mt-1 text-[12px] text-[#999] dark:text-[#5A5A4A]">{t('empty_desc')}</p>
            </div>
          </div>
        )}

        {/* Station cards */}
        {!loading && !loadError && stations.map((s) => {
          const date = new Date(s.created_at).toLocaleDateString(
            locale === 'en' ? 'en-CA' : 'fr-CA',
            { day: 'numeric', month: 'short', year: 'numeric' },
          );
          return (
            <div key={s.id}
              className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-[#1A2416] dark:ring-white/[0.06]"
            >
              {/* Avatar */}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C49A1E]/12 text-[13px] font-black text-[#C49A1E]">
                {initials(s.name)}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-black text-[#0F1A0C] dark:text-[#F0EDD4]">{s.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-[#999] dark:text-[#5A5A4A]">
                  {s.city}{s.address ? ` — ${s.address}` : ''}
                </p>
              </div>

              {/* Date chip */}
              <span className="shrink-0 rounded-full bg-[#F0EDE0] px-3 py-1 text-[10px] font-bold text-[#888] dark:bg-[#1E2A1A] dark:text-[#6A6A5A]">
                {date}
              </span>

              {/* KYC badge */}
              <span className="shrink-0 rounded-full bg-[#C49A1E]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#C49A1E]">
                KYC
              </span>

              {/* CTA */}
              <Link href={`/admin/stations/${s.id}` as Parameters<typeof Link>[0]['href']}
                className="shrink-0 rounded-xl bg-[#C49A1E] px-4 py-2 text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#B08A10] hover:shadow">
                {t('btn_review')} →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

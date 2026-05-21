'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services/axios-service';
import type { DisputeListItem, DisputeStatus } from './dispute-types';
import { AdminDisputesList } from './AdminDisputesList';

interface ApiListResponse {
  data: { items: DisputeListItem[]; meta: { total: number; page: number; per_page: number; total_pages: number } };
}

const PER_PAGE = 50;

export function AdminDisputesContainer() {
  const t = useTranslations('admin_disputes');
  const [query, setQuery]       = useState('');
  const [filter, setFilter]     = useState<DisputeStatus | 'all'>('all');
  const [disputes, setDisputes] = useState<DisputeListItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams({ page: '1', per_page: String(PER_PAGE) });
      if (filter !== 'all') params.set('status', filter);
      const [ok, data] = await getFromApi(`/admin/disputes?${params}`);
      if (!mountedRef.current) return;
      if (ok) {
        const items = ((data as ApiListResponse)?.data?.items ?? []) as DisputeListItem[];
        setDisputes(items);
      } else {
        setFetchError(true);
      }
    } catch {
      if (mountedRef.current) setFetchError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  const open  = disputes.filter((d) => d.status === 'open').length;
  const total = disputes.length;

  const metrics = [
    { label: t('chip_open'),     value: String(open),  accent: '#F97316' },
    { label: t('chip_total'),    value: String(total), accent: '#C49A1E' },
    { label: t('status_refunded'), value: String(disputes.filter((d) => d.status === 'refunded').length), accent: '#22C55E' },
    { label: t('status_rejected'), value: String(disputes.filter((d) => d.status === 'rejected' || d.status === 'resolved').length), accent: '#94A3B8' },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_36%),linear-gradient(180deg,#faf8f2_0%,#f2efe7_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_32%),linear-gradient(180deg,#0C1209_0%,#091009_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col gap-5 overflow-y-auto scrollbar-none px-3 py-4 sm:px-4 lg:px-6 lg:py-6">
        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.08)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#C49A1E]/18 bg-[#C49A1E]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#9A7A13] dark:border-[#C49A1E]/25 dark:bg-[#C49A1E]/12 dark:text-[#F0D98C]">
                {t('badge_disputes')}
              </span>
              <h1 className="mt-4 text-[clamp(28px,3vw,42px)] font-black leading-[1.04] text-[#1A1A0A] dark:text-[#F0EDD4]">
                {t('page_title')}
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#6F6B5F] dark:text-[#A6A091]">
                {t('page_subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:w-[640px] 2xl:w-[720px]">
              {metrics.map((metric) => (
                <div key={metric.label} className="group relative overflow-hidden rounded-[24px] border border-[#E9E4D8] bg-[#FBFAF7] px-5 py-4 shadow-[0_10px_30px_rgba(26,26,10,0.05)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-[#1E2E18] dark:bg-[#0C150B]">
                  <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: metric.accent }} />
                  <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-3xl opacity-15 transition-opacity duration-200 group-hover:opacity-25" style={{ background: metric.accent }} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]">{metric.label}</div>
                      <div className="mt-3 text-[30px] font-black leading-none text-[#1A1A0A] dark:text-[#F0EDD4]">{metric.value}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <label className="relative w-full max-w-[320px]">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#BBB6A7]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search_placeholder')}
                className="w-full rounded-[16px] border border-[#D8D4C8] bg-white/95 py-2.5 pl-9 pr-4 text-[13px] font-medium text-[#1A1A0A] outline-none transition-all focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] focus:ring-0 dark:border-[#243020] dark:bg-[#0D170B] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]"
              />
            </label>
          </div>
        </section>

        <section className="flex flex-1 min-h-0 flex-col gap-4 rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.07)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <p className="text-[13px] font-semibold text-[#999] dark:text-[#9A9A8A]">{t('fetch_error')}</p>
              <button type="button" onClick={loadDisputes} className="rounded-xl bg-[#C49A1E] px-4 py-2 text-[13px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14]">
                {t('btn_retry')}
              </button>
            </div>
          ) : (
            <AdminDisputesList disputes={disputes} query={query} filter={filter} onFilterChange={setFilter} />
          )}
        </section>
      </div>
    </div>
  );
}

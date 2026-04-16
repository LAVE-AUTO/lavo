'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services/axios-service';
import { HistoryCard } from './HistoryCard';
import { DateRangePicker } from './DateRangePicker';
import type { StationHistoryEntry, StationHistoryMeta, StatusFilter } from './types';

const PAGE_LIMIT = 10;

interface DateRange {
  from: Date | null;
  to: Date | null;
}

// Returns YYYY-MM-DD in local time to avoid UTC-offset shifts
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function safeFloat(value: string | null | undefined): number {
  const n = parseFloat(value ?? '');
  return isNaN(n) ? 0 : n;
}

export function StationHistoryPage() {
  const t = useTranslations('station_history');

  const [entries, setEntries] = useState<StationHistoryEntry[]>([]);
  const [meta, setMeta] = useState<StationHistoryMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [status, setStatus] = useState<StatusFilter>('all');

  // Track previous filter values to detect filter changes and reset page
  const prevFiltersRef = useRef({ dateRange, status });
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fetchHistory = useCallback(async (fetchPage: number) => {
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams();
    params.set('page', String(fetchPage));
    params.set('limit', String(PAGE_LIMIT));
    // Use local date string (YYYY-MM-DD) — backend expects this format, and toISOString() shifts UTC
    if (dateRange.from) params.set('from', toLocalDateStr(dateRange.from));
    if (dateRange.to) params.set('to', toLocalDateStr(dateRange.to));
    if (status !== 'all') params.set('status', status);

    const [ok, data] = await getFromApi<{ data: { items: StationHistoryEntry[]; meta: StationHistoryMeta } }>(
      `/history/station?${params.toString()}`,
    );

    if (!mountedRef.current) return;

    // API response is wrapped: { data: { items, meta } }
    if (ok && data && typeof data === 'object' && 'data' in data) {
      const inner = (data as { data: { items?: StationHistoryEntry[]; meta?: StationHistoryMeta } }).data;
      if (Array.isArray(inner?.items) && inner.items.length > 0) {
        setEntries(inner.items);
        setMeta(inner.meta ?? null);
        setLoading(false);
        return;
      }
      // API succeeded but returned empty — show empty state (not error)
      if (Array.isArray(inner?.items)) {
        setEntries([]);
        setMeta(inner.meta ?? null);
        setLoading(false);
        return;
      }
    }

    // API failed — show error screen instead of silently falling back to mock
    if (!ok) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    // API returned ok but unexpected shape — show empty state
    setEntries([]);
    setMeta(null);
    setLoading(false);
  }, [dateRange, status]);

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged = prev.dateRange !== dateRange || prev.status !== status;
    prevFiltersRef.current = { dateRange, status };

    if (filtersChanged && page !== 1) {
      // Reset page to 1; the subsequent render will trigger this effect again with page=1
      setPage(1);
      return;
    }
    fetchHistory(page);
  }, [fetchHistory, page, dateRange, status]);

  const stats = useMemo(() => {
    const completed = entries.filter((e) => e.status === 'completed');
    const revenue = completed.reduce((s, e) => s + safeFloat(e.amount_paid), 0);
    const payouts = completed.reduce((s, e) => s + safeFloat(e.station_payout), 0);
    const commission = completed.reduce((s, e) => s + safeFloat(e.commission_amount), 0);
    return { count: meta?.total ?? entries.length, revenue, payouts, commission };
  }, [entries, meta]);

  const STATUSES: { key: StatusFilter; label: string; color?: string }[] = [
    { key: 'all',       label: t('status_all') },
    { key: 'completed', label: t('status_completed'), color: '#00C851' },
    { key: 'cancelled', label: t('status_cancelled'), color: '#FF2525' },
  ];

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#EDEDED] dark:bg-[#1A2116]">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C09A18] border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="text-[14px] font-semibold text-[#000C1F]/50 dark:text-[#FFF8EC]/40">{t('error_load')}</span>
        <button
          type="button"
          onClick={() => fetchHistory(page)}
          className="rounded-[10px] border-[1.5px] border-[#C09A18]/50 px-4 py-2 text-[13px] font-semibold text-[#C09A18] transition-colors hover:bg-[#C09A18]/10"
        >
          {t('btn_retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#EDEDED] dark:bg-[#1A2116]">
      {/* Header */}
      <div className="border-b border-[#CCCCCC] bg-[#E0E0D0] px-6 pb-5 pt-5 dark:border-[#3A4A36] dark:bg-[#243020]">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">
              {t('page_title')}
            </h1>
            <p className="mt-0.5 text-[13px] text-[#000717]/50 dark:text-[#FFFFF0]/50">
              {t('page_subtitle')}
            </p>
          </div>
          {/* KPI chips — desktop */}
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <KpiChip value={String(stats.count)} color="#0044FF" label={t('stat_total_entries')} />
            <KpiChip value={`${stats.revenue.toFixed(0)}$`} color="#C09A18" label={t('stat_total_revenue')} />
            <KpiChip value={`${stats.payouts.toFixed(0)}$`} color="#00C851" label={t('stat_total_payout')} />
          </div>
        </div>

        {/* KPI cards — mobile only */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:hidden">
          <StatCard label={t('stat_total_entries')} value={String(stats.count)} />
          <StatCard label={t('stat_total_revenue')} value={`${stats.revenue.toFixed(2)}$`} gold />
          <StatCard label={t('stat_total_payout')} value={`${stats.payouts.toFixed(2)}$`} gold />
          <StatCard label={t('stat_total_commission')} value={`${stats.commission.toFixed(2)}$`} />
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
          {/* Period — calendar */}
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#000717]/40 dark:text-[#FFFFF0]/35">
              {t('filter_period')}
            </p>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          {/* Status */}
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#000717]/40 dark:text-[#FFFFF0]/35">
              {t('filter_status')}
            </p>
            <div className="flex gap-1.5">
              {STATUSES.map(({ key, label, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={`flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-bold transition-all active:scale-[0.97] ${
                    status === key
                      ? color ? 'text-white shadow-sm' : 'bg-[#C09A18] text-[#1A2116] shadow-sm'
                      : 'bg-[#C8C8B4] text-[#000717]/60 hover:bg-[#BDBDA8] dark:bg-[#1E2A1A] dark:text-[#FFFFF0]/60 dark:hover:bg-[#2A3626]'
                  }`}
                  style={status === key && color ? { background: color } : undefined}
                >
                  {color && (
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${status === key ? 'bg-white' : ''}`}
                      style={status !== key ? { background: color } : undefined}
                    />
                  )}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {entries.length === 0 ? (
          <EmptyState t={t} />
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
              {entries.map((entry) => (
                <HistoryCard key={entry.id} entry={entry} />
              ))}
            </div>

            {/* Pagination */}
            {meta && meta.total_pages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex h-9 items-center gap-1.5 rounded-[10px] bg-[#C8C8B4] px-4 text-[13px] font-bold text-[#000C1F] transition-all hover:bg-[#BDBDA8] active:scale-[0.98] disabled:opacity-30 dark:bg-[#1E2A1A] dark:text-[#FFF8EC] dark:hover:bg-[#2A3626]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  {t('pagination_prev')}
                </button>

                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: meta.total_pages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-bold transition-all active:scale-[0.95] ${
                        p === page
                          ? 'bg-[#C09A18] text-[#1A2116] shadow-sm'
                          : 'text-[#000717]/50 hover:bg-[#C8C8B4] dark:text-[#FFFFF0]/50 dark:hover:bg-[#1E2A1A]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={page >= meta.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-9 items-center gap-1.5 rounded-[10px] bg-[#C8C8B4] px-4 text-[13px] font-bold text-[#000C1F] transition-all hover:bg-[#BDBDA8] active:scale-[0.98] disabled:opacity-30 dark:bg-[#1E2A1A] dark:text-[#FFF8EC] dark:hover:bg-[#2A3626]"
                >
                  {t('pagination_next')}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KpiChip({ value, color, label }: { value: string; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-[8px] bg-[#C8C8B4] px-3 py-1.5 dark:bg-[#1E2A1A]">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="font-mono text-[14px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{value}</span>
      <span className="text-[11px] font-semibold text-[#000717]/50 dark:text-[#FFFFF0]/50">{label}</span>
    </div>
  );
}

function StatCard({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-2xl bg-[#C8C8B4] p-3 dark:bg-[#1E2A1A]">
      <div className={`text-[18px] font-bold leading-tight ${gold ? 'text-[#C09A18]' : 'text-[#000C1F] dark:text-[#FFF8EC]'}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-[#000717]/40 dark:text-[#FFFFF0]/35">
        {label}
      </div>
    </div>
  );
}

function EmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#C8C8B4] dark:bg-[#243020]">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-[#000717]/25 dark:text-[#FFFFF0]/25">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <div>
        <p className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('empty_title')}</p>
        <p className="mt-1 max-w-xs text-[13px] text-[#000717]/50 dark:text-[#FFFFF0]/40">{t('empty_desc')}</p>
      </div>
    </div>
  );
}

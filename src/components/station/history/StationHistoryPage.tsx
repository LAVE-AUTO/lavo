'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getFromApi } from '@/services/axios-service';
import { HistoryCard } from './HistoryCard';
import { MOCK_HISTORY } from './mock-data';
import type { StationHistoryEntry, StationHistoryMeta, PeriodKey, StatusFilter } from './types';

const PAGE_LIMIT = 10;

function getPeriodRange(period: PeriodKey): { from?: string; to?: string } {
  if (period === 'all') return {};
  const now = new Date();
  const from = new Date();
  if (period === 'week')    from.setDate(now.getDate() - 7);
  if (period === 'month')   from.setMonth(now.getMonth() - 1);
  if (period === '3months') from.setMonth(now.getMonth() - 3);
  if (period === 'year')    from.setFullYear(now.getFullYear() - 1);
  return { from: from.toISOString(), to: now.toISOString() };
}

export function StationHistoryPage() {
  const t = useTranslations('station_history');
  const locale = useLocale();

  const [entries, setEntries] = useState<StationHistoryEntry[]>([]);
  const [meta, setMeta] = useState<StationHistoryMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const range = getPeriodRange(period);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_LIMIT));
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    if (status !== 'all') params.set('status', status);

    const [ok, data] = await getFromApi<{ items: StationHistoryEntry[]; meta: StationHistoryMeta }>(
      `/history/station?${params.toString()}`,
    );

    if (ok && data && typeof data === 'object' && 'items' in data) {
      const resp = data as { items: StationHistoryEntry[]; meta: StationHistoryMeta };
      if (Array.isArray(resp.items) && resp.items.length > 0) {
        setEntries(resp.items);
        setMeta(resp.meta ?? null);
        setLoading(false);
        return;
      }
    }

    // TODO: connect to API once endpoint returns real data — remove mock fallback
    const start = getPeriodRange(period);
    const filtered = MOCK_HISTORY
      .filter((e) => status === 'all' || e.status === status)
      .filter((e) => !start.from || new Date(e.date) >= new Date(start.from))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = filtered.length;
    const sliced = filtered.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);
    setEntries(sliced);
    setMeta({ total, page, limit: PAGE_LIMIT, total_pages: Math.ceil(total / PAGE_LIMIT) });
    setLoading(false);
  }, [page, period, status]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [period, status]);

  // Stats from current filtered results
  const stats = useMemo(() => {
    const completed = entries.filter((e) => e.status === 'completed');
    const revenue = completed.reduce((s, e) => s + parseFloat(e.amount_paid), 0);
    const payouts = completed.reduce((s, e) => s + parseFloat(e.station_payout ?? '0'), 0);
    const commission = completed.reduce((s, e) => s + parseFloat(e.commission_amount ?? '0'), 0);
    return { count: meta?.total ?? entries.length, revenue, payouts, commission };
  }, [entries, meta]);

  const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: 'all',     label: t('period_all') },
    { key: 'week',    label: t('period_week') },
    { key: 'month',   label: t('period_month') },
    { key: '3months', label: t('period_3months') },
    { key: 'year',    label: t('period_year') },
  ];

  const STATUSES: { key: StatusFilter; label: string }[] = [
    { key: 'all',       label: t('status_all') },
    { key: 'completed', label: t('status_completed') },
    { key: 'cancelled', label: t('status_cancelled') },
  ];

  return (
    <div className="min-h-screen bg-[#EDEDED] dark:bg-[#1A2116]">
      {/* Header */}
      <div className="bg-[#E0E0D0] dark:bg-[#243020] px-4 pb-4 pt-6 sm:px-6">
        <h1 className="text-[20px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">
          {t('page_title')}
        </h1>

        {/* Stats */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatChip label={t('stat_total_entries')} value={String(stats.count)} />
          <StatChip label={t('stat_total_revenue')} value={`${stats.revenue.toFixed(2)}$`} gold />
          <StatChip label={t('stat_total_payout')} value={`${stats.payouts.toFixed(2)}$`} gold />
          <StatChip label={t('stat_total_commission')} value={`${stats.commission.toFixed(2)}$`} />
        </div>

        {/* Period filter */}
        <div className="mt-4">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#000717]/50 dark:text-[#FFFFF0]/40">
            {t('filter_period')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`rounded-full px-3 py-1 text-[12px] font-bold transition-colors ${
                  period === key
                    ? 'bg-[#C09A18] text-[#1A2116]'
                    : 'bg-white/50 text-[#000717]/60 hover:bg-white/70 dark:bg-[#1E2A1A] dark:text-[#FFFFF0]/60 dark:hover:bg-[#2A3626]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#000717]/50 dark:text-[#FFFFF0]/40">
            {t('filter_status')}
          </p>
          <div className="flex gap-1.5">
            {STATUSES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                className={`rounded-full px-3 py-1 text-[12px] font-bold transition-colors ${
                  status === key
                    ? key === 'completed' ? 'bg-[#00C851] text-white'
                    : key === 'cancelled' ? 'bg-[#FF2525] text-white'
                    : 'bg-[#C09A18] text-[#1A2116]'
                    : 'bg-white/50 text-[#000717]/60 hover:bg-white/70 dark:bg-[#1E2A1A] dark:text-[#FFFFF0]/60 dark:hover:bg-[#2A3626]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4 sm:px-6">
        {loading ? (
          <LoadingSkeleton />
        ) : entries.length === 0 ? (
          <EmptyState message={t('empty_title')} />
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
              {entries.map((entry) => (
                <HistoryCard key={entry.id} entry={entry} />
              ))}
            </div>

            {/* Pagination */}
            {meta && meta.total_pages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg bg-[#C8C8B4] px-3 py-1.5 text-[12px] font-bold text-[#000C1F] transition-colors hover:bg-[#B8B8A4] disabled:opacity-40 dark:bg-[#1E2A1A] dark:text-[#FFF8EC] dark:hover:bg-[#2A3626]"
                >
                  {t('pagination_prev')}
                </button>
                <span className="text-[12px] font-semibold text-[#000717]/60 dark:text-[#FFFFF0]/50">
                  {t('pagination_page', { page, total: meta.total_pages })}
                </span>
                <button
                  type="button"
                  disabled={page >= meta.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg bg-[#C8C8B4] px-3 py-1.5 text-[12px] font-bold text-[#000C1F] transition-colors hover:bg-[#B8B8A4] disabled:opacity-40 dark:bg-[#1E2A1A] dark:text-[#FFF8EC] dark:hover:bg-[#2A3626]"
                >
                  {t('pagination_next')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-xl bg-white/60 px-3 py-2 text-center dark:bg-[#1E2A1A]">
      <div className={`text-[16px] font-bold leading-none ${gold ? 'text-[#C09A18]' : 'text-[#000C1F] dark:text-[#FFF8EC]'}`}>
        {value}
      </div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#000717]/50 dark:text-[#FFFFF0]/40">
        {label}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-[#C8C8B4]/60 dark:bg-[#1E2A1A]/60" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C8C8B4] dark:bg-[#243020]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#000717]/30 dark:text-[#FFFFF0]/30">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <p className="mt-3 text-[13px] font-semibold text-[#000717]/50 dark:text-[#FFFFF0]/40">{message}</p>
    </div>
  );
}

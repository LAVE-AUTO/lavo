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

  useEffect(() => { setPage(1); }, [period, status]);

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

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#EDEDED] dark:bg-[#1A2116]">
      {/* Header */}
      <div className="border-b border-[#CCCCCC] bg-[#E0E0D0] px-6 pb-5 pt-5 dark:border-[#3A4A36] dark:bg-[#243020]">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">
              {t('page_title')}
            </h1>
            <p className="mt-0.5 text-[12px] text-[#000717]/50 dark:text-[#FFFFF0]/50">
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
          {/* Period */}
          <div className="flex-1">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#000717]/40 dark:text-[#FFFFF0]/35">
              {t('filter_period')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriod(key)}
                  className={`rounded-[8px] px-3 py-1.5 text-[12px] font-bold transition-all active:scale-[0.97] ${
                    period === key
                      ? 'bg-[#C09A18] text-[#1A2116] shadow-sm'
                      : 'bg-[#C8C8B4] text-[#000717]/60 hover:bg-[#BDBDA8] dark:bg-[#1E2A1A] dark:text-[#FFFFF0]/60 dark:hover:bg-[#2A3626]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#000717]/40 dark:text-[#FFFFF0]/35">
              {t('filter_status')}
            </p>
            <div className="flex gap-1.5">
              {STATUSES.map(({ key, label, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={`flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-bold transition-all active:scale-[0.97] ${
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
                  className="flex h-9 items-center gap-1.5 rounded-[10px] bg-[#C8C8B4] px-4 text-[12px] font-bold text-[#000C1F] transition-all hover:bg-[#BDBDA8] active:scale-[0.98] disabled:opacity-30 dark:bg-[#1E2A1A] dark:text-[#FFF8EC] dark:hover:bg-[#2A3626]"
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
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition-all active:scale-[0.95] ${
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
                  className="flex h-9 items-center gap-1.5 rounded-[10px] bg-[#C8C8B4] px-4 text-[12px] font-bold text-[#000C1F] transition-all hover:bg-[#BDBDA8] active:scale-[0.98] disabled:opacity-30 dark:bg-[#1E2A1A] dark:text-[#FFF8EC] dark:hover:bg-[#2A3626]"
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
      <span className="text-[10px] font-semibold text-[#000717]/50 dark:text-[#FFFFF0]/50">{label}</span>
    </div>
  );
}

function StatCard({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-2xl bg-[#C8C8B4] p-3 dark:bg-[#1E2A1A]">
      <div className={`text-[18px] font-bold leading-tight ${gold ? 'text-[#C09A18]' : 'text-[#000C1F] dark:text-[#FFF8EC]'}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#000717]/40 dark:text-[#FFFFF0]/35">
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

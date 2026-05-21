'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi } from '@/services/axios-service';
import { AdminTransactionDrawer, type TxRow, type TxStatus } from './AdminTransactionDrawer';
import { AdminPagination } from '../ui/AdminPagination';

interface ApiTransactionLog {
  type: string;
  id: string;
  station_id: string;
  station_name: string | null;
  amount: string;
  commission_amount: string | null;
  status: string;
  created_at: string;
}

interface ApiMeta { total: number; total_pages: number; page: number; per_page?: number }

function mapStatus(s: string): TxStatus {
  if (s === 'completed' || s === 'succeeded') return 'succeeded';
  if (s === 'refunded') return 'refunded';
  return 'failed';
}

const STATUS_META: Record<TxStatus, { dot: string; text: string; bar: string; label: string }> = {
  succeeded: { dot: 'bg-[#22C55E]', text: 'text-[#166534] dark:text-[#86EFAC]', bar: 'bg-[#22C55E]', label: 'status_succeeded' },
  refunded:  { dot: 'bg-[#3B82F6]', text: 'text-[#1D4ED8] dark:text-[#93C5FD]', bar: 'bg-[#3B82F6]', label: 'status_refunded' },
  failed:    { dot: 'bg-[#F43F5E]', text: 'text-[#9F1239] dark:text-[#FDA4AF]', bar: 'bg-[#F43F5E]', label: 'status_failed' },
};

function fmt(n: number) { return n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' }); }
function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }); }
  catch { return d; }
}
function formatTime(d: string) {
  try { return new Date(d).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}
function shortId(s: string) { return '…' + s.slice(-8).toUpperCase(); }

const PER_PAGE = 25;

export function AdminTransactionsView() {
  const t = useTranslations('admin_transactions');
  const { error: toastError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [meta, setMeta]         = useState<ApiMeta | null>(null);
  const [page, setPage]         = useState(1);
  const [filter, setFilter]     = useState<TxStatus | 'all'>('all');
  const [query, setQuery]       = useState('');
  const [copied, setCopied]     = useState<string | null>(null);
  const [selected, setSelected] = useState<TxRow | null>(null);

  // Default: last 30 days
  const today    = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo]     = useState(today);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    setFetchError(false);
    const params = new URLSearchParams({ page: String(p), per_page: String(PER_PAGE) });
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to',   dateTo + 'T23:59:59');
    try {
      const [ok, data] = await getFromApi(`/admin/transactions/logs?${params.toString()}`);
      if (!mountedRef.current) return;
      if (!ok) { setFetchError(true); setLoading(false); return; }
      const result = (data as { data: { logs: ApiTransactionLog[]; meta: ApiMeta } }).data;
      const logs = result?.logs ?? [];
      const mapped = logs.map((l): TxRow => {
        const amount = parseFloat(l.amount) || 0;
        const commission = parseFloat(l.commission_amount ?? '0') || 0;
        return {
          id: l.id, stripe_id: l.id,
          station: l.station_name ?? t('unknown_station'),
          client: l.type,
          gross: amount, commission, payout: amount - commission,
          status: mapStatus(l.status), date: l.created_at,
        };
      });
      setTransactions(mapped);
      setMeta(result?.meta ?? null);
      setPage(p);
    } catch {
      if (mountedRef.current) setFetchError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [dateFrom, dateTo, t]);

  /* Reset to page 1 when date range changes */
  useEffect(() => {
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const q        = query.toLowerCase();
  const filtered = transactions
    .filter((tx) => filter === 'all' || tx.status === filter)
    .filter((tx) => !q || tx.station.toLowerCase().includes(q) || tx.client.toLowerCase().includes(q));

  const succeeded  = transactions.filter((tx) => tx.status === 'succeeded');
  const volume     = succeeded.reduce((s, tx) => s + tx.gross, 0);
  const commTotal  = succeeded.reduce((s, tx) => s + tx.commission, 0);
  const counts: Record<string, number> = { all: transactions.length };
  for (const tx of transactions) counts[tx.status] = (counts[tx.status] ?? 0) + 1;

  function copyId(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    }).catch(() => {
      toastError(t('copy_error'));
    });
  }

  const handleClose = useCallback(() => setSelected(null), []);

  const FILTERS: Array<{ key: TxStatus | 'all'; label: string; dot?: string }> = [
    { key: 'all',       label: t('filter_all') },
    { key: 'succeeded', label: t('status_succeeded'), dot: '#22C55E' },
    { key: 'refunded',  label: t('status_refunded'),  dot: '#3B82F6' },
    { key: 'failed',    label: t('status_failed'),    dot: '#F43F5E' },
  ];

  const dateInputCls = 'rounded-[12px] border border-[#D8D4C8] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#1A1A0A] outline-none transition-all focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]';

  const metrics = [
    { label: t('chip_volume'),      value: loading ? '…' : fmt(volume),    accent: '#C49A1E' },
    { label: t('chip_commissions'), value: loading ? '…' : fmt(commTotal), accent: '#22C55E' },
    { label: t('chip_count'),       value: loading ? '…' : String(meta?.total ?? 0), accent: '#3B82F6' },
    { label: t('metric_avg_tx'),    value: loading || succeeded.length === 0 ? '…' : fmt(volume / succeeded.length), accent: '#94A3B8' },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_36%),linear-gradient(180deg,#faf8f2_0%,#f2efe7_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_32%),linear-gradient(180deg,#0C1209_0%,#091009_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col gap-5 overflow-y-auto scrollbar-none px-3 py-4 sm:px-4 lg:px-6 lg:py-6">

        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.08)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#C49A1E]/18 bg-[#C49A1E]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#9A7A13] dark:border-[#C49A1E]/25 dark:bg-[#C49A1E]/12 dark:text-[#F0D98C]">
                Stripe
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
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]">{metric.label}</div>
                    <div className="mt-3 text-[24px] font-black leading-tight text-[#1A1A0A] dark:text-[#F0EDD4]">{metric.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters bar */}
          <div className="mt-5 rounded-[24px] border border-[#E7E1D5] bg-[#F8F6F1]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur dark:border-[#1E2E18] dark:bg-[#0C150B]/85">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]">{t('filter_from')}</span>
                <input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} className={dateInputCls} />
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]">{t('filter_to')}</span>
                <input type="date" value={dateTo} min={dateFrom} max={today} onChange={(e) => setDateTo(e.target.value)} className={dateInputCls} />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex flex-wrap gap-2 rounded-[18px] bg-white/65 p-1.5 dark:bg-[#111A0E]/80">
                  {FILTERS.map(({ key, label, dot }) => (
                    <button key={key} type="button" onClick={() => setFilter(key)}
                      className={[
                        'relative flex items-center gap-2 rounded-[14px] px-3.5 py-2 text-[12.5px] font-bold transition-colors duration-150',
                        filter === key ? 'bg-[#1A1A0A] text-[#F0EDD4] shadow-[0_10px_20px_rgba(26,26,10,0.18)] dark:bg-[#F0EDD4] dark:text-[#1A1A0A]' : 'text-[#847E70] hover:bg-[#EFE8D7] hover:text-[#1A1A0A] dark:text-[#A0A090] dark:hover:bg-[#182214] dark:hover:text-[#F0EDD4]',
                      ].join(' ')}>
                      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: filter === key ? dot : '#CCCCCC' }} />}
                      {label}
                      <span className={[
                        'min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-black',
                        filter === key ? 'bg-[#C49A1E] text-[#0C1209]' : 'bg-[#E1DBCF] text-[#7E796B] dark:bg-[#1E2E18] dark:text-[#9A9A8A]',
                      ].join(' ')}>{counts[key] ?? 0}</span>
                    </button>
                  ))}
                </div>

                <label className="relative w-full max-w-[280px]">
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
            </div>
          </div>
        </section>

        {/* List */}
        <section className="flex flex-col gap-4 rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.07)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <p className="text-[13px] font-semibold text-[#999] dark:text-[#9A9A8A]">{t('fetch_error')}</p>
              <button type="button" onClick={() => fetchPage(page)} className="rounded-xl bg-[#C49A1E] px-4 py-2 text-[13px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14]">
                {t('btn_retry')}
              </button>
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4DC] dark:bg-[#131E10] dark:ring-[#1E2E18]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <p className="text-[13px] font-semibold text-[#999]">{q ? t('empty_search') : t('empty_transactions')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((tx) => {
                const s = STATUS_META[tx.status];
                return (
                  <div key={tx.id} role="button" tabIndex={0} onClick={() => setSelected(tx)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(tx); } }}
                    className="group flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-[18px] border border-[#E8E4DC] bg-white text-left shadow-[0_4px_12px_rgba(26,26,10,0.04)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(26,26,10,0.08)] dark:border-[#1E2E18] dark:bg-[#131E10]">

                    {/* Status accent bar */}
                    <div className={`h-full w-1 self-stretch shrink-0 ${s.bar}`} />

                    {/* Reference + parties */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1 py-3.5 pr-0">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={(e) => copyId(e, tx.stripe_id)}
                          className="flex items-center gap-1.5 rounded-[10px] border border-[#E8E4DC] bg-[#F5F2EC] px-2 py-0.5 transition-colors hover:border-[#C49A1E]/40 hover:bg-[#FFF8E8] dark:border-[#1E2E18] dark:bg-[#0E1A0C] dark:hover:border-[#C49A1E]/30">
                          <span className="font-mono text-[11px] font-bold text-[#5A554B] dark:text-[#9A9A8A]">{shortId(tx.stripe_id)}</span>
                          {copied === tx.stripe_id
                            ? <span className="text-[10.5px] font-bold text-[#22C55E]">{t('copied')}</span>
                            : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#BBBBAA]" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                          }
                        </button>
                        <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#F4F1E8] px-2.5 py-0.5 text-[11px] font-bold dark:bg-[#171F12] ${s.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
                        </span>
                      </div>
                      <p className="truncate text-[13px] text-[#5A554B] dark:text-[#9A9A8A]">
                        <span className="font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{tx.station}</span>
                        <span className="mx-1.5 text-[#CCCCCC] dark:text-[#3A4A33]">·</span>
                        <span className="text-[#9B9588] dark:text-[#7E8A75]">{tx.client}</span>
                      </p>
                    </div>

                    {/* Amounts */}
                    <div className="flex shrink-0 flex-col items-end gap-1 py-3.5">
                      <span className="text-[17px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{fmt(tx.gross)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] font-bold text-[#9A7A13] dark:text-[#F0D98C]">{fmt(tx.commission)}</span>
                        <span className="text-[11px] text-[#CCCCCC] dark:text-[#3A4A33]">·</span>
                        <span className="text-[11.5px] font-semibold text-[#9B9588] dark:text-[#7E8A75]">{fmt(tx.payout)}</span>
                      </div>
                    </div>

                    {/* Date + arrow */}
                    <div className="flex shrink-0 flex-col items-end gap-0.5 py-3.5 pr-4 pl-2">
                      <span className="text-[12.5px] font-bold text-[#5A554B] dark:text-[#A0A090]">{formatDate(tx.date)}</span>
                      <span className="text-[11px] text-[#A8A293] dark:text-[#7E8A75]">{formatTime(tx.date)}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 text-[#CCCCCC] transition-colors group-hover:text-[#C49A1E] dark:text-[#A0A090]" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {meta && (
            <AdminPagination
              page={page}
              totalPages={meta.total_pages}
              total={meta.total}
              perPage={PER_PAGE}
              onPageChange={fetchPage}
              loading={loading}
            />
          )}
        </section>
      </div>

      <AdminTransactionDrawer tx={selected} onClose={handleClose} />
    </div>
  );
}

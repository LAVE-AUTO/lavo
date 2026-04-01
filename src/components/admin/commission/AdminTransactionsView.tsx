'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi } from '@/services/axios-service';
import { AdminTransactionDrawer, type TxRow, type TxStatus } from './AdminTransactionDrawer';

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

function mapStatus(s: string): TxStatus {
  if (s === 'completed' || s === 'succeeded') return 'succeeded';
  if (s === 'refunded') return 'refunded';
  return 'failed';
}

const STATUS_META: Record<TxStatus, { badge: string; dot: string; bar: string; icon: string }> = {
  succeeded: { badge: 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20', dot: 'bg-[#22C55E]', bar: 'bg-[#22C55E]',  icon: '#22C55E' },
  refunded:  { badge: 'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#3B82F6]/20', dot: 'bg-[#3B82F6]', bar: 'bg-[#3B82F6]',  icon: '#3B82F6' },
  failed:    { badge: 'bg-[#FFF1F2] text-[#BE123C] ring-1 ring-[#FB7185]/20', dot: 'bg-[#F43F5E]', bar: 'bg-[#F43F5E]',  icon: '#F43F5E' },
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

export function AdminTransactionsView() {
  const t = useTranslations('admin_transactions');
  const { error: toastError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]     = useState<TxStatus | 'all'>('all');
  const [query, setQuery]       = useState('');
  const [copied, setCopied]     = useState<string | null>(null);
  const [selected, setSelected] = useState<TxRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [ok, data] = await getFromApi('/admin/transactions/logs?per_page=100');
        if (!mountedRef.current) return;
        if (ok) {
          const logs = (data as { data: { logs: ApiTransactionLog[] } }).data?.logs ?? [];
          setTransactions(logs.map((l): TxRow => {
            const amount = parseFloat(l.amount) || 0;
            const commission = parseFloat(l.commission_amount ?? '0') || 0;
            return {
              id: l.id,
              stripe_id: l.id,
              station: l.station_name ?? l.station_id.slice(0, 8),
              client: l.type,
              gross: amount,
              commission,
              payout: amount - commission,
              status: mapStatus(l.status),
              date: l.created_at,
            };
          }));
        }
      } catch {
        // keep empty
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, []);

  const STATUS_LABELS: Record<TxStatus, string> = {
    succeeded: t('status_succeeded'),
    refunded:  t('status_refunded'),
    failed:    t('status_failed'),
  };

  const q        = query.toLowerCase();
  const filtered = transactions
    .filter((tx) => filter === 'all' || tx.status === filter)
    .filter((tx) => !q || tx.stripe_id.toLowerCase().includes(q) || tx.station.toLowerCase().includes(q) || tx.client.toLowerCase().includes(q));

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

  return (
    <div className="flex min-h-full flex-col">

      {/* Header */}
      <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 pb-0 pt-6 dark:border-[#1A2A14] dark:bg-[#0C1209]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
            <p className="mt-1 text-[12px] text-[#888] dark:text-[#6A6A5A]">{t('page_subtitle')}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1">
            <span className="rounded-full border border-[#C49A1E]/30 bg-[#C49A1E]/10 px-3 py-1 text-[11px] font-black text-[#7A5E0A] dark:border-[#C49A1E]/20 dark:text-[#C49A1E]">
              {fmt(volume)} {t('chip_volume')}
            </span>
            <span className="rounded-full border border-[#22C55E]/20 bg-[#F0FDF4] px-3 py-1 text-[11px] font-black text-[#15803D] dark:border-[#22C55E]/15 dark:bg-[#0A2010] dark:text-[#4ADE80]">
              {fmt(commTotal)} {t('chip_commissions')}
            </span>
            <span className="rounded-full border border-[#D8D4C8] bg-white px-3 py-1 text-[11px] font-bold text-[#888] dark:border-[#243020] dark:bg-[#131E10] dark:text-[#5A5A4A]">
              {transactions.length} {t('chip_count')}
            </span>
          </div>
        </div>

        {/* Filters + search */}
        <div className="mt-5 flex items-end justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, label, dot }) => (
              <button key={key} type="button" onClick={() => setFilter(key)}
                className={['flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all', filter === key ? 'bg-white text-[#1A1A0A] shadow-sm ring-1 ring-[#E0DCD0] dark:bg-[#1E2E18] dark:text-[#F0EDD4] dark:ring-[#2A3820]' : 'text-[#999] hover:text-[#555] dark:text-[#5A5A4A] dark:hover:text-[#9A9A8A]'].join(' ')}>
                {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: filter === key ? dot : '#CCCCCC' }} />}
                {label}
                <span className={['min-w-[16px] rounded-full px-1 py-0.5 text-center text-[10px] font-black', filter === key ? 'bg-[#C49A1E] text-[#0C1209]' : 'bg-[#E8E4DC] text-[#AAAAAA] dark:bg-[#1E2E18] dark:text-[#4A4A3A]'].join(' ')}>{counts[key] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="relative mb-2.5">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#BBBBAA]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search_placeholder')}
              className="w-[220px] rounded-[8px] border border-[#D8D4C8] bg-white py-1.5 pl-8 pr-3 text-[12px] text-[#1A1A0A] outline-none transition-all focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]" />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-[#F5F5EE] p-6 dark:bg-[#0C1209]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4DC] dark:bg-[#131E10] dark:ring-[#1E2E18]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <p className="text-[13px] font-semibold text-[#999]">{q ? t('empty_search') : t('empty_transactions')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((tx) => {
              const s = STATUS_META[tx.status];
              return (
                <div key={tx.id} role="button" tabIndex={0} onClick={() => setSelected(tx)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(tx); } }}
                  className="group flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-[#1E2E18] dark:bg-[#131E10]">

                  {/* Left status accent bar */}
                  <div className={`h-full w-1 self-stretch shrink-0 ${s.bar}`} />

                  {/* Reference + parties */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1 py-4 pr-0">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={(e) => copyId(e, tx.stripe_id)}
                        className="flex items-center gap-1.5 rounded-lg border border-[#E8E4DC] bg-[#F5F2EC] px-2 py-0.5 transition-colors hover:border-[#C49A1E]/40 hover:bg-[#FFF8E8] dark:border-[#1E2E18] dark:bg-[#0E1A0C] dark:hover:border-[#C49A1E]/30">
                        <span className="font-mono text-[11px] font-bold text-[#555] dark:text-[#9A9A8A]">{shortId(tx.stripe_id)}</span>
                        {copied === tx.stripe_id
                          ? <span className="text-[10px] font-bold text-[#22C55E]">{t('copied')}</span>
                          : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#BBBBAA]"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                        }
                      </button>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{STATUS_LABELS[tx.status]}
                      </span>
                    </div>
                    <p className="truncate text-[12px] text-[#666] dark:text-[#9A9A8A]">
                      <span className="font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{tx.station}</span>
                      <span className="mx-1.5 text-[#CCCCCC] dark:text-[#3A3A2A]">·</span>
                      {tx.client}
                    </p>
                  </div>

                  {/* Amounts */}
                  <div className="flex shrink-0 flex-col items-end gap-1 py-4">
                    <span className="text-[17px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{fmt(tx.gross)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#C49A1E]">{fmt(tx.commission)}</span>
                      <span className="text-[10px] text-[#CCCCCC] dark:text-[#3A3A2A]">·</span>
                      <span className="text-[11px] text-[#888] dark:text-[#5A5A4A]">{fmt(tx.payout)}</span>
                    </div>
                  </div>

                  {/* Date + arrow */}
                  <div className="flex shrink-0 flex-col items-end gap-0.5 py-4 pr-4 pl-2">
                    <span className="text-[12px] font-semibold text-[#555] dark:text-[#9A9A8A]">{formatDate(tx.date)}</span>
                    <span className="text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{formatTime(tx.date)}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 text-[#CCCCCC] transition-colors group-hover:text-[#C49A1E] dark:text-[#3A3A2A]"><path d="m9 18 6-6-6-6" /></svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AdminTransactionDrawer tx={selected} onClose={handleClose} />
    </div>
  );
}

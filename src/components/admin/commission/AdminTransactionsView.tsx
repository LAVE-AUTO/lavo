'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type TxStatus = 'succeeded' | 'refunded' | 'failed';

interface TxRow {
  id: string; stripe_id: string; station: string; client: string;
  gross: number; commission: number; payout: number;
  status: TxStatus; date: string;
}

// TODO: connect to API once endpoint is available (GET /admin/transactions)
const MOCK_TRANSACTIONS: TxRow[] = [
  { id: 't1', stripe_id: 'pi_3QzK1A2eZvKYlo2C1XaM0001', station: 'Wash Express MTL',   client: 'Sophie Martin',   gross: 29.99, commission: 3.00, payout: 26.99, status: 'succeeded', date: '2026-03-22T14:32:00Z' },
  { id: 't2', stripe_id: 'pi_3QzK1A2eZvKYlo2C1XaM0002', station: 'AutoBrille Laval',   client: 'Jean Tremblay',   gross: 44.50, commission: 4.45, payout: 40.05, status: 'refunded',  date: '2026-03-21T11:05:00Z' },
  { id: 't3', stripe_id: 'pi_3QzK1A2eZvKYlo2C1XaM0003', station: 'CleanCar Brossard',  client: 'Marie Côté',      gross: 19.99, commission: 2.00, payout: 17.99, status: 'succeeded', date: '2026-03-20T09:48:00Z' },
  { id: 't4', stripe_id: 'pi_3QzK1A2eZvKYlo2C1XaM0004', station: 'Wash Express MTL',   client: 'Luc Gagnon',      gross: 34.99, commission: 3.50, payout: 31.49, status: 'succeeded', date: '2026-03-19T16:20:00Z' },
  { id: 't5', stripe_id: 'pi_3QzK1A2eZvKYlo2C1XaM0005', station: 'NettoCar Longueuil', client: 'Isabelle Roy',    gross: 54.99, commission: 5.50, payout: 49.49, status: 'failed',    date: '2026-03-18T08:15:00Z' },
  { id: 't6', stripe_id: 'pi_3QzK1A2eZvKYlo2C1XaM0006', station: 'AutoBrille Laval',   client: 'Marc Lavoie',     gross: 24.99, commission: 2.50, payout: 22.49, status: 'succeeded', date: '2026-03-17T13:55:00Z' },
  { id: 't7', stripe_id: 'pi_3QzK1A2eZvKYlo2C1XaM0007', station: 'Wash Express MTL',   client: 'Sophie Martin',   gross: 29.99, commission: 3.00, payout: 26.99, status: 'succeeded', date: '2026-03-15T10:30:00Z' },
  { id: 't8', stripe_id: 'pi_3QzK1A2eZvKYlo2C1XaM0008', station: 'CleanCar Brossard',  client: 'Jean Tremblay',   gross: 19.99, commission: 2.00, payout: 17.99, status: 'refunded',  date: '2026-03-14T07:45:00Z' },
];

const STATUS_STYLE: Record<TxStatus, { badge: string; dot: string }> = {
  succeeded: { badge: 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20', dot: 'bg-[#22C55E]' },
  refunded:  { badge: 'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#3B82F6]/20', dot: 'bg-[#3B82F6]' },
  failed:    { badge: 'bg-[#FFF1F2] text-[#BE123C] ring-1 ring-[#FB7185]/20', dot: 'bg-[#F43F5E]' },
};

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
function fmt(n: number) {
  return n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
}
function shortId(s: string) { return s.slice(-8).toUpperCase(); }

export function AdminTransactionsView() {
  const t = useTranslations('admin_transactions');
  const [filter, setFilter] = useState<TxStatus | 'all'>('all');
  const [query, setQuery]   = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const q        = query.toLowerCase();
  const filtered = MOCK_TRANSACTIONS
    .filter((tx) => filter === 'all' || tx.status === filter)
    .filter((tx) => !q || tx.stripe_id.toLowerCase().includes(q) || tx.station.toLowerCase().includes(q) || tx.client.toLowerCase().includes(q));

  const succeeded = MOCK_TRANSACTIONS.filter((tx) => tx.status === 'succeeded');
  const volume    = succeeded.reduce((s, tx) => s + tx.gross, 0);
  const commTotal = succeeded.reduce((s, tx) => s + tx.commission, 0);

  const counts: Record<string, number> = { all: MOCK_TRANSACTIONS.length };
  for (const tx of MOCK_TRANSACTIONS) counts[tx.status] = (counts[tx.status] ?? 0) + 1;

  function copyId(id: string) {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  }

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
              {MOCK_TRANSACTIONS.length} {t('chip_count')}
            </span>
          </div>
        </div>

        {/* Filters + search */}
        <div className="mt-5 flex items-end justify-between gap-4 pb-0">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, label, dot }) => (
              <button key={key} type="button" onClick={() => setFilter(key)}
                className={[
                  'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all',
                  filter === key
                    ? 'bg-white text-[#1A1A0A] shadow-sm ring-1 ring-[#E0DCD0] dark:bg-[#1E2E18] dark:text-[#F0EDD4] dark:ring-[#2A3820]'
                    : 'text-[#999] hover:text-[#555] dark:text-[#5A5A4A] dark:hover:text-[#9A9A8A]',
                ].join(' ')}>
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

      {/* Table */}
      <div className="flex-1 overflow-y-auto bg-[#F5F5EE] p-6 dark:bg-[#0C1209]">
        {!filtered.length ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4DC] dark:bg-[#131E10] dark:ring-[#1E2E18]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <p className="text-[13px] font-semibold text-[#999]">{q ? t('empty_search') : t('empty_transactions')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#E8E4DC] shadow-sm dark:border-[#1E2E18]">
            {/* Header */}
            <div className="grid grid-cols-[1fr_120px_100px_100px_120px_80px] items-center gap-3 border-b border-[#E8E4DC] bg-[#F9F8F5] px-5 py-3 dark:border-[#1E2E18] dark:bg-[#0E1A0C]">
              {[t('col_reference'), t('col_gross'), t('col_commission'), t('col_payout'), t('col_status'), t('col_date')].map((h, i) => (
                <span key={i} className={`text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A] ${i >= 1 && i <= 3 ? 'text-right' : ''}`}>{h}</span>
              ))}
            </div>
            {/* Rows */}
            {filtered.map((tx, idx) => {
              const s = STATUS_STYLE[tx.status];
              const isCopied = copied === tx.stripe_id;
              return (
                <div key={tx.id}
                  className={`grid grid-cols-[1fr_120px_100px_100px_120px_80px] items-center gap-3 border-b px-5 py-3.5 transition-colors last:border-0 ${idx % 2 === 0 ? 'border-[#F2EFE8] bg-white dark:border-[#1A2A14] dark:bg-[#131E10]' : 'border-[#F2EFE8] bg-[#FAFAF7] dark:border-[#1A2A14] dark:bg-[#111C0E]'}`}>

                  {/* Reference */}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <button type="button" onClick={() => copyId(tx.stripe_id)}
                      className="group flex w-fit items-center gap-1.5 rounded-lg border border-[#E8E4DC] bg-[#F5F2EC] px-2.5 py-1 transition-colors hover:border-[#C49A1E]/40 hover:bg-[#FFF8E8] dark:border-[#1E2E18] dark:bg-[#0E1A0C] dark:hover:border-[#C49A1E]/30">
                      <span className="font-mono text-[11px] font-bold text-[#555] dark:text-[#9A9A8A]">…{shortId(tx.stripe_id)}</span>
                      {isCopied
                        ? <span className="text-[10px] font-bold text-[#22C55E]">{t('copied')}</span>
                        : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#BBBBAA] group-hover:text-[#C49A1E]"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                      }
                    </button>
                    <p className="truncate text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{tx.station} · {tx.client}</p>
                  </div>

                  <p className="text-right text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{fmt(tx.gross)}</p>
                  <p className="text-right text-[13px] font-bold text-[#C49A1E]">{fmt(tx.commission)}</p>
                  <p className="text-right text-[13px] font-bold text-[#555] dark:text-[#9A9A8A]">{fmt(tx.payout)}</p>

                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(`status_${tx.status}`)}
                  </span>

                  <p className="text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{formatDate(tx.date)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

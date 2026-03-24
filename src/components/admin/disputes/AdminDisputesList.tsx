'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { DisputeRow, DisputeStatus } from './disputes-mock';

const STATUS_STYLE: Record<DisputeStatus, { badge: string; dot: string; label: string }> = {
  open:               { badge: 'bg-[#FFF7ED] text-[#9A3412] ring-1 ring-[#FDBA74]/40', dot: 'bg-[#F97316]', label: 'status_open'               },
  refunded_full:      { badge: 'bg-[#F0FDF4] text-[#166534] ring-1 ring-[#86EFAC]/40', dot: 'bg-[#22C55E]', label: 'status_refunded_full'      },
  refunded_partial:   { badge: 'bg-[#EFF6FF] text-[#1E40AF] ring-1 ring-[#93C5FD]/40', dot: 'bg-[#3B82F6]', label: 'status_refunded_partial'   },
  closed:             { badge: 'bg-[#F9FAFB] text-[#6B7280] ring-1 ring-[#D1D5DB]/60', dot: 'bg-[#9CA3AF]', label: 'status_closed'             },
};

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
function formatAmount(n: number) {
  return n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
}
function initials(name: string) {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

interface Props { disputes: DisputeRow[]; query: string }

export function AdminDisputesList({ disputes, query }: Props) {
  const t = useTranslations('admin_disputes');
  const [filter, setFilter] = useState<DisputeStatus | 'all'>('all');

  const q        = query.toLowerCase();
  const filtered = disputes
    .filter((d) => filter === 'all' || d.status === filter)
    .filter((d) => !q || d.client.name.toLowerCase().includes(q) || d.station.name.toLowerCase().includes(q) || d.reason.toLowerCase().includes(q));

  if (!filtered.length) return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F3EE] dark:bg-[#131E10]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
      </div>
      <p className="text-[13px] font-semibold text-[#999]">{q ? t('empty_search') : t('empty_disputes')}</p>
    </div>
  );

  const FILTERS: Array<{ key: DisputeStatus | 'all'; label: string }> = [
    { key: 'all',             label: t('filter_all') },
    { key: 'open',            label: t('status_open') },
    { key: 'refunded_full',   label: t('status_refunded_full') },
    { key: 'refunded_partial',label: t('status_refunded_partial') },
    { key: 'closed',          label: t('status_closed') },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setFilter(key)}
            className={[
              'rounded-full px-3 py-1 text-[11px] font-bold transition-colors',
              filter === key
                ? 'bg-[#C49A1E] text-[#0C1209]'
                : 'bg-[#F0EDE6] text-[#888] hover:bg-[#E8E4D8] dark:bg-[#1A2A14] dark:text-[#6A6A5A] dark:hover:bg-[#243020]',
            ].join(' ')}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#E8E4DC] shadow-sm dark:border-[#1E2E18]">
        {/* Header */}
        <div className="grid grid-cols-[36px_1fr_1fr_110px_130px_100px] items-center gap-4 border-b border-[#E8E4DC] bg-[#F9F8F5] px-5 py-3 dark:border-[#1E2E18] dark:bg-[#0E1A0C]">
          {['', t('col_client'), t('col_station'), t('col_amount'), t('col_status'), t('col_actions')].map((h, i) => (
            <span key={i} className={`text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A] ${i === 5 ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {filtered.map((d, idx) => {
          const s = STATUS_STYLE[d.status];
          return (
            <div key={d.id}
              className={[
                'grid grid-cols-[36px_1fr_1fr_110px_130px_100px] items-center gap-4 border-b px-5 py-3.5 transition-colors duration-150 last:border-0',
                idx % 2 === 0
                  ? 'border-[#F2EFE8] bg-white hover:bg-[#FEFCF5] dark:border-[#1A2A14] dark:bg-[#131E10] dark:hover:bg-[#182416]'
                  : 'border-[#F2EFE8] bg-[#FAFAF7] hover:bg-[#FEFCF5] dark:border-[#1A2A14] dark:bg-[#111C0E] dark:hover:bg-[#182416]',
              ].join(' ')}>

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF7ED] text-[10px] font-black text-[#F97316] dark:bg-[#2A1A08]">
                {initials(d.client.name)}
              </div>

              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{d.client.name}</p>
                <p className="truncate text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{formatDate(d.created_at)}</p>
              </div>

              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-[#444] dark:text-[#9A9A8A]">{d.station.name}</p>
                <p className="truncate text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{d.station.city}</p>
              </div>

              <p className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{formatAmount(d.reservation.amount_paid)}</p>

              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
              </span>

              <div className="flex justify-end">
                <Link href={`/admin/disputes/${d.id}` as Parameters<typeof Link>[0]['href']}
                  className="rounded-lg border border-[#D8D4C8] px-3 py-1.5 text-[11px] font-bold text-[#555] transition-colors hover:border-[#C49A1E] hover:text-[#C49A1E] dark:border-[#243020] dark:text-[#9A9A8A] dark:hover:border-[#C49A1E] dark:hover:text-[#C49A1E]">
                  {t('btn_detail')}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

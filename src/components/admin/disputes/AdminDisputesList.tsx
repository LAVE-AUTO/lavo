'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { DisputeRow, DisputeStatus } from './disputes-mock';

const STATUS_STYLE: Record<DisputeStatus, { bar: string; badge: string; dot: string; glow: string; label: string }> = {
  open:             { bar: 'bg-[#F97316]', badge: 'bg-[#FFF4EC] text-[#C2410C] ring-1 ring-[#F97316]/20', dot: 'bg-[#F97316]', glow: 'shadow-[0_0_0_3px_rgba(249,115,22,0.10)]', label: 'status_open' },
  refunded_full:    { bar: 'bg-[#22C55E]', badge: 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20', dot: 'bg-[#22C55E]', glow: 'shadow-[0_0_0_3px_rgba(34,197,94,0.10)]',  label: 'status_refunded_full' },
  refunded_partial: { bar: 'bg-[#3B82F6]', badge: 'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#3B82F6]/20', dot: 'bg-[#3B82F6]', glow: 'shadow-[0_0_0_3px_rgba(59,130,246,0.10)]', label: 'status_refunded_partial' },
  closed:           { bar: 'bg-[#94A3B8]', badge: 'bg-[#F8FAFC] text-[#64748B] ring-1 ring-[#CBD5E1]/60',  dot: 'bg-[#94A3B8]', glow: '',                                            label: 'status_closed' },
};

const AMOUNT_COLOR: Record<DisputeStatus, string> = {
  open:             'text-[#C2410C]',
  refunded_full:    'text-[#15803D]',
  refunded_partial: 'text-[#1D4ED8]',
  closed:           'text-[#64748B]',
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

  const counts: Record<string, number> = { all: disputes.length };
  for (const d of disputes) counts[d.status] = (counts[d.status] ?? 0) + 1;

  const FILTERS: Array<{ key: DisputeStatus | 'all'; label: string; color?: string }> = [
    { key: 'all',             label: t('filter_all') },
    { key: 'open',            label: t('status_open'),            color: '#F97316' },
    { key: 'refunded_full',   label: t('status_refunded_full'),   color: '#22C55E' },
    { key: 'refunded_partial',label: t('status_refunded_partial'),color: '#3B82F6' },
    { key: 'closed',          label: t('status_closed'),          color: '#94A3B8' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label, color }) => {
          const isActive = filter === key;
          const count    = counts[key] ?? 0;
          return (
            <button key={key} type="button" onClick={() => setFilter(key)}
              className={[
                'flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-[12px] font-bold transition-all duration-150',
                isActive
                  ? 'bg-white text-[#1A1A0A] shadow-[0_2px_8px_rgba(0,0,0,0.10)] ring-1 ring-[#E0DCD0] dark:bg-[#1E2E18] dark:text-[#F0EDD4] dark:ring-[#2A3820]'
                  : 'text-[#999] hover:text-[#555] hover:bg-white/60 dark:text-[#A0A090] dark:hover:text-[#9A9A8A] dark:hover:bg-[#1A2A14]/60',
              ].join(' ')}>
              {color && (
                <span className="h-2 w-2 rounded-full" style={{ background: isActive ? color : '#CCCCCC' }} />
              )}
              {label}
              <span className={[
                'min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-black transition-colors',
                isActive ? 'bg-[#C49A1E] text-[#0C1209]' : 'bg-[#E8E4DC] text-[#AAAAAA] dark:bg-[#1E2E18] dark:text-[#A0A090]',
              ].join(' ')}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {!filtered.length ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4DC] dark:bg-[#131E10] dark:ring-[#1E2E18]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </div>
          <p className="text-[13px] font-semibold text-[#999]">{q ? t('empty_search') : t('empty_disputes')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((d) => {
            const s = STATUS_STYLE[d.status];
            return (
              <Link key={d.id} href={`/admin/disputes/${d.id}` as Parameters<typeof Link>[0]['href']}
                className={`group flex overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-[#1E2E18] dark:bg-[#131E10] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] ${d.status === 'open' ? 'hover:border-[#F97316]/30' : ''}`}>

                {/* Left accent bar */}
                <div className={`w-1 shrink-0 ${s.bar}`} />

                {/* Content */}
                <div className="flex min-w-0 flex-1 items-center gap-5 px-5 py-4">
                  {/* Avatar */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-black text-white ${s.bar}`}>
                    {initials(d.client.name)}
                  </div>

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{d.client.name}</p>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-[#AAAAAA] dark:text-[#A0A090]">
                      {d.station.name} · {d.station.city} · {formatDate(d.created_at)}
                    </p>
                    <p className="mt-1.5 line-clamp-1 text-[12px] text-[#666] dark:text-[#7A7A6A]">{d.reason}</p>
                  </div>

                  {/* Amount + arrow */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className={`text-[18px] font-black ${AMOUNT_COLOR[d.status]}`}>{formatAmount(d.reservation.amount_paid)}</p>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#BBBBAA] transition-colors group-hover:text-[#C49A1E] dark:text-[#A0A090]">
                      {t('btn_detail')}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

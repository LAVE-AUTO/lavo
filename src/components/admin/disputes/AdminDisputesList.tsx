'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { DisputeListItem, DisputeStatus } from './dispute-types';
import { parseAmount } from './dispute-types';

const STATUS_STYLE: Record<DisputeStatus, { bar: string; badge: string; dot: string; label: string; amount: string }> = {
  open:     { bar: 'bg-[#F97316]', badge: 'bg-[#FFF4EC] text-[#C2410C] ring-1 ring-[#F97316]/20', dot: 'bg-[#F97316]', label: 'status_open',     amount: 'text-[#C2410C]' },
  refunded: { bar: 'bg-[#22C55E]', badge: 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20', dot: 'bg-[#22C55E]', label: 'status_refunded', amount: 'text-[#15803D]' },
  resolved: { bar: 'bg-[#94A3B8]', badge: 'bg-[#F8FAFC] text-[#64748B] ring-1 ring-[#CBD5E1]/60', dot: 'bg-[#94A3B8]', label: 'status_resolved', amount: 'text-[#64748B]' },
  rejected: { bar: 'bg-[#94A3B8]', badge: 'bg-[#F8FAFC] text-[#64748B] ring-1 ring-[#CBD5E1]/60', dot: 'bg-[#94A3B8]', label: 'status_rejected', amount: 'text-[#64748B]' },
};

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function formatAmount(n: number) {
  return n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
}

interface Props {
  disputes: DisputeListItem[];
  query: string;
  filter: DisputeStatus | 'all';
  onFilterChange: (filter: DisputeStatus | 'all') => void;
}

export function AdminDisputesList({ disputes, query, filter, onFilterChange }: Props) {
  const t = useTranslations('admin_disputes');

  const q = query.toLowerCase();
  const filtered = disputes.filter((d) =>
    !q
      || (d.station?.name ?? '').toLowerCase().includes(q)
      || (d.station?.city ?? '').toLowerCase().includes(q)
      || d.reason.toLowerCase().includes(q),
  );

  const counts: Record<string, number> = { all: disputes.length };
  for (const d of disputes) counts[d.status] = (counts[d.status] ?? 0) + 1;

  const FILTERS: Array<{ key: DisputeStatus | 'all'; label: string; color?: string }> = [
    { key: 'all',      label: t('filter_all') },
    { key: 'open',     label: t('status_open'),     color: '#F97316' },
    { key: 'refunded', label: t('status_refunded'), color: '#22C55E' },
    { key: 'resolved', label: t('status_resolved'), color: '#94A3B8' },
    { key: 'rejected', label: t('status_rejected'), color: '#94A3B8' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label, color }) => {
          const isActive = filter === key;
          const count    = counts[key] ?? 0;
          return (
            <button key={key} type="button" onClick={() => onFilterChange(key)}
              className={[
                'flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-[13px] font-bold transition-all duration-150',
                isActive
                  ? 'bg-white text-[#001201] shadow-[0_2px_8px_rgba(0,0,0,0.10)] ring-1 ring-[#E0DCD0] dark:bg-[#1E2E18] dark:text-[#FFF9EC] dark:ring-[#2A3820]'
                  : 'text-[#999] hover:text-foreground/70 hover:bg-white/60 dark:text-[#A0A090] dark:hover:text-[#9A9A8A] dark:hover:bg-[#1A2A14]/60',
              ].join(' ')}>
              {color && (
                <span className="h-2 w-2 rounded-full" style={{ background: isActive ? color : '#CCCCCC' }} />
              )}
              {label}
              <span className={[
                'min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-black transition-colors',
                isActive ? 'bg-[#DDAF3B] text-[#0C1209]' : 'bg-[#E8E4DC] text-[#AAAAAA] dark:bg-[#1E2E18] dark:text-[#A0A090]',
              ].join(' ')}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {!filtered.length ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4DC] dark:bg-[#131E10] dark:ring-[#1E2E18]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </div>
          <p className="text-[13px] font-semibold text-[#999]">{q ? t('empty_search') : t('empty_disputes')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((d) => {
            const s = STATUS_STYLE[d.status];
            const stationName = d.station?.name ?? t('label_unknown_station');
            const amount = parseAmount(d.refunded_amount ?? d.requested_amount);
            return (
              <Link key={d.id} href={`/admin/disputes/${d.id}` as Parameters<typeof Link>[0]['href']}
                className={`group flex overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-[#1E2E18] dark:bg-[#131E10] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] ${d.status === 'open' ? 'hover:border-[#F97316]/30' : ''}`}>

                {/* Left accent bar */}
                <div className={`w-1 shrink-0 ${s.bar}`} />

                {/* Content */}
                <div className="flex min-w-0 flex-1 items-center gap-5 px-5 py-4">
                  {/* Avatar */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-black text-white ${s.bar}`}>
                    {initials(stationName)}
                  </div>

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-bold text-[#001201] dark:text-[#FFF9EC]">{stationName}</p>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${s.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-[#AAAAAA] dark:text-[#A0A090]">
                      {d.station?.city ?? '—'} · {formatDate(d.created_at)}
                    </p>
                    <p className="mt-1.5 line-clamp-1 text-[13px] text-foreground/65 dark:text-[#7A7A6A]">{d.reason}</p>
                  </div>

                  {/* Amount + arrow */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {amount > 0 && (
                      <p className={`text-[18px] font-black ${s.amount}`}>{formatAmount(amount)}</p>
                    )}
                    <div className="flex items-center gap-1 text-[12px] font-bold text-[#BBBBAA] transition-colors group-hover:text-[#DDAF3B] dark:text-[#A0A090]">
                      {t('btn_detail')}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
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

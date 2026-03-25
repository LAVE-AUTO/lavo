'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { SupportTicket, TicketStatus, TicketRole } from '@/components/support/support-mock';

const STATUS_STYLE: Record<TicketStatus, { bar: string; badge: string; dot: string; label: string }> = {
  open:        { bar: 'bg-[#F97316]', badge: 'bg-[#FFF4EC] text-[#C2410C] ring-1 ring-[#F97316]/20', dot: 'bg-[#F97316]', label: 'status_open' },
  in_progress: { bar: 'bg-[#3B82F6]', badge: 'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#3B82F6]/20', dot: 'bg-[#3B82F6]', label: 'status_in_progress' },
  resolved:    { bar: 'bg-[#22C55E]', badge: 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20', dot: 'bg-[#22C55E]', label: 'status_resolved' },
  closed:      { bar: 'bg-[#94A3B8]', badge: 'bg-[#F8FAFC] text-[#64748B] ring-1 ring-[#CBD5E1]/60', dot: 'bg-[#94A3B8]', label: 'status_closed' },
};

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

type FilterKey = TicketStatus | 'all';

interface Props { tickets: SupportTicket[]; query: string }

export function AdminSupportList({ tickets, query }: Props) {
  const t = useTranslations('admin_support');
  const [filter, setFilter] = useState<FilterKey>('all');

  const q        = query.toLowerCase();
  const filtered = tickets
    .filter((tk) => filter === 'all' || tk.status === filter)
    .filter((tk) => !q || tk.subject.toLowerCase().includes(q) || tk.created_by.toLowerCase().includes(q));

  const counts: Record<string, number> = { all: tickets.length };
  for (const tk of tickets) counts[tk.status] = (counts[tk.status] ?? 0) + 1;

  const FILTERS: Array<{ key: FilterKey; label: string; color?: string }> = [
    { key: 'all',         label: t('filter_all') },
    { key: 'open',        label: t('status_open'),        color: '#F97316' },
    { key: 'in_progress', label: t('status_in_progress'), color: '#3B82F6' },
    { key: 'resolved',    label: t('status_resolved'),    color: '#22C55E' },
    { key: 'closed',      label: t('status_closed'),      color: '#94A3B8' },
  ];

  const ROLE_LABEL: Record<TicketRole, string> = {
    client:  t('role_client'),
    station: t('role_station'),
  };

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
                  : 'text-[#999] hover:text-[#555] hover:bg-white/60 dark:text-[#5A5A4A] dark:hover:text-[#9A9A8A]',
              ].join(' ')}>
              {color && <span className="h-2 w-2 rounded-full" style={{ background: isActive ? color : '#CCCCCC' }} />}
              {label}
              <span className={[
                'min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-black',
                isActive ? 'bg-[#C49A1E] text-[#0C1209]' : 'bg-[#E8E4DC] text-[#AAAAAA] dark:bg-[#1E2E18] dark:text-[#4A4A3A]',
              ].join(' ')}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {!filtered.length ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4DC] dark:bg-[#131E10] dark:ring-[#1E2E18]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
          </div>
          <p className="text-[13px] font-semibold text-[#999]">{q ? t('empty_search') : t('empty_tickets')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((tk) => {
            const s = STATUS_STYLE[tk.status];
            return (
              <Link key={tk.id} href={`/admin/support/${tk.id}` as Parameters<typeof Link>[0]['href']}
                className="group flex overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-[#1E2E18] dark:bg-[#131E10]">

                <div className={`w-1 shrink-0 ${s.bar}`} />

                <div className="flex min-w-0 flex-1 items-center gap-5 px-5 py-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-black text-white ${s.bar}`}>
                    {initials(tk.created_by)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{tk.subject}</p>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
                      </span>
                      <span className="shrink-0 rounded-full bg-[#F0EDE0] px-2 py-0.5 text-[10px] font-bold text-[#888] dark:bg-[#1A2A14] dark:text-[#5A5A4A]">
                        {ROLE_LABEL[tk.role]}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-[#AAAAAA] dark:text-[#4A4A3A]">
                      {tk.created_by} · {formatDate(tk.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#BBBBAA] transition-colors group-hover:text-[#C49A1E] dark:text-[#4A4A3A]">
                    {t('btn_detail')}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
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

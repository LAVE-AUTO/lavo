'use client';

import { useTranslations, useLocale } from 'next-intl';
import { intlDateLocale } from '@/helpers/date-helper';
import { Link } from '@/i18n/navigation';
import type { ApiTicketListItem, DisplayStatus } from '@/types/support';
import { STATUS_MAP, userDisplayName } from '@/types/support';

const STATUS_STYLE: Record<DisplayStatus, { bar: string; dot: string; text: string; label: string }> = {
  open:        { bar: 'bg-[#F97316]', dot: 'bg-[#F97316]', text: 'text-[#C2410C] dark:text-[#FDBA74]', label: 'status_open' },
  in_progress: { bar: 'bg-[#1E40AF]', dot: 'bg-[#1E40AF]', text: 'text-[#1D4ED8] dark:text-[#93C5FD]', label: 'status_in_progress' },
  resolved:    { bar: 'bg-[#22C55E]', dot: 'bg-[#22C55E]', text: 'text-[#166534] dark:text-[#86EFAC]', label: 'status_resolved' },
  closed:      { bar: 'bg-[#94A3B8]', dot: 'bg-[#94A3B8]', text: 'text-[#64748B] dark:text-[#CBD5E1]', label: 'status_closed' },
};

function formatDate(d: string, locale: string) {
  try { return new Date(d).toLocaleDateString(intlDateLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
}

type FilterKey = DisplayStatus | 'all';
interface Props { tickets: ApiTicketListItem[]; query: string; loading: boolean; filter: FilterKey }

export function AdminSupportList({ tickets, query, loading, filter }: Props) {
  const t = useTranslations('admin_support');
  const locale = useLocale();

  if (loading) {
    return (
      <div className="flex flex-col gap-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex overflow-hidden rounded-[18px] border border-[#FFF9EC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
            <div className="w-1 shrink-0 bg-[#FFF9EC] dark:bg-[#1E2E18]" />
            <div className="flex min-w-0 flex-1 items-center gap-5 px-5 py-4">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-[12px] bg-[#FFF9EC] dark:bg-[#1E2E18]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-48 animate-pulse rounded bg-[#FFF9EC] dark:bg-[#1E2E18]" />
                <div className="h-3 w-72 animate-pulse rounded bg-[#F0EDE4] dark:bg-[#001A05]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const q        = query.toLowerCase();
  const filtered = tickets
    .filter((tk) => filter === 'all' || STATUS_MAP[tk.status] === filter)
    .filter((tk) => !q || tk.subject.toLowerCase().includes(q) || userDisplayName(tk.createdByUser).toLowerCase().includes(q));

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#FFF9EC] dark:bg-[#131E10] dark:ring-[#1E2E18]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <p className="text-[13px] font-semibold text-[#999]">{q ? t('empty_search') : t('empty_tickets')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filtered.map((tk) => {
        const displayStatus = STATUS_MAP[tk.status];
        const s             = STATUS_STYLE[displayStatus];
        const creatorName   = userDisplayName(tk.createdByUser);
        const role          = tk.createdByUser.role as 'client' | 'station';
        const ROLE_LABEL: Record<'client' | 'station', string> = {
          client:  t('role_client'),
          station: t('role_station'),
        };
        return (
          <Link
            key={tk.id}
            href={`/admin/support/${tk.id}` as Parameters<typeof Link>[0]['href']}
            className="group flex overflow-hidden rounded-[18px] border border-[#FFF9EC] bg-white shadow-[0_4px_12px_rgba(26,26,10,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(26,26,10,0.08)] dark:border-[#1E2E18] dark:bg-[#131E10]"
          >
            <div className={`w-1 shrink-0 ${s.bar}`} />

            <div className="flex min-w-0 flex-1 items-center gap-4 px-5 py-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-dark-bg/5 text-[12px] font-black text-[#001201] ring-1 ring-inset ring-[#001201]/8 dark:bg-[#FFF9EC]/8 dark:text-[#FFF9EC] dark:ring-[#FFF9EC]/10">
                {initials(creatorName)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[13.5px] font-bold text-[#001201] dark:text-[#FFF9EC]">{tk.subject}</p>
                  <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#FFF9EC] px-2.5 py-0.5 text-[11.5px] font-bold dark:bg-[#171F12] ${s.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
                  </span>
                  <span className="shrink-0 rounded-full bg-[#FFEECA] px-2.5 py-0.5 text-[11px] font-bold text-[#5A554B] dark:bg-[#171F12] dark:text-[#A6A091]">
                    {ROLE_LABEL[role] ?? role}
                  </span>
                </div>
                {tk.lastMessage ? (
                  <p className="mt-0.5 truncate text-[12.5px] text-[#9B9588] dark:text-[#7E8A75]">
                    {tk.lastMessage.content}
                  </p>
                ) : null}
                <p className="mt-1 text-[11.5px] font-semibold text-[#A8A293] dark:text-[#7E8A75]">
                  {creatorName} · {formatDate(tk.created_at, locale)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-[#BBB6A7] transition-colors group-hover:text-[#9A7A13] dark:text-[#B0BFB1] dark:group-hover:text-[#F0D98C]">
                {t('btn_detail')}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

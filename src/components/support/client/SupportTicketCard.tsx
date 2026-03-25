'use client';

import { useTranslations } from 'next-intl';
import type { SupportTicket, TicketStatus } from '../support-mock';

const STATUS_STYLE: Record<TicketStatus, { badge: string; dot: string; label: string }> = {
  open:        { badge: 'bg-[#FFF4EC] text-[#C2410C] ring-1 ring-[#F97316]/20', dot: 'bg-[#F97316]', label: 'status_open' },
  in_progress: { badge: 'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#3B82F6]/20', dot: 'bg-[#3B82F6]', label: 'status_in_progress' },
  resolved:    { badge: 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20', dot: 'bg-[#22C55E]', label: 'status_resolved' },
  closed:      { badge: 'bg-[#F8FAFC] text-[#64748B] ring-1 ring-[#CBD5E1]/60', dot: 'bg-[#94A3B8]', label: 'status_closed' },
};

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

interface Props {
  ticket: SupportTicket;
}

export function SupportTicketCard({ ticket }: Props) {
  const t = useTranslations('client_support');
  const s = STATUS_STYLE[ticket.status];
  const lastMessage = ticket.messages[ticket.messages.length - 1];

  return (
    <div className="flex overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
      {/* Left accent */}
      <div className={`w-1 shrink-0 ${s.dot}`} />

      <div className="flex min-w-0 flex-1 flex-col gap-1 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <p className="truncate text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{ticket.subject}</p>
          <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
          </span>
        </div>
        {lastMessage && (
          <p className="line-clamp-2 text-[12px] text-[#777] dark:text-[#6A6A5A]">{lastMessage.body}</p>
        )}
        <p className="mt-1 text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">
          {t('label_created')} {formatDate(ticket.created_at)}
        </p>
      </div>
    </div>
  );
}

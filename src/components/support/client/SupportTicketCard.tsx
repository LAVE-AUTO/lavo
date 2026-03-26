'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SupportTicket, TicketStatus } from '../support-mock';

const STATUS: Record<TicketStatus, {
  bar:       string;
  badge:     string;
  dot:       string;
  label:     string;
  iconColor: string;
  iconBg:    string;
}> = {
  open:        { bar: 'bg-[#F97316]', badge: 'bg-[#FFF4EC] text-[#C2410C] ring-1 ring-[#F97316]/20',  dot: 'bg-[#F97316]', label: 'status_open',        iconColor: '#F97316', iconBg: 'bg-[#FFF4EC] dark:bg-[#F97316]/10' },
  in_progress: { bar: 'bg-[#3B82F6]', badge: 'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#3B82F6]/20',  dot: 'bg-[#3B82F6]', label: 'status_in_progress', iconColor: '#3B82F6', iconBg: 'bg-[#EFF6FF] dark:bg-[#3B82F6]/10' },
  resolved:    { bar: 'bg-[#22C55E]', badge: 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20',  dot: 'bg-[#22C55E]', label: 'status_resolved',    iconColor: '#22C55E', iconBg: 'bg-[#F0FDF4] dark:bg-[#22C55E]/10' },
  closed:      { bar: 'bg-[#94A3B8]', badge: 'bg-[#F8FAFC] text-[#64748B] ring-1 ring-[#CBD5E1]/60',  dot: 'bg-[#94A3B8]', label: 'status_closed',      iconColor: '#94A3B8', iconBg: 'bg-[#F8FAFC] dark:bg-[#94A3B8]/10' },
};

function formatDateTime(d: string) {
  try {
    return new Date(d).toLocaleString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return d; }
}

interface Props { ticket: SupportTicket }

export function SupportTicketCard({ ticket }: Props) {
  const t        = useTranslations('client_support');
  const [open, setOpen] = useState(false);
  const s        = STATUS[ticket.status];
  const lastMsg  = ticket.messages[ticket.messages.length - 1];
  const msgCount = ticket.messages.length;
  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <div className={[
      'overflow-hidden rounded-2xl border transition-all duration-200',
      open
        ? 'border-[#C49A1E]/30 shadow-[0_4px_20px_rgba(196,154,30,0.10)] dark:border-[#C49A1E]/20'
        : 'border-[#E8E4DC] shadow-sm hover:border-[#D0CCC4] dark:border-[#1E2E18] dark:hover:border-[#2A3820]',
      'bg-white dark:bg-[#131E10]',
    ].join(' ')}>

      {/* --- Clickable header --- */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex overflow-hidden text-left group focus-visible:outline-none"
        aria-expanded={open}
        aria-label={`${open ? t('btn_collapse') : t('btn_expand')} — ${ticket.subject}`}
        aria-controls={`ticket-thread-${ticket.id}`}
      >
        <div className={`w-1 shrink-0 ${s.bar}`} />

        <div className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4">
          {/* Icon */}
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" style={{ stroke: s.iconColor }} aria-hidden="true">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="truncate text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{ticket.subject}</p>
              <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                {t(s.label)}
              </span>
            </div>
            {!open && lastMsg && (
              <p className="mt-0.5 line-clamp-1 text-[12px] text-[#888] dark:text-[#6A6A5A]">{lastMsg.body}</p>
            )}
            <div className="mt-1 flex items-center gap-2 text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">
              <span>{formatDate(ticket.created_at)}</span>
              {msgCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{msgCount} {t('label_messages')}</span>
                </>
              )}
            </div>
          </div>

          {/* Chevron */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className={`shrink-0 text-[#CCCCBB] transition-transform duration-200 group-hover:text-[#C49A1E] dark:text-[#3A3A2A] ${open ? 'rotate-180' : ''}`}
            aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* --- Thread (expanded) --- */}
      {open && (
        <div id={`ticket-thread-${ticket.id}`} className="border-t border-[#F0EDE4] dark:border-[#1A2A14]">
          {msgCount === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-[12px] text-[#AAAAAA] dark:text-[#4A4A3A]">{t('thread_no_messages')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 px-5 py-4">
              {ticket.messages.map((msg) => {
                const isAdmin = msg.role === 'admin';
                return (
                  <div key={msg.id} className={`flex gap-2.5 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                    <div className={[
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black leading-none',
                      isAdmin
                        ? 'bg-[#C49A1E] text-[#0C1209]'
                        : 'bg-[#E8E4DC] text-[#666] dark:bg-[#1E2E18] dark:text-[#8A8A7A]',
                    ].join(' ')}>
                      {msg.author.substring(0, 2).toUpperCase()}
                    </div>
                    <div className={[
                      'max-w-[82%] rounded-2xl px-4 py-2.5',
                      isAdmin
                        ? 'rounded-tr-sm bg-[#C49A1E]/10 dark:bg-[#C49A1E]/8'
                        : 'rounded-tl-sm bg-[#F5F5EE] ring-1 ring-black/[0.04] dark:bg-[#0F1A0C] dark:ring-white/[0.04]',
                    ].join(' ')}>
                      {isAdmin && (
                        <p className="mb-1 text-[10px] font-black tracking-wide text-[#C49A1E]/90">{t('thread_admin_label')}</p>
                      )}
                      <p className="text-[13px] leading-relaxed text-[#1A1A0A] dark:text-[#F0EDD4]">{msg.body}</p>
                      <p className="mt-1.5 text-[10px] text-[#BBBBAA] dark:text-[#4A4A3A]">{formatDateTime(msg.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Closed / resolved hint */}
          {isClosed && (
            <div className="border-t border-[#F0EDE4] px-5 py-3 dark:border-[#1A2A14]">
              <p className="text-center text-[11px] text-[#AAAAAA] dark:text-[#4A4A3A]">
                {ticket.status === 'resolved' ? t('thread_resolved_hint') : t('thread_closed_hint')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getFromApi, postWithApi } from '@/services/axios-service';
import { useToast } from '@/context/toast-context';
import type { SupportTicketSummary, SupportTicketDetail, SupportMessage, TicketStatus } from '../support-types';
import { mapApiStatus } from '../support-types';

const STATUS: Record<TicketStatus, {
  bar: string; badge: string; dot: string; label: string; iconColor: string; iconBg: string;
}> = {
  open:        { bar: 'bg-[#F97316]', badge: 'bg-[#FFF4EC] text-[#C2410C] ring-1 ring-[#F97316]/20',  dot: 'bg-[#F97316]', label: 'status_open',        iconColor: '#F97316', iconBg: 'bg-[#FFF4EC] dark:bg-[#F97316]/10' },
  in_progress: { bar: 'bg-[#3B82F6]', badge: 'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#3B82F6]/20',  dot: 'bg-[#3B82F6]', label: 'status_in_progress', iconColor: '#3B82F6', iconBg: 'bg-[#EFF6FF] dark:bg-[#3B82F6]/10' },
  resolved:    { bar: 'bg-[#22C55E]', badge: 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20',  dot: 'bg-[#22C55E]', label: 'status_resolved',    iconColor: '#22C55E', iconBg: 'bg-[#F0FDF4] dark:bg-[#22C55E]/10' },
  closed:      { bar: 'bg-[#94A3B8]', badge: 'bg-[#F8FAFC] text-[#64748B] ring-1 ring-[#CBD5E1]/60',  dot: 'bg-[#94A3B8]', label: 'status_closed',      iconColor: '#94A3B8', iconBg: 'bg-[#F8FAFC] dark:bg-[#94A3B8]/10' },
};

function getDateLocale(locale: string): string {
  return locale.startsWith('en') ? 'en-CA' : 'fr-CA';
}

function formatDateTime(d: string, locale: string) {
  try {
    return new Date(d).toLocaleString(getDateLocale(locale), {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch { return d; }
}

function formatDate(d: string, locale: string) {
  try {
    return new Date(d).toLocaleDateString(getDateLocale(locale), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch { return d; }
}

interface Props {
  ticket: SupportTicketSummary;
  onMessageSent?: () => void;
}

export function SupportTicketCard({ ticket, onMessageSent }: Props) {
  const t = useTranslations('client_support');
  const locale = useLocale();
  const { success: toastSuccess, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const status = mapApiStatus(ticket.status);
  const s = STATUS[status];
  const isClosed = status === 'closed' || status === 'resolved';

  async function loadMessages() {
    setLoadingMessages(true);
    const [ok, data] = await getFromApi<{ data: SupportTicketDetail }>(`/support/${ticket.id}`);
    if (!mountedRef.current) return;
    setLoadingMessages(false);
    if (ok) {
      const detail = (data as { data: SupportTicketDetail }).data;
      if (detail?.messages) setMessages(detail.messages);
    }
  }

  function handleToggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && messages.length === 0) {
      loadMessages();
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSending(true);
    const [ok] = await postWithApi(`/support/${ticket.id}/messages`, { content: replyContent.trim() });
    if (!mountedRef.current) return;
    setSending(false);
    if (ok) {
      setReplyContent('');
      toastSuccess(t('message_sent'));
      await loadMessages();
      onMessageSent?.();
    } else {
      toastError(t('message_send_error'));
    }
  }

  return (
    <div className={[
      'overflow-hidden rounded-2xl border transition-all duration-200',
      open
        ? 'border-[#C49A1E]/30 shadow-[0_4px_20px_rgba(196,154,30,0.10)] dark:border-[#C49A1E]/20'
        : 'border-[#E8E4DC] shadow-sm hover:border-[#D0CCC4] dark:border-[#1E2E18] dark:hover:border-[#2A3820]',
      'bg-white dark:bg-[#131E10]',
    ].join(' ')}>

      {/* Clickable header */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex overflow-hidden text-left group focus-visible:outline-none"
        aria-expanded={open}
        aria-label={`${open ? t('btn_collapse') : t('btn_expand')} — ${ticket.subject}`}
        aria-controls={`ticket-thread-${ticket.id}`}
      >
        <div className={`w-1 shrink-0 ${s.bar}`} />

        <div className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4">
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
            {!open && ticket.lastMessage && (
              <p className="mt-0.5 line-clamp-1 text-[12px] text-[#888] dark:text-[#6A6A5A]">{ticket.lastMessage.content}</p>
            )}
            <div className="mt-1 flex items-center gap-2 text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">
              <span>{formatDate(ticket.created_at, locale)}</span>
              {ticket.ticket_number && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{ticket.ticket_number}</span>
                </>
              )}
            </div>
          </div>

          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className={`shrink-0 text-[#CCCCBB] transition-transform duration-200 group-hover:text-[#C49A1E] dark:text-[#3A3A2A] ${open ? 'rotate-180' : ''}`}
            aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Thread (expanded) */}
      {open && (
        <div id={`ticket-thread-${ticket.id}`} className="border-t border-[#F0EDE4] dark:border-[#1A2A14]">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-[2px] border-[#C49A1E] border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-[12px] text-[#AAAAAA] dark:text-[#4A4A3A]">{t('thread_no_messages')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 px-5 py-4">
              {messages.map((msg) => {
                const isAdmin = msg.is_from_admin;
                return (
                  <div key={msg.id} className={`flex gap-2.5 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                    <div className={[
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black leading-none',
                      isAdmin
                        ? 'bg-[#C49A1E] text-[#0C1209]'
                        : 'bg-[#E8E4DC] text-[#666] dark:bg-[#1E2E18] dark:text-[#A0A090]',
                    ].join(' ')}>
                      {isAdmin ? 'AD' : 'ME'}
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
                      <p className="text-[13px] leading-relaxed text-[#1A1A0A] dark:text-[#F0EDD4]">{msg.content}</p>
                      <p className="mt-1.5 text-[10px] text-[#BBBBAA] dark:text-[#4A4A3A]">{formatDateTime(msg.created_at, locale)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reply form — hidden for closed/resolved tickets */}
          {!isClosed && !loadingMessages && (
            <form onSubmit={handleSendMessage} className="border-t border-[#F0EDE4] px-5 py-3 dark:border-[#1A2A14]">
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={t('reply_placeholder')}
                  maxLength={5000}
                  className="flex-1 resize-none rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2 text-[13px] text-[#1A1A0A] outline-none transition-colors placeholder:text-[#BBBBAA] focus:border-[#C49A1E] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A]"
                />
                <button
                  type="submit"
                  disabled={sending || !replyContent.trim()}
                  className="shrink-0 rounded-[8px] bg-[#C49A1E] px-4 py-2 text-[12px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {sending ? '...' : t('btn_send')}
                </button>
              </div>
            </form>
          )}

          {/* Closed/resolved hint */}
          {isClosed && (
            <div className="border-t border-[#F0EDE4] px-5 py-3 dark:border-[#1A2A14]">
              <p className="text-center text-[11px] text-[#AAAAAA] dark:text-[#4A4A3A]">
                {status === 'resolved' ? t('thread_resolved_hint') : t('thread_closed_hint')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import { patchWithApi } from '@/services/axios-service';
import { Modal } from '@/components/ui/Modal';
import { MOCK_TICKETS, type SupportTicket, type TicketStatus } from '@/components/support/support-mock';

const STATUS_STYLE: Record<TicketStatus, { badge: string; dot: string; label: string }> = {
  open:        { badge: 'bg-[#FFF4EC] text-[#C2410C] ring-1 ring-[#F97316]/20', dot: 'bg-[#F97316]', label: 'status_open' },
  in_progress: { badge: 'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#3B82F6]/20', dot: 'bg-[#3B82F6]', label: 'status_in_progress' },
  resolved:    { badge: 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20', dot: 'bg-[#22C55E]', label: 'status_resolved' },
  closed:      { badge: 'bg-[#F8FAFC] text-[#64748B] ring-1 ring-[#CBD5E1]/60', dot: 'bg-[#94A3B8]', label: 'status_closed' },
};

const ROLE_COLOR: Record<string, string> = {
  client:  'bg-[#EFF6FF] text-[#1D4ED8] dark:bg-[#1D4ED8]/10 dark:text-[#60A5FA]',
  station: 'bg-[#F0FDF4] text-[#15803D] dark:bg-[#15803D]/10 dark:text-[#4ADE80]',
};

function formatDateTime(d: string) {
  try {
    return new Date(d).toLocaleString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

function nameInitials(name: string) {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
}

/* ---- Close modal ---- */
interface CloseModalProps { open: boolean; onConfirm: (reason: string) => void; onCancel: () => void; busy: boolean }

function CloseModal({ open, onConfirm, onCancel, busy }: CloseModalProps) {
  const t = useTranslations('admin_support');
  const [reason, setReason] = useState('');

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason.trim());
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t('close_modal_title')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy}
            className="rounded-[10px] border border-[#E0DCD0] px-4 py-2 text-[13px] font-semibold text-[#666] transition-colors hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-[#243020] dark:text-[#9A9A8A]">
            {t('close_modal_cancel')}
          </button>
          <button type="submit" form="close-ticket-form" disabled={busy || !reason.trim()}
            className="rounded-[10px] bg-[#94A3B8] px-5 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-50">
            {t('close_modal_confirm')}
          </button>
        </div>
      }
    >
      <form id="close-ticket-form" onSubmit={handleConfirm} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="close-ticket-reason" className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{t('close_modal_reason_label')}</label>
          <textarea id="close-ticket-reason" rows={3} maxLength={500}
            className="w-full resize-none rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]"
            placeholder={t('close_modal_reason_placeholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}

/* ---- Main component ---- */
interface Props { id: string }

export function AdminSupportDetail({ id }: Props) {
  const t = useTranslations('admin_support');
  const { success: toastSuccess, error: toastError } = useToast();
  const { user } = useAuth();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // TODO: replace with getFromApi(`/admin/support/tickets/${id}`) once endpoint is available
  const found = MOCK_TICKETS.find((tk) => tk.id === id);
  const [ticket, setTicket] = useState<SupportTicket | undefined>(found);

  const [reply,           setReply]           = useState('');
  const [replySaving,     setReplySaving]     = useState(false);
  const [actionBusy,      setActionBusy]      = useState(false);
  const [showCloseModal,  setShowCloseModal]  = useState(false);

  if (!ticket) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-[13px] text-[#999]">{t('not_found')}</p>
      </div>
    );
  }

  const s          = STATUS_STYLE[ticket.status];
  const isClosed   = ticket.status === 'closed';
  const isResolved = ticket.status === 'resolved';

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) { toastError(t('error_reply_empty')); return; }
    setReplySaving(true);
    try {
      // TODO: connect to API once endpoint is available (POST /admin/support/tickets/:id/messages)
      await new Promise((r) => setTimeout(r, 500));
      if (!mountedRef.current) return;
      setTicket((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: prev.status === 'open' ? 'in_progress' : prev.status,
          messages: [...prev.messages, { id: `m-${Date.now()}`, author: 'Admin Support', role: 'admin', body: reply.trim(), created_at: new Date().toISOString() }],
        };
      });
      setReply('');
      toastSuccess(t('reply_success'));
    } catch {
      if (mountedRef.current) toastError(t('reply_error'));
    } finally {
      if (mountedRef.current) setReplySaving(false);
    }
  }

  async function handleAssignMe() {
    if (!user?.id) return;
    setActionBusy(true);
    try {
      const [ok] = await patchWithApi(`/admin/support/${id}/assign`, { assigned_to: user.id });
      if (!mountedRef.current) return;
      if (ok) {
        const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Admin';
        setTicket((prev) => prev ? { ...prev, assigned_to: displayName } : prev);
        toastSuccess(t('assign_success'));
      } else {
        toastError(t('assign_error'));
      }
    } catch {
      if (mountedRef.current) toastError(t('assign_error'));
    } finally {
      if (mountedRef.current) setActionBusy(false);
    }
  }

  async function handleResolve() {
    setActionBusy(true);
    try {
      // TODO: connect to API once endpoint is available (PATCH /admin/support/tickets/:id)
      await new Promise((r) => setTimeout(r, 400));
      if (!mountedRef.current) return;
      setTicket((prev) => prev ? { ...prev, status: 'resolved' } : prev);
      toastSuccess(t('resolve_success'));
    } finally {
      if (mountedRef.current) setActionBusy(false);
    }
  }

  async function handleReopen() {
    setActionBusy(true);
    try {
      // TODO: connect to API once endpoint is available (PATCH /admin/support/tickets/:id)
      await new Promise((r) => setTimeout(r, 400));
      if (!mountedRef.current) return;
      setTicket((prev) => prev ? { ...prev, status: 'open' } : prev);
      toastSuccess(t('reopen_success'));
    } finally {
      if (mountedRef.current) setActionBusy(false);
    }
  }

  async function handleClose(reason: string) {
    setActionBusy(true);
    try {
      // TODO: connect to API once endpoint is available (PATCH /admin/support/tickets/:id)
      await new Promise((r) => setTimeout(r, 500));
      if (!mountedRef.current) return;
      setTicket((prev) => prev ? { ...prev, status: 'closed', close_reason: reason } : prev);
      setShowCloseModal(false);
      toastSuccess(t('close_success'));
    } finally {
      if (mountedRef.current) setActionBusy(false);
    }
  }

  return (
    <>
      <CloseModal
        open={showCloseModal}
        onConfirm={handleClose}
        onCancel={() => setShowCloseModal(false)}
        busy={actionBusy}
      />

      <div className="flex min-h-full flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 pb-5 pt-5 dark:border-[#1A2A14] dark:bg-[#0C1209]">
          <Link href="/admin/support" className="mb-4 flex w-fit items-center gap-1.5 text-[12px] font-semibold text-[#888] transition-colors hover:text-[#C49A1E] dark:text-[#6A6A5A]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
            {t('btn_back')}
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[18px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{ticket.subject}</h1>
                <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ROLE_COLOR[ticket.role] ?? 'bg-[#F0EDE0] text-[#888]'}`}>
                  {t(ticket.role === 'client' ? 'role_client' : 'role_station')}
                </span>
              </div>
              <p className="mt-1.5 text-[12px] text-[#888] dark:text-[#6A6A5A]">
                {t('detail_from')} <span className="font-semibold text-[#444] dark:text-[#AAA]">{ticket.created_by}</span>
                <span className="mx-2 text-[#CCC] dark:text-[#3A3A2A]" aria-hidden="true">·</span>
                {t('detail_assigned')}: <span className="font-semibold text-[#444] dark:text-[#AAA]">{ticket.assigned_to ?? t('detail_unassigned')}</span>
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {!ticket.assigned_to && !isClosed && (
                <button type="button" onClick={handleAssignMe} disabled={actionBusy}
                  className="rounded-[10px] border border-[#C49A1E]/40 px-3 py-2 text-[12px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/8 disabled:opacity-50">
                  {t('detail_assign_me')}
                </button>
              )}
              {!isResolved && !isClosed && (
                <button type="button" onClick={handleResolve} disabled={actionBusy}
                  className="rounded-[10px] border border-green-200 px-3 py-2 text-[12px] font-bold text-green-700 transition-colors hover:bg-green-50 disabled:opacity-50 dark:border-green-900/40 dark:text-green-400 dark:hover:bg-green-950/30">
                  {t('btn_resolve')}
                </button>
              )}
              {(isResolved || ticket.status === 'in_progress') && (
                <button type="button" onClick={() => setShowCloseModal(true)} disabled={actionBusy}
                  className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-[12px] font-bold text-[#64748B] transition-colors hover:bg-[#F8FAFC] disabled:opacity-50 dark:border-[#2A3828] dark:text-[#94A3B8]">
                  {t('btn_close_ticket')}
                </button>
              )}
              {isClosed && (
                <button type="button" onClick={handleReopen} disabled={actionBusy}
                  className="rounded-[10px] border border-[#F97316]/40 px-3 py-2 text-[12px] font-bold text-[#C2410C] transition-colors hover:bg-[#FFF4EC] disabled:opacity-50 dark:border-[#F97316]/20 dark:text-[#F97316]">
                  {t('btn_reopen')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Thread + reply */}
        <div className="flex-1 overflow-y-auto bg-[#F5F5EE] p-6 dark:bg-[#0C1209]">
          <div className="mx-auto flex max-w-2xl flex-col gap-5">

            {/* Thread */}
            <div className="flex flex-col gap-3">
              <h2 className="text-[11px] font-black uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">{t('section_thread')}</h2>
              {ticket.messages.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <p className="text-[13px] text-[#AAAAAA] dark:text-[#4A4A3A]">{t('empty_thread')}</p>
                </div>
              ) : (
                ticket.messages.map((msg) => {
                  const isAdmin = msg.role === 'admin';
                  return (
                    <div key={msg.id} className={`flex gap-3 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                      <div className={[
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black leading-none',
                        isAdmin ? 'bg-[#C49A1E] text-[#0C1209]' : 'bg-[#E8E4DC] text-[#666] dark:bg-[#1E2E18] dark:text-[#8A8A7A]',
                      ].join(' ')}>
                        {nameInitials(msg.author)}
                      </div>
                      <div className={[
                        'max-w-[78%] rounded-2xl px-4 py-3',
                        isAdmin
                          ? 'rounded-tr-sm bg-[#C49A1E]/10 dark:bg-[#C49A1E]/8'
                          : 'rounded-tl-sm bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.04]',
                      ].join(' ')}>
                        <p className={`mb-1 text-[11px] font-black tracking-wide ${isAdmin ? 'text-[#C49A1E]/90' : 'text-[#888] dark:text-[#6A6A5A]'}`}>
                          {msg.author}
                        </p>
                        <p className="text-[13px] leading-relaxed text-[#1A1A0A] dark:text-[#F0EDD4]">{msg.body}</p>
                        <p className="mt-1.5 text-[10px] text-[#BBBBAA] dark:text-[#4A4A3A]">{formatDateTime(msg.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply form — only shown for open/in_progress tickets.
                Resolved and closed tickets no longer accept new replies:
                resolved = admin confirmed the issue is fixed; closed = ticket archived. */}
            {!isClosed && !isResolved && (
              <div className="rounded-2xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE4] px-5 py-3 dark:border-[#1A2A14]">
                  <label htmlFor="admin-reply-field" className="text-[12px] font-bold text-[#5A5A4A] dark:text-[#9A9A8A]">{t('field_reply')}</label>
                </div>
                <form onSubmit={handleSendReply} className="flex flex-col gap-3 p-5">
                  <textarea id="admin-reply-field" rows={4} maxLength={2000}
                    className="w-full resize-none rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]"
                    placeholder={t('field_reply_placeholder')}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{reply.length}/2000</span>
                    <button type="submit" disabled={replySaving || !reply.trim()}
                      className="rounded-[10px] bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50">
                      {replySaving ? t('btn_sending') : t('btn_send_reply')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Resolved notice */}
            {isResolved && (
              <div className="flex items-center justify-center rounded-2xl border border-[#E8E4DC] bg-white px-5 py-4 shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
                <p className="text-[12px] text-[#AAAAAA] dark:text-[#4A4A3A]">{t('status_resolved_notice')}</p>
              </div>
            )}

            {/* Closed notice */}
            {isClosed && (
              <div className="flex items-center justify-center rounded-2xl border border-[#E8E4DC] bg-white px-5 py-4 shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
                <p className="text-[12px] text-[#AAAAAA] dark:text-[#4A4A3A]">{t('close_success')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

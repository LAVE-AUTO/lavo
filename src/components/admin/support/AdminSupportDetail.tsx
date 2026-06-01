'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import { getFromApi, postWithApi, patchWithApi } from '@/services/axios-service';
import { Modal } from '@/components/ui/Modal';
import type { ApiTicketDetail, ApiMessage, DisplayStatus } from '@/types/support';
import { STATUS_MAP, userDisplayName } from '@/types/support';

const STATUS_STYLE: Record<DisplayStatus, { badge: string; dot: string; label: string }> = {
  open:        { badge: 'bg-[#FFF4EC] text-[#C2410C] ring-1 ring-[#F97316]/20', dot: 'bg-[#F97316]', label: 'status_open' },
  in_progress: { badge: 'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#1E40AF]/20', dot: 'bg-[#1E40AF]', label: 'status_in_progress' },
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

/* ---- Close confirmation modal ---- */
interface CloseModalProps { open: boolean; onConfirm: () => void; onCancel: () => void; busy: boolean }

function CloseModal({ open, onConfirm, onCancel, busy }: CloseModalProps) {
  const t = useTranslations('admin_support');

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t('close_modal_title')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy}
            className="rounded-[10px] border border-[#FFF9EC] px-4 py-2 text-[13px] font-semibold text-foreground/65 transition-colors hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-dark-surface dark:text-[#B0BFB1]">
            {t('close_modal_cancel')}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className="rounded-[10px] bg-[#94A3B8] px-5 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-50">
            {t('close_modal_confirm')}
          </button>
        </div>
      }
    >
      <p className="text-[13px] text-[#5A5A4A] dark:text-[#B0BFB1]">{t('close_modal_reason_placeholder')}</p>
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

  const [ticket, setTicket]           = useState<ApiTicketDetail | undefined>();
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState(false);
  const [reply, setReply]             = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [actionBusy, setActionBusy]   = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setFetchError(false);
    getFromApi<{ data: ApiTicketDetail }>(`/support/${id}`).then(([ok, res]) => {
      if (!mounted) return;
      if (ok && res && typeof res === 'object' && 'data' in res) {
        setTicket((res as { data: ApiTicketDetail }).data);
      } else {
        setFetchError(true);
      }
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#DDAF3B] border-t-transparent" />
      </div>
    );
  }

  if (fetchError || !ticket) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-[13px] text-[#999]">{fetchError ? t('load_error') : t('not_found')}</p>
      </div>
    );
  }

  const isClosed    = ticket.status === 'ferme';
  const isResolved  = ticket.status === 'resolu';
  const s           = STATUS_STYLE[STATUS_MAP[ticket.status]];
  const adminName   = ticket.assignedToAdmin ? userDisplayName(ticket.assignedToAdmin) : 'Admin';
  const creatorName = userDisplayName(ticket.createdByUser);
  const assignedDisplayName = ticket.assignedToAdmin ? userDisplayName(ticket.assignedToAdmin) : null;

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) { toastError(t('error_reply_empty')); return; }
    setReplySaving(true);
    try {
      const [ok, res] = await postWithApi<{ data: ApiMessage }>(
        `/support/${id}/messages`,
        { content: reply.trim() },
      );
      if (!mountedRef.current) return;
      if (ok && res && typeof res === 'object' && 'data' in res) {
        const newMsg = (res as { data: ApiMessage }).data;
        setTicket((prev) => prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev);
        setReply('');
        toastSuccess(t('reply_success'));
      } else {
        toastError(t('reply_error'));
      }
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
        setTicket((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            assigned_to: user.id,
            assignedToAdmin: {
              id: user.id,
              first_name: user.first_name ?? null,
              last_name: user.last_name ?? null,
              email: user.email ?? '',
              role: 'admin',
            },
          };
        });
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
      const [ok] = await patchWithApi(`/support/${id}`, { status: 'resolu' });
      if (!mountedRef.current) return;
      if (ok) {
        setTicket((prev) => prev ? { ...prev, status: 'resolu' } : prev);
        toastSuccess(t('resolve_success'));
      } else {
        toastError(t('action_error'));
      }
    } catch {
      if (mountedRef.current) toastError(t('action_error'));
    } finally {
      if (mountedRef.current) setActionBusy(false);
    }
  }

  async function handleReopen() {
    setActionBusy(true);
    try {
      const [ok] = await patchWithApi(`/support/${id}`, { status: 'ouvert' });
      if (!mountedRef.current) return;
      if (ok) {
        setTicket((prev) => prev ? { ...prev, status: 'ouvert' } : prev);
        toastSuccess(t('reopen_success'));
      } else {
        toastError(t('action_error'));
      }
    } catch {
      if (mountedRef.current) toastError(t('action_error'));
    } finally {
      if (mountedRef.current) setActionBusy(false);
    }
  }

  async function handleClose() {
    setActionBusy(true);
    try {
      const [ok] = await patchWithApi(`/support/${id}`, { status: 'ferme' });
      if (!mountedRef.current) return;
      if (ok) {
        setTicket((prev) => prev ? { ...prev, status: 'ferme' } : prev);
        setShowCloseModal(false);
        toastSuccess(t('close_success'));
      } else {
        toastError(t('action_error'));
      }
    } catch {
      if (mountedRef.current) toastError(t('action_error'));
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
        <div className="shrink-0 border-b border-separator bg-transparent px-6 pb-5 pt-5 dark:border-[#1A2A14] dark:bg-dark-bg">
          <Link href="/admin/support" className="mb-4 flex w-fit items-center gap-1.5 text-[13px] font-semibold text-foreground/55 transition-colors hover:text-[#DDAF3B] dark:text-[#B0BFB1]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
            {t('btn_back')}
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[18px] font-black text-[#001201] dark:text-[#FFF9EC]">{ticket.subject}</h1>
                <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${s.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${ROLE_COLOR[ticket.createdByUser.role] ?? 'bg-[#F0EDE0] text-foreground/55'}`}>
                  {t(ticket.createdByUser.role === 'client' ? 'role_client' : 'role_station')}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] text-foreground/55 dark:text-[#B0BFB1]">
                {t('detail_from')} <span className="font-semibold text-[#444] dark:text-[#AAA]">{creatorName}</span>
                <span className="mx-2 text-[#CCC] dark:text-[#B0BFB1]" aria-hidden="true">·</span>
                {t('detail_assigned')}: <span className="font-semibold text-[#444] dark:text-[#AAA]">{assignedDisplayName ?? t('detail_unassigned')}</span>
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {!isClosed && (
                <button type="button" onClick={handleAssignMe} disabled={actionBusy}
                  className="rounded-[10px] border border-[#DDAF3B]/40 px-3 py-2 text-[13px] font-semibold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/8 disabled:opacity-50">
                  {assignedDisplayName ? t('detail_reassign_me') : t('detail_assign_me')}
                </button>
              )}
              {!isResolved && !isClosed && (
                <button type="button" onClick={handleResolve} disabled={actionBusy}
                  className="rounded-[10px] border border-green-200 px-3 py-2 text-[13px] font-bold text-green-700 transition-colors hover:bg-green-50 disabled:opacity-50 dark:border-green-900/40 dark:text-green-400 dark:hover:bg-green-950/30">
                  {t('btn_resolve')}
                </button>
              )}
              {(isResolved || ticket.status === 'en_cours') && (
                <button type="button" onClick={() => setShowCloseModal(true)} disabled={actionBusy}
                  className="rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-[13px] font-bold text-[#64748B] transition-colors hover:bg-[#F8FAFC] disabled:opacity-50 dark:border-[#2A3828] dark:text-[#94A3B8]">
                  {t('btn_close_ticket')}
                </button>
              )}
              {isClosed && (
                <button type="button" onClick={handleReopen} disabled={actionBusy}
                  className="rounded-[10px] border border-[#F97316]/40 px-3 py-2 text-[13px] font-bold text-[#C2410C] transition-colors hover:bg-[#FFF4EC] disabled:opacity-50 dark:border-[#F97316]/20 dark:text-[#F97316]">
                  {t('btn_reopen')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Thread + reply */}
        <div className="flex-1 overflow-y-auto bg-[#FFF9EC] p-6 dark:bg-dark-bg">
          <div className="mx-auto flex max-w-2xl flex-col gap-5">

            {/* Thread */}
            <div className="flex flex-col gap-3">
              <h2 className="text-[12px] font-black uppercase tracking-wider text-[#AAAAAA] dark:text-[#B0BFB1]">{t('section_thread')}</h2>
              {ticket.messages.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <p className="text-[13px] text-[#AAAAAA] dark:text-[#B0BFB1]">{t('empty_thread')}</p>
                </div>
              ) : (
                ticket.messages.map((msg) => {
                  const isAdmin    = msg.is_from_admin;
                  const authorName = isAdmin ? adminName : creatorName;
                  return (
                    <div key={msg.id} className={`flex gap-3 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                      <div className={[
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-black leading-none',
                        isAdmin ? 'bg-[#DDAF3B] text-[#001201]' : 'bg-[#FFF9EC] text-foreground/65 dark:bg-[#1E2E18] dark:text-[#B0BFB1]',
                      ].join(' ')}>
                        {nameInitials(authorName)}
                      </div>
                      <div className={[
                        'max-w-[78%] rounded-2xl px-4 py-3',
                        isAdmin
                          ? 'rounded-tr-sm bg-[#DDAF3B]/10 dark:bg-[#DDAF3B]/8'
                          : 'rounded-tl-sm bg-white shadow-sm ring-1 ring-black/4 dark:bg-[#001A05] dark:ring-white/4',
                      ].join(' ')}>
                        <p className={`mb-1 text-[12px] font-black tracking-wide ${isAdmin ? 'text-[#DDAF3B]/90' : 'text-foreground/55 dark:text-[#B0BFB1]'}`}>
                          {authorName}
                        </p>
                        <p className="text-[13px] leading-relaxed text-[#001201] dark:text-[#FFF9EC]">{msg.content}</p>
                        <p className="mt-1.5 text-[11px] text-[#BBBBAA] dark:text-[#B0BFB1]">{formatDateTime(typeof msg.created_at === 'string' ? msg.created_at : new Date(msg.created_at).toISOString())}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply form - only shown for open/in_progress tickets */}
            {!isClosed && !isResolved && (
              <div className="rounded-2xl border border-separator/25 bg-card-surface shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE4] px-5 py-3 dark:border-[#1A2A14]">
                  <label htmlFor="admin-reply-field" className="text-[13px] font-bold text-[#5A5A4A] dark:text-[#B0BFB1]">{t('field_reply')}</label>
                </div>
                <form onSubmit={handleSendReply} className="flex flex-col gap-3 p-5">
                  <textarea id="admin-reply-field" rows={4} maxLength={2000}
                    className="w-full resize-none rounded-lg border border-[#D8D4C8] bg-[#FFF9EC] px-3 py-2.5 text-[13px] text-[#001201] outline-none placeholder:text-[#BBBBAA] focus:border-[#DDAF3B] focus:bg-white focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.12)] dark:border-dark-surface dark:bg-dark-bg dark:text-[#FFF9EC] dark:focus:border-[#DDAF3B]"
                    placeholder={t('field_reply_placeholder')}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#BBBBAA] dark:text-[#B0BFB1]">{reply.length}/2000</span>
                    <button type="submit" disabled={replySaving || !reply.trim()}
                      className="rounded-[10px] bg-[#DDAF3B] px-6 py-2.5 text-[13px] font-bold text-[#001201] transition-opacity hover:opacity-80 disabled:opacity-50">
                      {replySaving ? t('btn_sending') : t('btn_send_reply')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Resolved notice */}
            {isResolved && (
              <div className="flex items-center justify-center rounded-2xl border border-separator/25 bg-card-surface px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:border-[#1E2E18] dark:bg-[#131E10]">
                <p className="text-[13px] text-[#AAAAAA] dark:text-[#B0BFB1]">{t('status_resolved_notice')}</p>
              </div>
            )}

            {/* Closed notice */}
            {isClosed && (
              <div className="flex items-center justify-center rounded-2xl border border-separator/25 bg-card-surface px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:border-[#1E2E18] dark:bg-[#131E10]">
                <p className="text-[13px] text-[#AAAAAA] dark:text-[#B0BFB1]">{t('close_success')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

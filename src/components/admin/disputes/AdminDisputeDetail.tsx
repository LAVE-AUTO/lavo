'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useToast } from '@/context/toast-context';
import { getFromApi, postWithApi } from '@/services/axios-service';
import { formatMoneyPrefix } from '@/helpers/money';
import type { DisputeDetail, DisputeStatus } from './dispute-types';
import { clientDisplayName, parseAmount } from './dispute-types';
import { AdminDisputeActionModal, type ModalMode } from './AdminDisputeActionModal';

const STATUS_STYLE: Record<DisputeStatus, { bar: string; badge: string; dot: string; label: string }> = {
  open:     { bar: 'bg-[#F97316]', badge: 'bg-[#FFF4EC] text-[#C2410C] ring-1 ring-[#F97316]/20', dot: 'bg-[#F97316]', label: 'status_open' },
  refunded: { bar: 'bg-[#22C55E]', badge: 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20', dot: 'bg-[#22C55E]', label: 'status_refunded' },
  resolved: { bar: 'bg-[#94A3B8]', badge: 'bg-[#F8FAFC] text-[#64748B] ring-1 ring-[#CBD5E1]/60', dot: 'bg-[#94A3B8]', label: 'status_resolved' },
  rejected: { bar: 'bg-[#94A3B8]', badge: 'bg-[#F8FAFC] text-[#64748B] ring-1 ring-[#CBD5E1]/60', dot: 'bg-[#94A3B8]', label: 'status_rejected' },
};

type TimelineActor = 'client' | 'station' | 'admin';

const ACTOR_STYLE: Record<TimelineActor, { bg: string; text: string; label: string; dot: string }> = {
  client:  { bg: 'bg-[#EFF6FF] dark:bg-[#0A1A2E]', text: 'text-[#1D4ED8] dark:text-[#93C5FD]', label: 'timeline_by_client',  dot: 'bg-[#1E40AF]' },
  station: { bg: 'bg-[#FFF4EC] dark:bg-[#2A1408]', text: 'text-[#C2410C] dark:text-[#FDBA74]', label: 'timeline_by_station', dot: 'bg-[#F97316]' },
  admin:   { bg: 'bg-[#DDAF3B]/10 dark:bg-[#2A2008]', text: 'text-[#7A5E0A] dark:text-[#DDAF3B]', label: 'timeline_by_admin',   dot: 'bg-[#DDAF3B]' },
};

interface TimelineEvent {
  id: string;
  date: string;
  label: string;
  by: TimelineActor;
}

function formatDate(d: string, short = false) {
  try {
    const opts: Intl.DateTimeFormatOptions = short
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(d).toLocaleDateString('fr-CA', opts);
  } catch { return d; }
}

function formatAmount(n: number) {
  return formatMoneyPrefix(n);
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
}

interface Props { id: string }

export function AdminDisputeDetail({ id }: Props) {
  const t = useTranslations('admin_disputes');
  const { success: toastSuccess, error: toastError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [modal, setModal]     = useState<ModalMode | null>(null);
  const [busy, setBusy]       = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFetchError(false);
    getFromApi(`/admin/disputes/${id}`)
      .then(([ok, data]) => {
        if (!active) return;
        if (ok) {
          const detail = (data as { data: DisputeDetail })?.data ?? null;
          setDispute(detail);
        } else {
          setFetchError(true);
        }
      })
      .catch(() => { if (active) setFetchError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const timeline: TimelineEvent[] = useMemo(() => {
    if (!dispute) return [];
    const events: TimelineEvent[] = [];

    const reservation = dispute.reservation;
    if (reservation) {
      events.push({
        id: 'reservation_created',
        date: reservation.created_at,
        label: t('event_reservation_created'),
        by: 'client',
      });
      if (reservation.completed_at) {
        events.push({
          id: 'service_completed',
          date: reservation.completed_at,
          label: t('event_service_completed'),
          by: 'station',
        });
      }
    }

    events.push({
      id: 'dispute_opened',
      date: dispute.created_at,
      label: t('event_dispute_opened'),
      by: 'client',
    });

    if (dispute.status === 'refunded' && dispute.refunded_amount) {
      events.push({
        id: 'dispute_refunded',
        date: dispute.updated_at,
        label: t('event_refund', { amount: formatAmount(parseAmount(dispute.refunded_amount)) }),
        by: 'admin',
      });
    } else if (dispute.status === 'resolved') {
      events.push({
        id: 'dispute_resolved',
        date: dispute.updated_at,
        label: dispute.closed_reason ? t('event_resolved_reason', { reason: dispute.closed_reason }) : t('event_resolved'),
        by: 'admin',
      });
    } else if (dispute.status === 'rejected') {
      events.push({
        id: 'dispute_rejected',
        date: dispute.updated_at,
        label: dispute.closed_reason ? t('event_rejected_reason', { reason: dispute.closed_reason }) : t('event_rejected'),
        by: 'admin',
      });
    }

    return events;
  }, [dispute, t]);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
    </div>
  );

  if (fetchError || !dispute) return (
    <div className="flex flex-col items-center gap-4 py-32">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#FFF9EC] dark:bg-[#131E10] dark:ring-[#1E2E18]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      </div>
      <p className="text-[14px] font-semibold text-foreground/65 dark:text-[#B0BFB1]">{fetchError ? t('fetch_error') : t('not_found')}</p>
      <Link href="/admin/disputes" className="rounded-xl bg-[#DDAF3B] px-4 py-2 text-[13px] font-bold text-[#001201] transition-colors hover:bg-[#B08A14]">
        {t('back_link')}
      </Link>
    </div>
  );

  const s          = STATUS_STYLE[dispute.status];
  const isResolved = dispute.status !== 'open';
  const amountPaid = parseAmount(dispute.reservation?.amount_paid ?? dispute.requested_amount);
  const refunded   = parseAmount(dispute.refunded_amount);
  const clientName = clientDisplayName(dispute.client);
  const clientContactPhone = dispute.client?.phone ?? null;
  const clientContactEmail = dispute.client?.email ?? null;
  const stationName  = dispute.station?.name ?? '—';
  const stationCity  = dispute.station?.city ?? '';
  const stationPhone = dispute.station?.contact_phone ?? null;
  const stationEmail = dispute.station?.contact_email ?? null;

  async function handleAction(payload: { amount?: number; reason?: string }) {
    if (!dispute) return;
    setBusy(true);
    try {
      let ok = false;
      if (modal === 'refund_full' || modal === 'refund_partial') {
        const body: Record<string, unknown> = {};
        if (modal === 'refund_partial' && payload.amount) body.amount = payload.amount;
        const [success] = await postWithApi(`/admin/disputes/${dispute.id}/refund`, body);
        ok = success;
      } else if (modal === 'close_dispute') {
        const [success] = await postWithApi(`/admin/disputes/${dispute.id}/close`, {
          status: 'rejected',
          reason: payload.reason ?? '',
        });
        ok = success;
      }

      if (!mountedRef.current) return;

      if (!ok) {
        toastError(t('action_error'));
        setModal(null);
        return;
      }

      const nowIso = new Date().toISOString();
      const next: DisputeDetail = { ...dispute };
      if (modal === 'refund_full') {
        next.status = 'refunded';
        next.refunded_amount = amountPaid.toFixed(2);
      } else if (modal === 'refund_partial') {
        next.status = 'refunded';
        next.refunded_amount = (payload.amount ?? amountPaid).toFixed(2);
      } else if (modal === 'close_dispute') {
        next.status = 'rejected';
        next.closed_reason = payload.reason ?? null;
      }
      next.updated_at = nowIso;
      setDispute(next);

      if (modal === 'refund_full')    toastSuccess(t('toast_refunded'));
      if (modal === 'refund_partial') toastSuccess(t('toast_refunded'));
      if (modal === 'close_dispute')  toastSuccess(t('toast_closed'));
      setModal(null);
    } catch {
      if (mountedRef.current) toastError(t('action_error'));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  return (
    <>
      <AdminDisputeActionModal mode={modal} maxAmount={amountPaid} busy={busy} onConfirm={handleAction} onClose={() => setModal(null)} />

      <div className="flex min-h-full flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-separator bg-transparent px-6 py-4 dark:border-[#1A2A14] dark:bg-dark-bg">
          <Link href="/admin/disputes" className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#AAAAAA] transition-colors hover:text-[#DDAF3B]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
            {t('back_link')}
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[14px] font-black text-white ${s.bar}`}>
                {initials(clientName || stationName)}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-[20px] font-black text-[#001201] dark:text-[#FFF9EC]">{clientName || t('label_unknown_client')}</h1>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold ${s.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-[#999] dark:text-[#B0BFB1]">
                  {stationName}{stationCity ? ` · ${stationCity}` : ''} · {formatDate(dispute.created_at, true)}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[12px] font-bold uppercase tracking-wider text-[#AAAAAA] dark:text-[#B0BFB1]">{t('label_amount_paid')}</p>
              <p className="text-[26px] font-black text-[#001201] dark:text-[#FFF9EC]">{formatAmount(amountPaid)}</p>
              {refunded > 0 && (
                <p className="mt-1 text-[12px] font-semibold text-[#15803D]">{t('label_refunded', { amount: formatAmount(refunded) })}</p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-[#FFF9EC] p-6 dark:bg-dark-bg">
          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">

            {/* Left column */}
            <div className="flex flex-col gap-5">

              {/* Dispute reason highlight */}
              <div className={`flex gap-4 overflow-hidden rounded-2xl border bg-white p-5 shadow-sm dark:bg-[#131E10] ${dispute.status === 'open' ? 'border-[#F97316]/30 dark:border-[#F97316]/20' : 'border-[#FFF9EC] dark:border-[#1E2E18]'}`}>
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${s.bar}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('label_reason')}</p>
                  <p className="text-[14px] leading-relaxed text-[#333] dark:text-[#C0C0B0]">{dispute.reason}</p>
                  {dispute.description && (
                    <p className="mt-2 text-[13px] leading-relaxed text-foreground/65 dark:text-[#B0BFB1]">{dispute.description}</p>
                  )}
                </div>
              </div>

              {/* Reservation card */}
              <div className="overflow-hidden rounded-2xl border border-separator/25 bg-card-surface shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[12px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('section_reservation')}</p>
                </div>
                <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 divide-[#F0EDE6] dark:divide-[#1A2A14]">
                  {[
                    {
                      label: t('label_service_date'),
                      value: dispute.reservation?.service_start
                        ? formatDate(dispute.reservation.service_start)
                        : dispute.reservation?.created_at
                          ? formatDate(dispute.reservation.created_at)
                          : '—',
                      sub: dispute.reservation?.service_end ? `→ ${formatDate(dispute.reservation.service_end, true)}` : null,
                    },
                    {
                      label: t('label_vehicle'),
                      value: dispute.reservation?.vehicle_format_label
                        ?? (dispute.reservation?.entry_type === 'queue' ? t('label_entry_queue') : t('label_vehicle_unknown')),
                      sub: null,
                    },
                    {
                      label: t('label_amount_paid'),
                      value: formatAmount(amountPaid),
                      sub: refunded > 0 ? t('label_refunded', { amount: formatAmount(refunded) }) : null,
                    },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="flex flex-col items-center gap-1 px-5 py-4 text-center">
                      <p className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{label}</p>
                      <p className="text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]">{value}</p>
                      {sub && <p className="text-[11px] text-[#BBBBAA] dark:text-[#B0BFB1]">{sub}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="overflow-hidden rounded-2xl border border-separator/25 bg-card-surface shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[12px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('section_timeline')}</p>
                </div>
                <div className="p-5">
                  {timeline.map((ev, i) => {
                    const a = ACTOR_STYLE[ev.by];
                    return (
                      <div key={ev.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${a.bg} ring-2 ring-white dark:ring-[#131E10]`}>
                            <span className={`h-2.5 w-2.5 rounded-full ${a.dot}`} />
                          </div>
                          {i < timeline.length - 1 && (
                            <div className="my-1 w-px flex-1 bg-[#FFF9EC] dark:bg-[#1E2E18]" />
                          )}
                        </div>
                        <div className={`${i < timeline.length - 1 ? 'pb-5' : ''} min-w-0 pt-1`}>
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className={`rounded-lg px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${a.bg} ${a.text}`}>
                              {t(a.label)}
                            </span>
                            <span className="text-[12px] text-[#BBBBAA] dark:text-[#B0BFB1]">{formatDate(ev.date)}</span>
                          </div>
                          <p className="text-[13px] leading-relaxed text-[#444] dark:text-[#B0BFB1]">{ev.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="flex flex-col gap-4">
              {/* Actions */}
              <div className="overflow-hidden rounded-2xl border border-separator/25 bg-card-surface shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[12px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('section_actions')}</p>
                </div>
                <div className="flex flex-col gap-2.5 p-4">
                  {isResolved ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bar}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      <p className="text-center text-[13px] font-semibold text-[#999] dark:text-[#B0BFB1]">{t('already_resolved')}</p>
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => setModal('refund_full')}
                        className="flex w-full items-center gap-3 rounded-xl bg-[#DDAF3B] px-4 py-3 text-[13px] font-bold text-[#001201] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#B08A14] hover:shadow-md active:translate-y-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg>
                        </div>
                        {t('btn_refund_full')}
                      </button>
                      <button type="button" onClick={() => setModal('refund_partial')}
                        className="flex w-full items-center gap-3 rounded-xl border border-[#1E40AF]/30 bg-[#EFF6FF] px-4 py-3 text-[13px] font-bold text-[#1D4ED8] transition-all hover:-translate-y-0.5 hover:bg-[#DBEAFE] hover:shadow-sm active:translate-y-0 dark:border-[#1E40AF]/30 dark:bg-[#0A1A2E] dark:text-[#93C5FD] dark:hover:bg-[#0F2040]">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1E40AF]/15 dark:bg-[#1E40AF]/20">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                        </div>
                        {t('btn_refund_partial')}
                      </button>
                      <div className="h-px bg-[#F0EDE6] dark:bg-[#1A2A14]" />
                      <button type="button" onClick={() => setModal('close_dispute')}
                        className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-600 transition-all hover:-translate-y-0.5 hover:bg-red-100 hover:shadow-sm active:translate-y-0 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/60">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                        {t('btn_close_dispute')}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Client card */}
              <div className="overflow-hidden rounded-2xl border border-separator/25 bg-card-surface shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[12px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('label_client')}</p>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-black text-white ${s.bar}`}>
                      {initials(clientName)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{clientName || t('label_unknown_client')}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {clientContactPhone && (
                      <a href={`tel:${clientContactPhone}`}
                        className="flex items-center gap-2 rounded-xl bg-[#FFF9EC] px-3 py-2 text-[12px] font-semibold text-[#444] transition-colors hover:bg-[#EDEAE0] dark:bg-[#0E1A0C] dark:text-[#C0C0B0] dark:hover:bg-[#152010]">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.03 2.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.72 6.72l1.28-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                        <span className="truncate">{clientContactPhone}</span>
                      </a>
                    )}
                    {clientContactEmail && (
                      <a href={`mailto:${clientContactEmail}`}
                        className="flex items-center gap-2 rounded-xl bg-[#FFF9EC] px-3 py-2 text-[12px] font-semibold text-[#444] transition-colors hover:bg-[#EDEAE0] dark:bg-[#0E1A0C] dark:text-[#C0C0B0] dark:hover:bg-[#152010]">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                        <span className="truncate">{clientContactEmail}</span>
                      </a>
                    )}
                    {!clientContactPhone && !clientContactEmail && (
                      <p className="text-[12px] text-[#BBBBAA] dark:text-[#B0BFB1]">{t('no_contact')}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Station card */}
              <div className="overflow-hidden rounded-2xl border border-separator/25 bg-card-surface shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[12px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#B0BFB1]">{t('label_station')}</p>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0EDE6] dark:bg-[#1A2A14]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{stationName}</p>
                      <p className="truncate text-[12px] text-[#BBBBAA] dark:text-[#B0BFB1]">{stationCity}</p>
                    </div>
                  </div>
                  {(stationPhone || stationEmail) && (
                    <div className="mt-3 flex flex-col gap-1.5">
                      {stationPhone && (
                        <a href={`tel:${stationPhone}`}
                          className="flex items-center gap-2 rounded-xl bg-[#FFF9EC] px-3 py-2 text-[12px] font-semibold text-[#444] transition-colors hover:bg-[#EDEAE0] dark:bg-[#0E1A0C] dark:text-[#C0C0B0] dark:hover:bg-[#152010]">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.03 2.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.72 6.72l1.28-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                          <span className="truncate">{stationPhone}</span>
                        </a>
                      )}
                      {stationEmail && (
                        <a href={`mailto:${stationEmail}`}
                          className="flex items-center gap-2 rounded-xl bg-[#FFF9EC] px-3 py-2 text-[12px] font-semibold text-[#444] transition-colors hover:bg-[#EDEAE0] dark:bg-[#0E1A0C] dark:text-[#C0C0B0] dark:hover:bg-[#152010]">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                          <span className="truncate">{stationEmail}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

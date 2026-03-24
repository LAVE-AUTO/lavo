'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useToast } from '@/context/toast-context';
import { MOCK_DISPUTES, type DisputeRow, type DisputeStatus, type TimelineActor } from './disputes-mock';
import { AdminDisputeActionModal, type ModalMode } from './AdminDisputeActionModal';

const STATUS_STYLE: Record<DisputeStatus, { bar: string; badge: string; dot: string; label: string }> = {
  open:             { bar: 'bg-[#F97316]', badge: 'bg-[#FFF4EC] text-[#C2410C] ring-1 ring-[#F97316]/20', dot: 'bg-[#F97316]', label: 'status_open'             },
  refunded_full:    { bar: 'bg-[#22C55E]', badge: 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20', dot: 'bg-[#22C55E]', label: 'status_refunded_full'    },
  refunded_partial: { bar: 'bg-[#3B82F6]', badge: 'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#3B82F6]/20', dot: 'bg-[#3B82F6]', label: 'status_refunded_partial' },
  closed:           { bar: 'bg-[#94A3B8]', badge: 'bg-[#F8FAFC] text-[#64748B] ring-1 ring-[#CBD5E1]/60',  dot: 'bg-[#94A3B8]', label: 'status_closed'           },
};

const ACTOR_STYLE: Record<TimelineActor, { bg: string; text: string; label: string; dot: string }> = {
  client:  { bg: 'bg-[#EFF6FF] dark:bg-[#0A1A2E]', text: 'text-[#1D4ED8] dark:text-[#93C5FD]', label: 'timeline_by_client',  dot: 'bg-[#3B82F6]' },
  station: { bg: 'bg-[#FFF4EC] dark:bg-[#2A1408]', text: 'text-[#C2410C] dark:text-[#FDBA74]', label: 'timeline_by_station', dot: 'bg-[#F97316]' },
  admin:   { bg: 'bg-[#C49A1E]/10 dark:bg-[#2A2008]', text: 'text-[#7A5E0A] dark:text-[#C49A1E]', label: 'timeline_by_admin',   dot: 'bg-[#C49A1E]' },
};

function formatDate(d: string, short = false) {
  try {
    const opts: Intl.DateTimeFormatOptions = short
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(d).toLocaleDateString('fr-CA', opts);
  } catch { return d; }
}
function formatAmount(n: number) {
  return n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
}
function initials(name: string) {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

interface Props { id: string }

export function AdminDisputeDetail({ id }: Props) {
  const t = useTranslations('admin_disputes');
  const { success: toastSuccess } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // TODO: replace with getFromApi('/admin/disputes/:id') once endpoint is available
  const [dispute, setDispute] = useState<DisputeRow | undefined>(() => MOCK_DISPUTES.find((d) => d.id === id));
  const [modal, setModal]     = useState<ModalMode | null>(null);
  const [busy, setBusy]       = useState(false);

  if (!dispute) return (
    <div className="flex flex-col items-center gap-4 py-32">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E4DC] dark:bg-[#131E10] dark:ring-[#1E2E18]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      </div>
      <p className="text-[14px] font-semibold text-[#666] dark:text-[#9A9A8A]">Litige introuvable.</p>
      <Link href="/admin/disputes" className="rounded-xl bg-[#C49A1E] px-4 py-2 text-[12px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14]">
        {t('back_link')}
      </Link>
    </div>
  );

  const s          = STATUS_STYLE[dispute.status];
  const isResolved = dispute.status !== 'open';

  async function handleAction(payload: { amount?: number; reason?: string }) {
    setBusy(true);
    try {
      // TODO: connect to API once endpoint is available (POST /admin/disputes/:id/refund or /close)
      await new Promise((r) => setTimeout(r, 700));
      if (!mountedRef.current) return;

      let newStatus: DisputeStatus = dispute.status;
      let eventLabel = '';
      if (modal === 'refund_full')    { newStatus = 'refunded_full';    eventLabel = `Remboursement total de ${formatAmount(dispute.reservation.amount_paid)} effectué.`; }
      if (modal === 'refund_partial') { newStatus = 'refunded_partial'; eventLabel = `Remboursement partiel de ${formatAmount(payload.amount!)} effectué.`; }
      if (modal === 'close_dispute')  { newStatus = 'closed';           eventLabel = `Litige clôturé : ${payload.reason}`; }

      setDispute((prev) => prev ? {
        ...prev, status: newStatus,
        events: [...prev.events, { id: `e${Date.now()}`, date: new Date().toISOString(), label: eventLabel, by: 'admin' }],
      } : prev);

      if (modal === 'refund_full')    toastSuccess(t('toast_refunded_full'));
      if (modal === 'refund_partial') toastSuccess(t('toast_refunded_partial'));
      if (modal === 'close_dispute')  toastSuccess(t('toast_closed'));
    } finally {
      if (mountedRef.current) { setBusy(false); setModal(null); }
    }
  }

  return (
    <>
      <AdminDisputeActionModal mode={modal} maxAmount={dispute.reservation.amount_paid} busy={busy} onConfirm={handleAction} onClose={() => setModal(null)} />

      <div className="flex min-h-full flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 py-4 dark:border-[#1A2A14] dark:bg-[#0C1209]">
          <Link href="/admin/disputes" className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#AAAAAA] transition-colors hover:text-[#C49A1E]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            {t('back_link')}
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[14px] font-black text-white ${s.bar}`}>
                {initials(dispute.client.name)}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-[20px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{dispute.client.name}</h1>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${s.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-[#999] dark:text-[#6A6A5A]">
                  {dispute.station.name} · {dispute.station.city} · {formatDate(dispute.created_at, true)}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">{t('label_amount_paid')}</p>
              <p className="text-[26px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{formatAmount(dispute.reservation.amount_paid)}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-[#F5F5EE] p-6 dark:bg-[#0C1209]">
          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">

            {/* Left column */}
            <div className="flex flex-col gap-5">

              {/* Dispute reason highlight */}
              <div className={`flex gap-4 overflow-hidden rounded-2xl border bg-white p-5 shadow-sm dark:bg-[#131E10] ${dispute.status === 'open' ? 'border-[#F97316]/30 dark:border-[#F97316]/20' : 'border-[#E8E4DC] dark:border-[#1E2E18]'}`}>
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${s.bar}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{t('label_reason')}</p>
                  <p className="text-[14px] leading-relaxed text-[#333] dark:text-[#C0C0B0]">{dispute.reason}</p>
                </div>
              </div>

              {/* Reservation card */}
              <div className="overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{t('section_reservation')}</p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-[#F0EDE6] dark:divide-[#1A2A14]">
                  {[
                    { label: t('label_date'),        value: formatDate(dispute.reservation.date, false).split(' à ')[0] ?? formatDate(dispute.reservation.date) },
                    { label: t('label_vehicle'),     value: dispute.reservation.vehicle_format },
                    { label: t('label_amount_paid'), value: formatAmount(dispute.reservation.amount_paid) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center gap-1 px-5 py-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{label}</p>
                      <p className="text-[15px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{t('section_timeline')}</p>
                </div>
                <div className="p-5">
                  {dispute.events.map((ev, i) => {
                    const a = ACTOR_STYLE[ev.by];
                    return (
                      <div key={ev.id} className="flex gap-4">
                        {/* Timeline spine */}
                        <div className="flex flex-col items-center">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${a.bg} ring-2 ring-white dark:ring-[#131E10]`}>
                            <span className={`h-2.5 w-2.5 rounded-full ${a.dot}`} />
                          </div>
                          {i < dispute.events.length - 1 && (
                            <div className="my-1 w-px flex-1 bg-[#E8E4DC] dark:bg-[#1E2E18]" />
                          )}
                        </div>
                        {/* Event content */}
                        <div className={`${i < dispute.events.length - 1 ? 'pb-5' : ''} min-w-0 pt-1`}>
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${a.bg} ${a.text}`}>
                              {t(a.label)}
                            </span>
                            <span className="text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{formatDate(ev.date)}</span>
                          </div>
                          <p className="text-[13px] leading-relaxed text-[#444] dark:text-[#9A9A8A]">{ev.label}</p>
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
              <div className="overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{t('section_actions')}</p>
                </div>
                <div className="flex flex-col gap-2.5 p-4">
                  {isResolved ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bar}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      <p className="text-center text-[12px] font-semibold text-[#999] dark:text-[#5A5A4A]">{t('already_resolved')}</p>
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => setModal('refund_full')}
                        className="flex w-full items-center gap-3 rounded-xl bg-[#C49A1E] px-4 py-3 text-[13px] font-bold text-[#0C1209] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#B08A14] hover:shadow-md active:translate-y-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg>
                        </div>
                        {t('btn_refund_full')}
                      </button>
                      <button type="button" onClick={() => setModal('refund_partial')}
                        className="flex w-full items-center gap-3 rounded-xl border border-[#3B82F6]/30 bg-[#EFF6FF] px-4 py-3 text-[13px] font-bold text-[#1D4ED8] transition-all hover:-translate-y-0.5 hover:bg-[#DBEAFE] hover:shadow-sm active:translate-y-0 dark:border-[#1E40AF]/30 dark:bg-[#0A1A2E] dark:text-[#93C5FD] dark:hover:bg-[#0F2040]">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#3B82F6]/15 dark:bg-[#3B82F6]/20">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                        </div>
                        {t('btn_refund_partial')}
                      </button>
                      <div className="h-px bg-[#F0EDE6] dark:bg-[#1A2A14]" />
                      <button type="button" onClick={() => setModal('close_dispute')}
                        className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-600 transition-all hover:-translate-y-0.5 hover:bg-red-100 hover:shadow-sm active:translate-y-0 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/60">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                        {t('btn_close_dispute')}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Client card */}
              <div className="overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{t('label_client')}</p>
                </div>
                <div className="flex items-center gap-3 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-black text-white ${s.bar}`}>
                    {initials(dispute.client.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{dispute.client.name}</p>
                    <p className="truncate text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{dispute.client.email}</p>
                  </div>
                </div>
              </div>

              {/* Station card */}
              <div className="overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">Station</p>
                </div>
                <div className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0EDE6] dark:bg-[#1A2A14]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{dispute.station.name}</p>
                    <p className="truncate text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{dispute.station.city}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

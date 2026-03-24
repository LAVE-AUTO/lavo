'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useToast } from '@/context/toast-context';
import { MOCK_DISPUTES, type DisputeRow, type DisputeStatus, type TimelineActor } from './disputes-mock';
import { AdminDisputeActionModal, type ModalMode } from './AdminDisputeActionModal';

const STATUS_STYLE: Record<DisputeStatus, { badge: string; dot: string; label: string }> = {
  open:             { badge: 'bg-[#FFF7ED] text-[#9A3412] ring-1 ring-[#FDBA74]/40', dot: 'bg-[#F97316]', label: 'status_open'             },
  refunded_full:    { badge: 'bg-[#F0FDF4] text-[#166534] ring-1 ring-[#86EFAC]/40', dot: 'bg-[#22C55E]', label: 'status_refunded_full'    },
  refunded_partial: { badge: 'bg-[#EFF6FF] text-[#1E40AF] ring-1 ring-[#93C5FD]/40', dot: 'bg-[#3B82F6]', label: 'status_refunded_partial' },
  closed:           { badge: 'bg-[#F9FAFB] text-[#6B7280] ring-1 ring-[#D1D5DB]/60', dot: 'bg-[#9CA3AF]', label: 'status_closed'           },
};

const ACTOR_COLOR: Record<TimelineActor, string> = {
  client:  'bg-[#EFF6FF] text-[#1E40AF] dark:bg-[#0A1A2E] dark:text-[#93C5FD]',
  station: 'bg-[#FFF7ED] text-[#9A3412] dark:bg-[#2A1008] dark:text-[#FDBA74]',
  admin:   'bg-[#C49A1E]/10 text-[#7A5E0A] dark:bg-[#2A2008] dark:text-[#C49A1E]',
};

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}
function formatAmount(n: number) {
  return n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
}

interface Props { id: string }

export function AdminDisputeDetail({ id }: Props) {
  const t             = useTranslations('admin_disputes');
  const { success: toastSuccess } = useToast();
  const mountedRef    = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // TODO: replace with getFromApi('/admin/disputes/:id') once endpoint is available
  const [dispute, setDispute] = useState<DisputeRow | undefined>(() => MOCK_DISPUTES.find((d) => d.id === id));
  const [modal, setModal]     = useState<ModalMode | null>(null);
  const [busy, setBusy]       = useState(false);

  if (!dispute) return (
    <div className="flex flex-col items-center gap-4 py-24">
      <p className="text-[13px] text-[#999]">Litige introuvable.</p>
      <Link href="/admin/disputes" className="text-[12px] font-bold text-[#C49A1E] underline underline-offset-2">
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
        ...prev,
        status: newStatus,
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
        {/* Sticky header */}
        <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 py-4 dark:border-[#1A2A14] dark:bg-[#0C1209]">
          <Link href="/admin/disputes" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#999] transition-colors hover:text-[#C49A1E]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            {t('back_link')}
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-[20px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{dispute.client.name}</h1>
              <p className="mt-0.5 text-[12px] text-[#888] dark:text-[#6A6A5A]">{dispute.station.name} · {dispute.station.city}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${s.badge}`}>
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />{t(s.label)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#F5F5EE] p-6 dark:bg-[#0C1209]">
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">

            {/* Left: reservation + timeline */}
            <div className="flex flex-col gap-5">
              {/* Reservation card */}
              <div className="overflow-hidden rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{t('section_reservation')}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
                  {[
                    { label: t('label_date'),        value: formatDate(dispute.reservation.date) },
                    { label: t('label_vehicle'),     value: dispute.reservation.vehicle_format   },
                    { label: t('label_amount_paid'), value: formatAmount(dispute.reservation.amount_paid) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{label}</p>
                      <p className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#F0EDE6] px-5 py-4 dark:border-[#1A2A14]">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{t('label_reason')}</p>
                  <p className="text-[13px] leading-relaxed text-[#555] dark:text-[#9A9A8A]">{dispute.reason}</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="overflow-hidden rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{t('section_timeline')}</p>
                </div>
                <div className="flex flex-col gap-0 p-5">
                  {dispute.events.map((ev, i) => (
                    <div key={ev.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F0EDE6] dark:bg-[#1A2A14]">
                          <span className="h-2 w-2 rounded-full bg-[#C49A1E]" />
                        </div>
                        {i < dispute.events.length - 1 && <div className="w-px flex-1 bg-[#E8E4DC] dark:bg-[#1E2E18] my-1" />}
                      </div>
                      <div className={`${i < dispute.events.length - 1 ? 'pb-4' : ''} min-w-0 pt-1`}>
                        <div className="mb-1 flex items-center gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${ACTOR_COLOR[ev.by]}`}>
                            {({ client: t('timeline_by_client'), station: t('timeline_by_station'), admin: t('timeline_by_admin') } as Record<TimelineActor, string>)[ev.by]}
                          </span>
                          <span className="text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{formatDate(ev.date)}</span>
                        </div>
                        <p className="text-[13px] text-[#444] dark:text-[#9A9A8A]">{ev.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: actions panel */}
            <div className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
                <div className="border-b border-[#F0EDE6] bg-[#F9F8F5] px-5 py-3 dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{t('section_actions')}</p>
                </div>
                <div className="flex flex-col gap-3 p-5">
                  {isResolved ? (
                    <p className="text-center text-[12px] text-[#BBBBAA] dark:text-[#4A4A3A]">{t('already_resolved')}</p>
                  ) : (
                    <>
                      <button type="button" onClick={() => setModal('refund_full')}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C49A1E] px-4 py-2.5 text-[13px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg>
                        {t('btn_refund_full')}
                      </button>
                      <button type="button" onClick={() => setModal('refund_partial')}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#3B82F6]/30 bg-[#EFF6FF] px-4 py-2.5 text-[13px] font-bold text-[#1E40AF] transition-colors hover:bg-[#DBEAFE] dark:border-[#1E40AF]/30 dark:bg-[#0A1A2E] dark:text-[#93C5FD] dark:hover:bg-[#0F2040]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                        {t('btn_refund_partial')}
                      </button>
                      <div className="h-px bg-[#F0EDE6] dark:bg-[#1A2A14]" />
                      <button type="button" onClick={() => setModal('close_dispute')}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D8D4C8] px-4 py-2.5 text-[13px] font-bold text-[#666] transition-colors hover:bg-[#F5F3EE] dark:border-[#243020] dark:text-[#9A9A8A] dark:hover:bg-[#1A2A14]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                        {t('btn_close_dispute')}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Client info mini-card */}
              <div className="rounded-xl border border-[#E8E4DC] bg-white p-4 shadow-sm dark:border-[#1E2E18] dark:bg-[#131E10]">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]">{t('label_client')}</p>
                <p className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{dispute.client.name}</p>
                <p className="mt-0.5 text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{dispute.client.email}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

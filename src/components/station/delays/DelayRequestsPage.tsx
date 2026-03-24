'use client';

/**
 * DelayRequestsPage — STA-2
 * Station interface for accepting or refusing client delay requests.
 * No GET listing endpoint exists yet — using mock data.
 * Accept/refuse actions call real API endpoints.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { postWithApi } from '@/services';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RefuseReasonModal } from './RefuseReasonModal';

// TODO: connect to API once GET /station/delay-requests endpoint is available
const MOCK_DELAY_REQUESTS: DelayRequest[] = [
  {
    id: 'dr-001',
    reservation_id: 'res-aaa111',
    client_name: 'Client #A4F2',
    message: 'Je serai en retard d\'environ 15 minutes, il y a des travaux sur l\'autoroute.',
    requested_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    status: 'pending',
  },
  {
    id: 'dr-002',
    reservation_id: 'res-bbb222',
    client_name: 'Client #C8D1',
    message: 'Retard de 10 min, je suis coincé dans le trafic.',
    requested_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    status: 'pending',
  },
];

export interface DelayRequest {
  id: string;
  reservation_id: string;
  client_name: string;
  message: string;
  requested_at: string;
  status: 'pending';
}

interface PendingAccept { type: 'accept'; request: DelayRequest }
interface PendingRefuse { type: 'refuse'; request: DelayRequest }
type PendingAction = PendingAccept | PendingRefuse;

export function DelayRequestsPage() {
  const t = useTranslations('station_delays');
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [requests, setRequests] = useState<DelayRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    // TODO: replace with getFromApi('/station/delay-requests') once endpoint is available
    await new Promise((r) => setTimeout(r, 300));
    if (!mountedRef.current) return;
    setRequests(MOCK_DELAY_REQUESTS);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function executeAccept() {
    if (!pending || pending.type !== 'accept') return;
    setActionLoading(true);
    setActionError(null);
    const [ok] = await postWithApi(`/reservations/${pending.request.reservation_id}/accept-delay`, {});
    if (!mountedRef.current) return;
    setActionLoading(false);
    if (ok) {
      setRequests((prev) => prev.filter((r) => r.id !== pending.request.id));
      setPending(null);
    } else {
      setActionError(t('error_action'));
    }
  }

  async function executeRefuse(reason: string) {
    if (!pending || pending.type !== 'refuse') return;
    setActionLoading(true);
    setActionError(null);
    const body = reason.trim() ? { refusal_reason: reason.trim().slice(0, 300) } : {};
    const [ok] = await postWithApi(`/reservations/${pending.request.reservation_id}/refuse-delay`, body);
    if (!mountedRef.current) return;
    setActionLoading(false);
    if (ok) {
      setRequests((prev) => prev.filter((r) => r.id !== pending.request.id));
      setPending(null);
    } else {
      setActionError(t('error_action'));
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C09A18] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#EDEDED] dark:bg-[#1A2116]">
      {/* Header */}
      <div className="border-b border-[#CCCCCC] bg-[#E0E0D0] px-6 pb-4 pt-5 dark:border-[#3A4A36] dark:bg-[#243020]">
        <h1 className="text-[20px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('page_title')}</h1>
        <p className="mt-0.5 text-[12px] text-[#000717]/50 dark:text-[#FFFFF0]/50">
          {requests.length > 0 ? t('pending_n', { n: requests.length }) : t('no_pending')}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {requests.length === 0 ? (
          <EmptyState label={t('empty_state')} />
        ) : (
          <div className="flex flex-col gap-3 max-w-2xl">
            {requests.map((req) => (
              <DelayCard
                key={req.id}
                request={req}
                onAccept={() => { setActionError(null); setPending({ type: 'accept', request: req }); }}
                onRefuse={() => { setActionError(null); setPending({ type: 'refuse', request: req }); }}
                acceptLabel={t('btn_accept')}
                refuseLabel={t('btn_refuse')}
                agoLabel={formatAgo(req.requested_at)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Accept confirm dialog */}
      {pending?.type === 'accept' && (
        <ConfirmDialog
          open
          title={t('confirm_accept_title')}
          message={actionError
            ? `${t('confirm_accept_message')}\n\n${actionError}`
            : t('confirm_accept_message')}
          confirmLabel={t('btn_accept')}
          cancelLabel={t('btn_cancel')}
          variant="default"
          loading={actionLoading}
          onConfirm={executeAccept}
          onCancel={() => { setPending(null); setActionError(null); }}
        />
      )}

      {/* Refuse modal with optional reason */}
      {pending?.type === 'refuse' && (
        <RefuseReasonModal
          open
          loading={actionLoading}
          error={actionError}
          onConfirm={executeRefuse}
          onCancel={() => { setPending(null); setActionError(null); }}
        />
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

interface DelayCardProps {
  request: DelayRequest;
  onAccept: () => void;
  onRefuse: () => void;
  acceptLabel: string;
  refuseLabel: string;
  agoLabel: string;
}

function DelayCard({ request, onAccept, onRefuse, acceptLabel, refuseLabel, agoLabel }: DelayCardProps) {
  return (
    <div className="rounded-[12px] border border-[#CCCCCC] bg-white px-5 py-4 dark:border-[#3A4A36] dark:bg-[#1E2A1A]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{request.client_name}</span>
            <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#92400E] dark:bg-[#3A2800] dark:text-[#FCD34D]">
              En attente
            </span>
          </div>
          <p className="mt-1.5 text-[12px] text-[#000717]/70 dark:text-[#FFFFF0]/60 leading-relaxed">
            {request.message}
          </p>
          <span className="mt-2 inline-block text-[10px] text-[#000717]/35 dark:text-[#FFFFF0]/30">{agoLabel}</span>
        </div>
      </div>
      <div className="mt-3.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onAccept}
          className="flex-1 rounded-[8px] bg-[#00C851] py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#00B048]"
        >
          {acceptLabel}
        </button>
        <button
          type="button"
          onClick={onRefuse}
          className="flex-1 rounded-[8px] border border-[#E8472A]/40 py-2 text-[12px] font-bold text-[#E8472A] transition-colors hover:bg-[#E8472A]/10 dark:border-[#E8472A]/40"
        >
          {refuseLabel}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="text-[#000C1F]/15 dark:text-[#FFF8EC]/15" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="9 12 12 15 15 9" />
      </svg>
      <span className="text-[13px] font-semibold text-[#000C1F]/40 dark:text-[#FFF8EC]/30">{label}</span>
    </div>
  );
}

function formatAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'À l\'instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `Il y a ${hours} h`;
}

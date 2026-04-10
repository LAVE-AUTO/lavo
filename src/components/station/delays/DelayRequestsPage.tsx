'use client';

/**
 * DelayRequestsPage — STA-2
 * Station interface: pending delay requests (accept/refuse) + history.
 * No GET listing endpoint exists yet — using mock data.
 * Accept/refuse actions call real API endpoints.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { postWithApi } from '@/services';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RefuseReasonModal } from './RefuseReasonModal';

// TODO: connect to API once GET /station/delay-requests endpoint is available
const MOCK_PENDING: DelayRequest[] = [
  {
    id: 'dr-001',
    reservation_id: 'res-aaa111',
    client_name: 'Client #A4F2',
    message: 'Je serai en retard d\'environ 15 minutes, il y a des travaux sur l\'autoroute.',
    requested_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'dr-002',
    reservation_id: 'res-bbb222',
    client_name: 'Client #C8D1',
    message: 'Retard de 10 min, je suis coincé dans le trafic.',
    requested_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
  },
];

// TODO: connect to API once GET /station/delay-requests?status=resolved endpoint is available
const MOCK_HISTORY: ResolvedRequest[] = [
  {
    id: 'dr-h01',
    reservation_id: 'res-ccc333',
    client_name: 'Client #F7A3',
    message: 'Je serai en retard d\'une vingtaine de minutes, accident sur le périphérique.',
    status: 'accepted',
    resolved_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'dr-h02',
    reservation_id: 'res-ddd444',
    client_name: 'Client #B2E9',
    message: 'Retard d\'environ 30 min, j\'ai eu un imprévu.',
    status: 'refused',
    refusal_reason: 'Le créneau a été attribué à un autre client.',
    resolved_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

export interface DelayRequest {
  id: string;
  reservation_id: string;
  client_name: string;
  message: string;
  requested_at: string;
}

export interface ResolvedRequest {
  id: string;
  reservation_id: string;
  client_name: string;
  message: string;
  status: 'accepted' | 'refused';
  refusal_reason?: string;
  resolved_at: string;
}

type Tab = 'pending' | 'history';
interface PendingAccept { type: 'accept'; request: DelayRequest }
interface PendingRefuse { type: 'refuse'; request: DelayRequest }
type PendingAction = PendingAccept | PendingRefuse;

export function DelayRequestsPage() {
  const t = useTranslations('station_delays');
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [tab, setTab] = useState<Tab>('pending');
  const [requests, setRequests] = useState<DelayRequest[]>([]);
  const [history, setHistory] = useState<ResolvedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 280));
    if (!mountedRef.current) return;
    setRequests(MOCK_PENDING);
    setHistory(MOCK_HISTORY);
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
      const resolved: ResolvedRequest = { ...pending.request, status: 'accepted', resolved_at: new Date().toISOString() };
      setRequests((prev) => prev.filter((r) => r.id !== pending.request.id));
      setHistory((prev) => [resolved, ...prev]);
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
      const resolved: ResolvedRequest = {
        ...pending.request,
        status: 'refused',
        refusal_reason: reason.trim() || undefined,
        resolved_at: new Date().toISOString(),
      };
      setRequests((prev) => prev.filter((r) => r.id !== pending.request.id));
      setHistory((prev) => [resolved, ...prev]);
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
    <div className="flex flex-1 flex-col overflow-hidden bg-[#F0EDE0] dark:bg-[#111A0E]">
      {/* Header */}
      <div className="border-b border-[#DDD9CC] bg-[#E8E4D4] px-6 pb-0 pt-5 dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
            <p className="mt-0.5 mb-3 text-[12px] text-[#555]/60 dark:text-[#FFFFF0]/40">
              {requests.length > 0 ? t('pending_n', { n: requests.length }) : t('no_pending')}
            </p>
          </div>
          {requests.length > 0 && (
            <div className="mb-3 flex items-center gap-1.5 rounded-full bg-[#C09A18]/15 px-3 py-1">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-[#C09A18] opacity-75" />
              <span className="text-[11px] font-bold text-[#C09A18]">{requests.length} {t('badge_pending')}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0" role="tablist" aria-label={t('page_title')}>
          {(['pending', 'history'] as Tab[]).map((t_) => (
            <button
              key={t_}
              type="button"
              role="tab"
              aria-selected={tab === t_}
              onClick={() => setTab(t_)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[12px] font-bold transition-all duration-150 ${
                tab === t_
                  ? 'border-[#C09A18] text-[#C09A18]'
                  : 'border-transparent text-[#555]/50 hover:text-[#555]/80 dark:text-[#FFFFF0]/30 dark:hover:text-[#FFFFF0]/60'
              }`}
            >
              {t_ === 'pending' ? t('tab_pending') : t('tab_history')}
              {t_ === 'pending' && requests.length > 0 && (
                <span className="rounded-full bg-[#C09A18] px-1.5 py-0.5 text-[9px] font-black leading-none text-white">
                  {requests.length}
                </span>
              )}
              {t_ === 'history' && history.length > 0 && (
                <span className="rounded-full bg-[#888]/20 px-1.5 py-0.5 text-[9px] font-black leading-none text-[#666] dark:bg-[#444]/40 dark:text-[#AAA]">
                  {history.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'pending' ? (
          requests.length === 0 ? (
            <EmptyState
              icon="check"
              label={t('empty_pending')}
              sublabel={t('empty_pending_sub')}
            />
          ) : (
            <div className="flex flex-col gap-3 max-w-xl">
              {requests.map((req, idx) => (
                <PendingCard
                  key={req.id}
                  request={req}
                  animationDelay={`${idx * 60}ms`}
                  onAccept={() => { setActionError(null); setPending({ type: 'accept', request: req }); }}
                  onRefuse={() => { setActionError(null); setPending({ type: 'refuse', request: req }); }}
                  acceptLabel={t('btn_accept')}
                  refuseLabel={t('btn_refuse')}
                  badgeLabel={t('badge_waiting')}
                  agoLabel={formatAgo(req.requested_at, t)}
                />
              ))}
            </div>
          )
        ) : (
          history.length === 0 ? (
            <EmptyState icon="clock" label={t('empty_history')} sublabel={t('empty_history_sub')} />
          ) : (
            <div className="flex flex-col gap-2.5 max-w-xl">
              {history.map((req, idx) => (
                <HistoryCard
                  key={req.id}
                  request={req}
                  animationDelay={`${idx * 50}ms`}
                  statusLabel={req.status === 'accepted' ? t('badge_accepted') : t('badge_refused')}
                  agoLabel={formatAgo(req.resolved_at, t)}
                />
              ))}
            </div>
          )
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
          blocking
          onConfirm={executeAccept}
          onCancel={() => { setPending(null); setActionError(null); }}
        />
      )}

      {/* Refuse modal */}
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

interface PendingCardProps {
  request: DelayRequest;
  animationDelay: string;
  onAccept: () => void;
  onRefuse: () => void;
  acceptLabel: string;
  refuseLabel: string;
  badgeLabel: string;
  agoLabel: string;
}

function PendingCard({ request, animationDelay, onAccept, onRefuse, acceptLabel, refuseLabel, badgeLabel, agoLabel }: PendingCardProps) {
  const initials = request.client_name.replace('Client #', '');
  return (
    <div
      className="animate-fade-in-up overflow-hidden rounded-[14px] border border-[#DDD9CC] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-[#2A3826] dark:bg-[#1A2416]"
      style={{ animationDelay }}
    >
      {/* Accent top bar */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#C09A18] to-[#E8C040]" />

      <div className="px-5 py-4">
        {/* Client row */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C09A18]/15 text-[11px] font-black text-[#C09A18]">
            {initials.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{request.client_name}</span>
              <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#92400E] dark:bg-[#3A2800] dark:text-[#FCD34D]">
                {badgeLabel}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] italic leading-relaxed text-[#333]/65 dark:text-[#FFFFF0]/55">
              « {request.message} »
            </p>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#555]/40 dark:text-[#FFFFF0]/30">
              <ClockMiniIcon />
              {agoLabel}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRefuse}
            className="rounded-[8px] border border-[#E8472A]/30 py-2.5 text-[12px] font-bold text-[#E8472A] transition-all duration-150 hover:bg-[#E8472A]/08 dark:border-[#E8472A]/30"
          >
            {refuseLabel}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-[8px] bg-[#00C851] py-2.5 text-[12px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#00B048] hover:shadow-md"
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface HistoryCardProps {
  request: ResolvedRequest;
  animationDelay: string;
  statusLabel: string;
  agoLabel: string;
}

function HistoryCard({ request, animationDelay, statusLabel, agoLabel }: HistoryCardProps) {
  const accepted = request.status === 'accepted';
  const accentColor = accepted ? '#00C851' : '#E8472A';
  const initials = request.client_name.replace('Client #', '');

  return (
    <div
      className="animate-fade-in-up flex gap-0 overflow-hidden rounded-[12px] border border-[#DDD9CC]/70 bg-white/70 dark:border-[#2A3826] dark:bg-[#1A2416]/70"
      style={{ animationDelay }}
    >
      {/* Left accent */}
      <div className="w-1 shrink-0 rounded-l-[12px]" style={{ background: accentColor }} />

      <div className="flex flex-1 items-start gap-3 px-4 py-3.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
          style={{ background: accentColor }}
        >
          {initials.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{request.client_name}</span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
              style={{ background: accentColor }}
            >
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-[11px] italic text-[#333]/50 dark:text-[#FFFFF0]/40 leading-relaxed">
            « {request.message} »
          </p>
          {!accepted && request.refusal_reason && (
            <p className="mt-1.5 rounded-[6px] bg-[#FEF2F2] px-2.5 py-1.5 text-[10px] text-[#991B1B]/70 dark:bg-[#2A0A0A] dark:text-[#FCA5A5]/60">
              {request.refusal_reason}
            </p>
          )}
          <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#555]/35 dark:text-[#FFFFF0]/25">
            <ClockMiniIcon />
            {agoLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, label, sublabel }: { icon: 'check' | 'clock'; label: string; sublabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {icon === 'check' ? (
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="text-[#00C851]/30" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><polyline points="9 12 12 15 15 9" />
        </svg>
      ) : (
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="text-[#1A1A0A]/15 dark:text-[#FFF8EC]/15" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      )}
      <div>
        <p className="text-[13px] font-bold text-[#1A1A0A]/50 dark:text-[#FFF8EC]/30">{label}</p>
        <p className="mt-0.5 text-[11px] text-[#1A1A0A]/30 dark:text-[#FFF8EC]/20">{sublabel}</p>
      </div>
    </div>
  );
}

const ClockMiniIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

function formatAgo(iso: string, t: (key: string, values?: Record<string, unknown>) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t('ago_now');
  if (minutes < 60) return t('ago_minutes', { n: minutes });
  return t('ago_hours', { n: Math.floor(minutes / 60) });
}

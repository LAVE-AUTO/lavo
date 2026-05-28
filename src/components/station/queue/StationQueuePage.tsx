'use client';

/**
 * StationQueuePage - STA-1
 * Queue interface for the station: shows in_progress entries + waiting entries
 * ordered by queue_position. Auto-polls every 30 s. Call / complete actions.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, patchWithApi, postWithApi } from '@/services';
import { useToast } from '@/context/toast-context';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { QueueCard, type QueueEntry } from '@/components/station/dashboard/QueueCard';
import { ACTIVE_QUEUE_STATUSES } from '@/components/station/dashboard/StationDashboard';

const POLL_INTERVAL = 30_000;

interface RawEntry {
  id: string;
  user_id: string;
  user?: { first_name?: string | null } | null;
  entry_type: 'reservation' | 'queue';
  queue_position: number | null;
  status: string;
  amount_paid: string | null;
  created_at: string;
}

type ActionType = 'call' | 'complete';
interface PendingAction { type: ActionType; entryId: string }

function toQueueEntry(e: RawEntry, idx: number, isNext: boolean): QueueEntry {
  const fallbackCode = `Client #${e.user_id.slice(0, 6).toUpperCase()}`;
  const clientName = e.user?.first_name?.trim() || fallbackCode;
  return {
    id: e.id,
    position: e.queue_position ?? idx + 1,
    clientName,
    entryType: e.entry_type,
    price: e.amount_paid ? parseFloat(e.amount_paid) : undefined,
    isNext,
  };
}


export function StationQueuePage() {
  const t = useTranslations('station_queue');
  const { error: showError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [entries, setEntries] = useState<RawEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setLoadError(false); }
    const [ok, data] = await getFromApi('/station/entries?per_page=100');
    if (!mountedRef.current) return;
    if (ok) {
      const raw = (data as { data: { entries: RawEntry[] } }).data?.entries ?? [];
      setEntries(raw);
      setLastUpdated(new Date());
    } else if (!silent) {
      setLoadError(true);
      showError(t('error_load'));
    }
    if (!silent) setLoading(false);
  }, [showError, t]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [loadData]);

  const inProgressEntries = useMemo(
    () => entries.filter((e) => e.status === 'in_progress'),
    [entries]
  );
  const waitingEntries = useMemo(
    () =>
      entries
        .filter((e) => (ACTIVE_QUEUE_STATUSES as readonly string[]).includes(e.status))
        .sort((a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999)),
    [entries]
  );

  const reservedCount = useMemo(() => waitingEntries.filter((e) => e.entry_type === 'reservation').length, [waitingEntries]);
  const walkInCount   = useMemo(() => waitingEntries.filter((e) => e.entry_type === 'queue').length,        [waitingEntries]);

  async function executeAction() {
    if (!pending || actionLoading) return;
    setActionLoading(true);
    setActionError(null);
    const newStatus = pending.type === 'call' ? 'in_progress' : 'completed';
    const [ok, data] = await patchWithApi(`/station/entries/${pending.entryId}`, { status: newStatus });
    if (!mountedRef.current) return;
    setActionLoading(false);
    if (ok) {
      setPending(null);
      await loadData(true);
    } else {
      const msg = (data as { message?: string })?.message ?? '';
      const errMsg = msg.includes('Cannot transition') ? t('error_invalid_transition') : t('error_action');
      setActionError(errMsg);
      showError(errMsg);
    }
  }

  async function handleReorder(id: string, newPosition: number) {
    await patchWithApi(`/station/entries/${id}/position`, { queue_position: newPosition });
    if (mountedRef.current) await loadData(true);
  }

  async function handlePick(entryId: string) {
    setActionLoading(true);
    setActionError(null);
    const [ok, data] = await postWithApi(`/stations/queue/${entryId}/pick`, {});
    if (!mountedRef.current) return;
    setActionLoading(false);
    if (ok) {
      await loadData(true);
    } else {
      const msg = (data as { message?: string })?.message || t('error_action');
      setActionError(msg);
      showError(msg);
    }
  }

  const lastUpdatedLabel = lastUpdated
    ? t('last_updated', { time: lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
    : '';

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C09A18] border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="text-[14px] font-semibold text-foreground/50 dark:text-foreground/40">{t('error_load')}</span>
        <button type="button" onClick={() => loadData()}
          className="rounded-[10px] border-[1.5px] border-[#C09A18]/50 px-4 py-2 text-[13px] font-semibold text-[#C09A18] transition-colors hover:bg-[#C09A18]/10">
          {t('btn_retry')}
        </button>
      </div>
    );
  }

  const totalWaiting = waitingEntries.length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#FFF9EC] dark:bg-[#001201]">
      {/* = Header */}
      <div className="border-b border-[#CCCCCC] bg-surface px-6 pb-4 pt-5 dark:border-[#3A4A36] dark:bg-[#001A05]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-bold text-foreground">{t('page_title')}</h1>
            <p className="mt-0.5 text-[13px] text-[#000717]/50 dark:text-[#FFFFF0]/50">
              {totalWaiting > 0 ? t('waiting_n', { n: totalWaiting }) : t('queue_empty_short')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {inProgressEntries.length > 0 && (
              <StatChip count={inProgressEntries.length} color="#C09A18" label={t('stat_in_progress')} />
            )}
            {reservedCount > 0 && <StatChip count={reservedCount} color="#00C851" label={t('stat_reserved')} />}
            {walkInCount > 0   && <StatChip count={walkInCount}   color="#0044FF" label={t('stat_walkin')} />}
            <button type="button" onClick={() => loadData()}
              className="flex items-center gap-1.5 rounded-[8px] border border-[#C0C0B0] bg-[#C8C8B4] px-3 py-1.5 text-[12px] font-semibold text-[#000717]/60 transition-colors hover:border-[#C09A18]/50 hover:text-[#C09A18] dark:border-[#3A4A36] dark:bg-[#001A05] dark:text-[#FFFFF0]/50">
              <RefreshIcon />
              {t('btn_refresh')}
            </button>
          </div>
        </div>
        {lastUpdatedLabel && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00C851] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00C851]" />
            </span>
            <p className="text-[11px] text-[#000717]/30 dark:text-[#FFFFF0]/25">{lastUpdatedLabel}</p>
          </div>
        )}
      </div>

      {/* = Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {inProgressEntries.length === 0 && waitingEntries.length === 0 ? (
          <EmptyState label={t('queue_empty')} />
        ) : (
          <>
            {/* In progress section */}
            {inProgressEntries.length > 0 && (
              <section>
                <SectionLabel label={t('section_in_progress')} color="#C09A18" />
                <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:flex-wrap">
                  {inProgressEntries.map((e) => (
                    <div key={e.id} className="lg:w-[calc(50%-6px)]">
                      <QueueCard
                        entry={toQueueEntry(e, 0, true)}
                        onCall={() => setPending({ type: 'complete', entryId: e.id })}
                        callLabel={t('btn_complete')}
                        badgeLabel={t('badge_in_progress')}
                        badgeColor="#00C851"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Waiting section */}
            {waitingEntries.length > 0 && (
              <section>
                <SectionLabel label={t('section_waiting')} />
                <div className="mt-2 flex flex-col gap-4 lg:flex-row">
                  {/* First in line - big card */}
                  <div className="lg:w-2/5 lg:shrink-0">
                    <QueueCard
                      entry={toQueueEntry(waitingEntries[0], 0, true)}
                      onCall={() => setPending({ type: 'call', entryId: waitingEntries[0].id })}
                      onPick={() => handlePick(waitingEntries[0].id)}
                    />
                  </div>
                  {/* Rest of queue */}
                  {waitingEntries.length > 1 && (
                    <div className="flex flex-1 flex-col gap-2.5">
                      {waitingEntries.slice(1).map((e, idx) => (
                        <QueueCard
                          key={e.id}
                          entry={toQueueEntry(e, idx + 1, false)}
                          onCall={() => setPending({ type: 'call', entryId: e.id })}
                          onPick={() => handlePick(e.id)}
                          onMoveUp={idx > 0 ? () => handleReorder(e.id, (e.queue_position ?? idx + 2) - 1) : undefined}
                          onMoveDown={idx < waitingEntries.length - 2 ? () => handleReorder(e.id, (e.queue_position ?? idx + 2) + 1) : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* = Confirm modal */}
      <ConfirmDialog
        open={pending !== null}
        title={pending?.type === 'call' ? t('confirm_call_title') : t('confirm_complete_title')}
        message={actionError
          ? `${pending?.type === 'call' ? t('confirm_call_message') : t('confirm_complete_message')}\n\n${actionError}`
          : pending?.type === 'call' ? t('confirm_call_message') : t('confirm_complete_message')}
        confirmLabel={pending?.type === 'call' ? t('btn_call') : t('btn_complete')}
        cancelLabel={t('btn_cancel')}
        variant="default"
        loading={actionLoading}
        blocking
        onConfirm={executeAction}
        onCancel={() => { setPending(null); setActionError(null); }}
      />
    </div>
  );
}


function StatChip({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <div className="hidden items-center gap-1.5 rounded-[8px] bg-[#C8C8B4] px-3 py-1.5 sm:flex dark:bg-[#001A05]">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="font-mono text-[14px] font-bold text-foreground">{count}</span>
      <span className="text-[11px] font-semibold text-[#000717]/50 dark:text-[#FFFFF0]/50">{label}</span>
    </div>
  );
}

function SectionLabel({ label, color }: { label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color ?? '#888' }} />
      <span className="text-[12px] font-bold uppercase tracking-wider text-[#000717]/50 dark:text-[#FFFFF0]/40">{label}</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="text-foreground/15 dark:text-foreground/15" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
        <path d="M8 18h.01M12 18h.01M16 18h.01" />
      </svg>
      <span className="text-[13px] font-semibold text-foreground/40 dark:text-foreground/30">{label}</span>
    </div>
  );
}

const RefreshIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

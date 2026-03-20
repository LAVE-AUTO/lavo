'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, patchWithApi } from '@/services';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusTabs } from './StatusTabs';
import { ReservationCard } from './ReservationCard';
import type { ReservationEntry, StatusTab, EntryStatus } from './types';
import { MOCK_RESERVATIONS } from './mock-data';

type ActionType = 'validate' | 'start' | 'cancel';

interface PendingAction {
  type: ActionType;
  entryId: string;
  clientLabel: string;
}

const STATUS_PRIORITY: Record<string, number> = {
  in_progress: 0, confirmed: 1, pending: 1, late: 2,
  pending_payment: 3, completed: 4, cancelled: 5,
};

function sortEntries(a: ReservationEntry, b: ReservationEntry): number {
  const pa = STATUS_PRIORITY[a.status] ?? 9;
  const pb = STATUS_PRIORITY[b.status] ?? 9;
  if (pa !== pb) return pa - pb;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function todayRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function StationReservationsPage() {
  const t = useTranslations('station_reservations');

  const [entries, setEntries] = useState<ReservationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { from, to } = todayRange();
    const [ok, data] = await getFromApi(`/station/entries?from=${from}&to=${to}&per_page=100`);
    if (!mountedRef.current) return;
    if (ok) {
      const res = data as { data: { entries: ReservationEntry[] } };
      const fetched = res?.data?.entries ?? [];
      // TODO: connect to API once endpoint returns real data — remove mock fallback
      setEntries(fetched.length > 0 ? fetched : MOCK_RESERVATIONS);
    } else {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const base = activeTab === 'all' ? entries : entries.filter((e) => {
      if (activeTab === 'confirmed') return e.status === 'confirmed' || e.status === 'pending';
      return e.status === activeTab;
    });
    return [...base].sort(sortEntries);
  }, [entries, activeTab]);

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = {
      all: entries.length, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0, late: 0,
    };
    for (const e of entries) {
      if (e.status === 'pending' || e.status === 'confirmed') c.confirmed++;
      else if (e.status in c) c[e.status as StatusTab]++;
    }
    return c;
  }, [entries]);

  const kpis = useMemo(() => {
    let revenue = 0;
    let active = 0;
    let done = 0;
    for (const e of entries) {
      if (e.amount_paid && e.status !== 'cancelled') { const n = parseFloat(e.amount_paid); if (!isNaN(n)) revenue += n; }
      if (e.status === 'in_progress') active++;
      if (e.status === 'completed') done++;
    }
    return { revenue, active, done, total: entries.length };
  }, [entries]);

  function requestAction(type: ActionType, entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    const clientLabel = entry ? `${t('client_label')} #${entry.user_id.slice(0, 8)}` : '';
    setPending({ type, entryId, clientLabel });
    setActionError(null);
  }

  async function executeAction() {
    if (!pending) return;
    setActionLoading(true);
    setActionError(null);

    const statusMap: Record<ActionType, string> = {
      validate: 'completed', start: 'in_progress', cancel: 'cancelled',
    };
    const newStatus = statusMap[pending.type];
    const [ok] = await patchWithApi(`/station/entries/${pending.entryId}`, { status: newStatus });
    if (!mountedRef.current) return;

    setActionLoading(false);
    if (ok) {
      setPending(null);
      await loadData();
    } else {
      // Keep dialog open and show error — do not update local state on failure
      setActionError(t('error_action'));
    }
  }

  function getConfirmProps() {
    if (!pending) return { title: '', message: '', variant: 'default' as const };
    const map: Record<ActionType, { titleKey: string; msgKey: string; variant: 'default' | 'danger' }> = {
      validate: { titleKey: 'confirm_validate_title', msgKey: 'confirm_validate_message', variant: 'default' },
      start:    { titleKey: 'confirm_start_title',    msgKey: 'confirm_start_message',    variant: 'default' },
      cancel:   { titleKey: 'confirm_cancel_title',   msgKey: 'confirm_cancel_message',   variant: 'danger' },
    };
    const cfg = map[pending.type];
    return { title: t(cfg.titleKey), message: t(cfg.msgKey, { client: pending.clientLabel }), variant: cfg.variant };
  }

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
        <span className="text-[14px] font-semibold text-[#000C1F]/50 dark:text-[#FFF8EC]/40">{t('error_load')}</span>
        <button type="button" onClick={loadData} className="rounded-[10px] border-[1.5px] border-[#C09A18]/50 px-4 py-2 text-[13px] font-semibold text-[#C09A18] transition-colors hover:bg-[#C09A18]/10">
          {t('btn_retry')}
        </button>
      </div>
    );
  }

  const confirm = getConfirmProps();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#EDEDED] dark:bg-[#1A2116]">
      {/* Header */}
      <div className="border-b border-[#CCCCCC] bg-[#E0E0D0] px-6 pb-4 pt-5 dark:border-[#3A4A36] dark:bg-[#243020]">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">
              {t('page_title')}
            </h1>
            <p className="mt-0.5 text-[12px] text-[#000717]/50 dark:text-[#FFFFF0]/50">
              {t('page_subtitle', { count: entries.length })}
            </p>
          </div>
          {/* Mini KPI row */}
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <KpiChip value={kpis.active} color="#00C851" label={t('tab_in_progress')} />
            <KpiChip value={kpis.done} color="#0044FF" label={t('tab_completed')} />
            <KpiChip value={`${kpis.revenue.toFixed(0)}$`} color="#C09A18" label={t('amount_label')} />
          </div>
        </div>
        <div className="mt-4">
          <StatusTabs active={activeTab} counts={counts} onChange={setActiveTab} />
        </div>
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <EmptyIcon />
            <span className="text-[13px] font-semibold text-[#000C1F]/40 dark:text-[#FFF8EC]/30">
              {activeTab === 'all' ? t('empty_state') : t('empty_filtered')}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
            {filtered.map((entry) => (
              <ReservationCard
                key={entry.id}
                entry={entry}
                onValidate={(id) => requestAction('validate', id)}
                onStart={(id) => requestAction('start', id)}
                onCancel={(id) => requestAction('cancel', id)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={confirm.title}
        message={actionError ? `${confirm.message}\n\n${actionError}` : confirm.message}
        variant={confirm.variant}
        loading={actionLoading}
        confirmLabel={pending?.type === 'cancel' ? t('btn_cancel_entry') : pending?.type === 'validate' ? t('btn_validate') : t('btn_start_service')}
        cancelLabel={t('btn_cancel')}
        onConfirm={executeAction}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

function KpiChip({ value, color, label }: { value: string | number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-[8px] bg-[#C8C8B4] px-3 py-1.5 dark:bg-[#1E2A1A]">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="font-mono text-[14px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{value}</span>
      <span className="text-[10px] font-semibold text-[#000717]/50 dark:text-[#FFFFF0]/50">{label}</span>
    </div>
  );
}

const EmptyIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="text-[#000C1F]/15 dark:text-[#FFF8EC]/15">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
  </svg>
);

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, patchWithApi } from '@/services';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusTabs } from './StatusTabs';
import { ReservationCard } from './ReservationCard';
import type { ReservationEntry, StatusTab } from './types';

type ActionType = 'validate' | 'start' | 'cancel';

interface PendingAction {
  type: ActionType;
  entryId: string;
  clientLabel: string;
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
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { from, to } = todayRange();
    const [ok, data] = await getFromApi(`/station/entries?from=${from}&to=${to}&per_page=100`);
    if (ok) {
      const res = data as { data: { entries: ReservationEntry[] } };
      setEntries(res.data.entries ?? []);
    } else {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* Filter entries by active tab */
  const filtered = useMemo(() => {
    if (activeTab === 'all') return entries;
    return entries.filter((e) => e.status === activeTab);
  }, [entries, activeTab]);

  /* Counts for tabs */
  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = {
      all: entries.length,
      confirmed: 0, in_progress: 0, completed: 0, cancelled: 0, late: 0,
    };
    for (const e of entries) {
      if (e.status in c) c[e.status as StatusTab]++;
      if (e.status === 'pending') c.confirmed++;
    }
    return c;
  }, [entries]);

  /* Action handlers */
  function requestAction(type: ActionType, entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    const clientLabel = entry ? `Client #${entry.user_id.slice(0, 8)}` : '';
    setPending({ type, entryId, clientLabel });
    setActionError(null);
  }

  async function executeAction() {
    if (!pending) return;
    setActionLoading(true);
    setActionError(null);

    const statusMap: Record<ActionType, string> = {
      validate: 'completed',
      start: 'in_progress',
      cancel: 'cancelled',
    };

    const [ok] = await patchWithApi(`/station/entries/${pending.entryId}`, {
      status: statusMap[pending.type],
    });

    setActionLoading(false);
    if (ok) {
      setPending(null);
      await loadData();
    } else {
      setActionError(t('error_action'));
    }
  }

  /* Confirm dialog props */
  function getConfirmProps() {
    if (!pending) return { title: '', message: '', variant: 'default' as const };
    const map: Record<ActionType, { titleKey: string; msgKey: string; variant: 'default' | 'danger' }> = {
      validate: { titleKey: 'confirm_validate_title', msgKey: 'confirm_validate_message', variant: 'default' },
      start:    { titleKey: 'confirm_start_title',    msgKey: 'confirm_start_message',    variant: 'default' },
      cancel:   { titleKey: 'confirm_cancel_title',   msgKey: 'confirm_cancel_message',   variant: 'danger' },
    };
    const cfg = map[pending.type];
    return {
      title: t(cfg.titleKey),
      message: t(cfg.msgKey, { client: pending.clientLabel }),
      variant: cfg.variant,
    };
  }

  /* Loading state */
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
      </div>
    );
  }

  /* Error state */
  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="text-[14px] font-semibold text-[#999] dark:text-[#6A6A5A]">
          {t('error_load')}
        </span>
        <button
          type="button"
          onClick={loadData}
          className="rounded-[10px] border border-[#C49A1E]/50 px-4 py-2 text-[13px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/10"
        >
          {t('btn_retry')}
        </button>
      </div>
    );
  }

  const confirm = getConfirmProps();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#F5F5EE] dark:bg-[#0C1209]">
      {/* Header */}
      <div className="border-b border-[#E0DCD0] bg-white px-6 py-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[18px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
            {t('page_title')}
          </h1>
          <span className="text-[12px] text-[#888] dark:text-[#6A6A5A]">
            {t('page_subtitle', { count: entries.length })}
          </span>
        </div>
        <div className="mt-3">
          <StatusTabs active={activeTab} counts={counts} onChange={setActiveTab} />
        </div>
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto p-5">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-[#888] dark:text-[#6A6A5A]">
            {activeTab === 'all' ? t('empty_state') : t('empty_filtered')}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
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

      {/* Confirm dialog */}
      <ConfirmDialog
        open={pending !== null}
        title={confirm.title}
        message={actionError ? `${confirm.message}\n\n${actionError}` : confirm.message}
        variant={confirm.variant}
        loading={actionLoading}
        confirmLabel={pending?.type === 'cancel' ? t('btn_cancel_entry') : pending?.type === 'validate' ? t('btn_validate') : t('btn_start_service')}
        onConfirm={executeAction}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

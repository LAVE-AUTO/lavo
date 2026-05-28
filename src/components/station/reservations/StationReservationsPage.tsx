'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, patchWithApi, postWithApi } from '@/services';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusTabs } from './StatusTabs';
import { ReservationCard } from './ReservationCard';
import type { ReservationEntry, StatusTab } from './types';

type ActionType = 'validate' | 'start' | 'cancel';
type EntryTypeFilter = 'all' | 'reservation' | 'queue';

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
  // Sort reservations by slot time, queue entries by created_at
  const ta = (a as ReservationEntry & { slot_start_time?: string }).slot_start_time ?? a.created_at;
  const tb = (b as ReservationEntry & { slot_start_time?: string }).slot_start_time ?? b.created_at;
  return new Date(ta).getTime() - new Date(tb).getTime();
}

function toISO(d: Date): string {
  return d.toISOString();
}

function dayStart(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function dayEnd(d: Date): Date {
  const s = dayStart(d);
  s.setDate(s.getDate() + 1);
  return s;
}

function formatDateLabel(d: Date, locale: string): string {
  const label = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function StationReservationsPage() {
  const t = useTranslations('station_reservations');

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [entryTypeFilter, setEntryTypeFilter] = useState<EntryTypeFilter>('all');
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

    const from = dayStart(selectedDate);
    const to = dayEnd(selectedDate);

    // For reservations filter by slot time; for queue and all filter by created_at
    let params: URLSearchParams;
    if (entryTypeFilter === 'reservation') {
      params = new URLSearchParams({
        entry_type: 'reservation',
        slot_from: toISO(from),
        slot_to: toISO(to),
        per_page: '200',
      });
    } else if (entryTypeFilter === 'queue') {
      params = new URLSearchParams({
        entry_type: 'queue',
        from: toISO(from),
        to: toISO(to),
        per_page: '200',
      });
    } else {
      // All: combine both fetches
      const [resResult, queueResult] = await Promise.all([
        getFromApi(`/station/entries?entry_type=reservation&slot_from=${encodeURIComponent(toISO(from))}&slot_to=${encodeURIComponent(toISO(to))}&per_page=200`),
        getFromApi(`/station/entries?entry_type=queue&from=${encodeURIComponent(toISO(from))}&to=${encodeURIComponent(toISO(to))}&per_page=200`),
      ]);
      if (!mountedRef.current) return;
      const resEntries = resResult[0] ? ((resResult[1] as { data: { entries: ReservationEntry[] } })?.data?.entries ?? []) : [];
      const queueEntries = queueResult[0] ? ((queueResult[1] as { data: { entries: ReservationEntry[] } })?.data?.entries ?? []) : [];
      if (!resResult[0] && !queueResult[0]) { setLoadError(true); }
      setEntries([...resEntries, ...queueEntries]);
      setLoading(false);
      return;
    }

    const [ok, data] = await getFromApi(`/station/entries?${params.toString()}`);
    if (!mountedRef.current) return;
    if (ok) {
      setEntries((data as { data: { entries: ReservationEntry[] } })?.data?.entries ?? []);
    } else {
      setLoadError(true);
    }
    setLoading(false);
  }, [selectedDate, entryTypeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

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
    let revenue = 0; let active = 0; let done = 0;
    for (const e of entries) {
      if (e.amount_paid && e.status !== 'cancelled') { const n = parseFloat(e.amount_paid); if (!isNaN(n)) revenue += n; }
      if (e.status === 'in_progress') active++;
      if (e.status === 'completed') done++;
    }
    return { revenue, active, done, total: entries.length };
  }, [entries]);

  function requestAction(type: ActionType, entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    const firstName = entry?.user?.first_name?.trim();
    const lastName = entry?.user?.last_name?.trim();
    const fullName = [firstName, lastName].filter((part): part is string => Boolean(part && part.length > 0)).join(' ');
    const clientIdentity = fullName.length > 0 ? fullName : (entry ? `#${entry.user_id.slice(0, 8)}` : '');
    const clientLabel = entry ? clientIdentity : '';
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
    const [ok] = await patchWithApi(`/station/entries/${pending.entryId}`, { status: statusMap[pending.type] });
    if (!mountedRef.current) return;
    setActionLoading(false);
    if (ok) { setPending(null); await loadData(); }
    else { setActionError(t('error_action')); }
  }

  async function handleStartEntry(entryId: string) {
    const [ok] = await patchWithApi(`/station/entries/${entryId}`, { status: 'in_progress' });
    if (!mountedRef.current) return;
    if (ok) { await loadData(); }
    else { setActionError(t('error_action')); }
  }

  async function handleExtraTime(entryId: string, minutes: number) {
    const [ok] = await postWithApi('/station/extra-time', { reservation_id: entryId, extra_minutes: minutes });
    if (!mountedRef.current) return;
    if (ok) { await loadData(); }
    else { setActionError(t('extra_time_error')); }
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

  const today = isToday(selectedDate);
  // Use browser locale for date label
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'fr-FR';
  const dateLabel = formatDateLabel(selectedDate, locale);

  const confirm = getConfirmProps();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#EDEDED] dark:bg-background">
      {/* Header */}
      <div className="border-b border-[#CCCCCC] bg-surface px-6 pb-4 pt-5 dark:border-[#3A4A36] dark:bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold text-foreground">
              {t('page_title')}
            </h1>
            <p className="mt-0.5 text-[13px] text-[#000717]/50 dark:text-[#FFFFF0]/50">
              {t('page_subtitle', { count: entries.length })}
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <KpiChip value={kpis.active} color="#00C851" label={t('tab_in_progress')} />
            <KpiChip value={kpis.done} color="#0044FF" label={t('tab_completed')} />
            <KpiChip value={`${kpis.revenue.toFixed(0)}$`} color="#C09A18" label={t('amount_label')} />
          </div>
        </div>

        {/* Date navigator */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate((d) => { const p = new Date(d); p.setDate(p.getDate() - 1); return p; })}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#CCCCCC] bg-white text-foreground/70 transition-colors hover:border-[#C09A18] hover:text-[#C09A18] dark:border-[#3A4A36] dark:bg-background dark:text-[#9A9A8A]"
            aria-label={t('date_prev')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex min-w-50 flex-col items-center rounded-xl border border-[#CCCCCC] bg-white px-4 py-1.5 dark:border-[#3A4A36] dark:bg-background">
            <span className="text-[13px] font-bold text-foreground">{dateLabel}</span>
            {today && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C09A18]">{t('date_today')}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#CCCCCC] bg-white text-foreground/70 transition-colors hover:border-[#C09A18] hover:text-[#C09A18] dark:border-[#3A4A36] dark:bg-background dark:text-[#9A9A8A]"
            aria-label={t('date_next')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {!today && (
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className="rounded-lg border border-[#C09A18]/40 px-3 py-1.5 text-[11px] font-bold text-[#C09A18] transition-colors hover:bg-[#C09A18]/10"
            >
              {t('date_go_today')}
            </button>
          )}
        </div>

        {/* Entry type filter */}
        <div className="mt-3 flex items-center gap-2">
          {(['all', 'reservation', 'queue'] as EntryTypeFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setEntryTypeFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                entryTypeFilter === f
                  ? 'bg-[#C09A18] text-[#0C1209]'
                  : 'border border-[#CCCCCC] bg-white text-foreground/70 hover:border-[#C09A18] hover:text-[#C09A18] dark:border-[#3A4A36] dark:bg-background dark:text-[#9A9A8A]'
              }`}
            >
              {t(`filter_type_${f}`)}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <StatusTabs active={activeTab} counts={counts} onChange={setActiveTab} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C09A18] border-t-transparent" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="text-[14px] font-semibold text-foreground/50 dark:text-foreground/40">{t('error_load')}</span>
            <button type="button" onClick={loadData} className="rounded-[10px] border-[1.5px] border-[#C09A18]/50 px-4 py-2 text-[13px] font-semibold text-[#C09A18] transition-colors hover:bg-[#C09A18]/10">
              {t('btn_retry')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <EmptyIcon />
            <span className="text-[13px] font-semibold text-foreground/40 dark:text-foreground/30">
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
                onStart={handleStartEntry}
                onCancel={(id) => requestAction('cancel', id)}
                onExtraTime={handleExtraTime}
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
        blocking
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
    <div className="flex items-center gap-1.5 rounded-lg bg-[#C8C8B4] px-3 py-1.5 dark:bg-surface">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="font-mono text-[14px] font-bold text-foreground">{value}</span>
      <span className="text-[11px] font-semibold text-[#000717]/50 dark:text-[#FFFFF0]/50">{label}</span>
    </div>
  );
}

const EmptyIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="text-foreground/15 dark:text-foreground/15">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
  </svg>
);

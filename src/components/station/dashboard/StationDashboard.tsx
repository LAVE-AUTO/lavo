'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, patchWithApi, postWithApi } from '@/services';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageLoader } from '@/components/ui/PageLoader';
import { DashboardOverviewSection } from './DashboardOverviewSection';
import { DashboardDateNav } from './DashboardDateNav';
import { DashboardAgendaTimeline, type AgendaEntry, type AgendaPost } from './DashboardAgendaTimeline';
import { DashboardLegendBar } from './DashboardLegendBar';
import { DashboardQueueBand } from './DashboardQueueBand';
import { DashboardGroupedPanel } from './DashboardGroupedPanel';
import { DashboardDelaysPanel, type DashboardDelayItem } from './DashboardDelaysPanel';
import { DashboardBayFilter } from './DashboardBayFilter';
import type { KpiData, ReservationItem } from './types';
import type { QueueEntry } from './QueueCard';

const DELAYS_PREVIEW_SIZE = 5;

interface RawDelayPreview {
  id: string;
  user_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'refused';
  created_at: string;
}

const EMPTY_KPI: KpiData = { revenue: null, clients: null, lateFees: null, occupancy: null };

export const ACTIVE_QUEUE_STATUSES = ['pending', 'confirmed', 'late', 'pending_payment'] as const;

interface RawEntry {
  id: string;
  user_id: string;
  entry_type: 'reservation' | 'queue';
  time_slot_id: string | null;
  station_id: string;
  vehicle_format_id: string | null;
  post_id: string | null;
  status: string;
  queue_position: number | null;
  amount_paid: string | null;
  slot_start_time: string | null;
  slot_end_time: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  user?: { first_name: string | null } | null;
  vehicle_format?: { id: string; label: string } | null;
}

interface RawDashboard {
  total_revenue: string;
  total_clients: number;
  total_completed: number;
  average_rating: string | null;
  pending_count: number;
  month: string;
  late_fees_total: string;
  fill_rate_pct: number;
  revenue_previous_period: string;
  clients_previous_period: number;
}

interface RawConfig {
  config: {
    opening_time: string | null;
    closing_time: string | null;
    break_start: string | null;
    break_end: string | null;
    wash_post_count: number | null;
  };
  posts: Array<{ id: string; position: number; is_active: boolean }>;
}

type DashboardAction = 'call' | 'complete' | 'cancel' | 'start' | 'call_next';

interface PendingAction {
  type: DashboardAction;
  entryId: string;
}

function clientNameOf(entry: RawEntry): string {
  const first = entry.user?.first_name?.trim();
  if (first) return first;
  return `Client #${entry.user_id.slice(0, 4).toUpperCase()}`;
}

function dayRange(date: Date): { from: string; to: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function buildDateRange(date: Date, view: 'daily' | 'weekly' | 'monthly'): { from: string; to: string } {
  if (view === 'weekly') {
    const mon = new Date(date);
    const dow = mon.getDay();
    mon.setDate(mon.getDate() - (dow === 0 ? 6 : dow - 1));
    mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 7);
    return { from: mon.toISOString(), to: sun.toISOString() };
  }
  if (view === 'monthly') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  return dayRange(date);
}

function buildQueueEntries(raw: RawEntry[]): QueueEntry[] {
  const inProgress = raw
    .filter((e) => e.status === 'in_progress')
    .map((e): QueueEntry => ({
      id: e.id,
      position: 0,
      clientName: clientNameOf(e),
      entryType: e.entry_type,
      serviceLabel: e.vehicle_format?.label ?? undefined,
      price: e.amount_paid ? parseFloat(e.amount_paid) : undefined,
      isNext: false,
      status: e.status,
    }));
  const waiting = raw
    .filter((e) => (ACTIVE_QUEUE_STATUSES as readonly string[]).includes(e.status))
    .sort((a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999))
    .map((e, idx): QueueEntry => ({
      id: e.id,
      position: e.queue_position ?? idx + 1,
      clientName: clientNameOf(e),
      entryType: e.entry_type,
      serviceLabel: e.vehicle_format?.label ?? undefined,
      price: e.amount_paid ? parseFloat(e.amount_paid) : undefined,
      isNext: inProgress.length === 0 && idx === 0,
      status: e.status,
    }));
  return [...inProgress, ...waiting];
}

function buildAgendaEntries(raw: RawEntry[]): AgendaEntry[] {
  return raw.map((e): AgendaEntry => ({
    id: e.id,
    clientName: clientNameOf(e),
    vehicleFormat: e.vehicle_format?.label ?? null,
    status: e.status,
    slotStart: e.slot_start_time,
    slotEnd: e.slot_end_time,
    amountPaid: e.amount_paid ? parseFloat(e.amount_paid) : null,
    postId: e.post_id,
  }));
}

function buildReservationItems(raw: RawEntry[]): ReservationItem[] {
  return [...raw]
    .sort((a, b) => {
      const ta = a.slot_start_time ? new Date(a.slot_start_time).getTime() : 0;
      const tb = b.slot_start_time ? new Date(b.slot_start_time).getTime() : 0;
      return ta - tb;
    })
    .map((e): ReservationItem => ({
      id: e.id,
      clientName: clientNameOf(e),
      vehicleFormat: e.vehicle_format?.label ?? null,
      status: e.status,
      slotStart: e.slot_start_time ?? null,
      slotEnd: e.slot_end_time ?? null,
      amountPaid: e.amount_paid ? parseFloat(e.amount_paid) : null,
    }));
}

const ACTION_STATUS_MAP: Partial<Record<DashboardAction, string>> = {
  call: 'in_progress',
  complete: 'completed',
  cancel: 'cancelled',
  start: 'in_progress',
};

function mapDashboardToKpi(raw: RawDashboard): KpiData {
  const revenue = Number.parseFloat(raw.total_revenue ?? '');
  const lateFees = Number.parseFloat(raw.late_fees_total ?? '');
  return {
    revenue: Number.isFinite(revenue) ? Math.round(revenue) : 0,
    clients: typeof raw.total_clients === 'number' ? raw.total_clients : 0,
    lateFees: Number.isFinite(lateFees) ? Math.round(lateFees) : 0,
    occupancy: typeof raw.fill_rate_pct === 'number' ? raw.fill_rate_pct : 0,
  };
}

const CONFIRM_DIALOG_LABELS: Record<DashboardAction, { title: string; message: string }> = {
  call:      { title: 'confirm_call_title',      message: 'confirm_call_message' },
  complete:  { title: 'confirm_complete_title',  message: 'confirm_complete_message' },
  cancel:    { title: 'confirm_cancel_title',    message: 'confirm_cancel_message' },
  start:     { title: 'confirm_start_title',     message: 'confirm_start_message' },
  call_next: { title: 'confirm_call_next_title', message: 'confirm_call_next_message' },
};

export function StationDashboard() {
  const { isLoading: authLoading } = useAuth();
  const { error: showError, info: showInfo } = useToast();
  const t = useTranslations('station_dashboard');
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [kpi, setKpi] = useState<KpiData>(EMPTY_KPI);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [agendaEntries, setAgendaEntries] = useState<AgendaEntry[]>([]);
  const [reservationItems, setReservationItems] = useState<ReservationItem[]>([]);
  const [posts, setPosts] = useState<AgendaPost[]>([]);
  const [delays, setDelays] = useState<DashboardDelayItem[]>([]);
  const [delaysPendingTotal, setDelaysPendingTotal] = useState(0);
  const [config, setConfig] = useState<{
    openingTime: string | null;
    closingTime: string | null;
    breakStart: string | null;
    breakEnd: string | null;
  }>({ openingTime: null, closingTime: null, breakStart: null, breakEnd: null });
  const [selectedPostId, setSelectedPostId] = useState<string | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    const { from: queueFrom, to: queueTo } = dayRange(selectedDate);
    const { from: resFrom, to: resTo } = buildDateRange(selectedDate, view);
    const queueQuery = `?entry_type=queue&from=${encodeURIComponent(queueFrom)}&to=${encodeURIComponent(queueTo)}&per_page=200`;
    const reservationsQuery = `?entry_type=reservation&slot_from=${encodeURIComponent(resFrom)}&slot_to=${encodeURIComponent(resTo)}&per_page=200`;

    const [queueResult, reservationsResult, dashboardResult, delaysResult, configResult] = await Promise.all([
      getFromApi(`/station/entries${queueQuery}`),
      getFromApi(`/station/entries${reservationsQuery}`),
      getFromApi('/station/dashboard'),
      getFromApi(`/station/delays?status=pending&per_page=${DELAYS_PREVIEW_SIZE}`),
      getFromApi('/station/config'),
    ]);

    if (!mountedRef.current) return;

    const [queueOk, queueData] = queueResult;
    const [reservationsOk, reservationsData] = reservationsResult;
    const [dashboardOk, dashboardData] = dashboardResult;
    const [delaysOk, delaysData] = delaysResult;
    const [configOk, configData] = configResult;

    if (configOk) {
      const payload = (configData as { data?: RawConfig })?.data;
      const cfg = payload?.config;
      setConfig({
        openingTime: cfg?.opening_time ?? null,
        closingTime: cfg?.closing_time ?? null,
        breakStart: cfg?.break_start ?? null,
        breakEnd: cfg?.break_end ?? null,
      });
      setPosts(
        (payload?.posts ?? []).map((p) => ({ id: p.id, position: p.position, isActive: p.is_active })),
      );
    }

    if (queueOk) {
      const raw = (queueData as { data: { entries: RawEntry[] } }).data?.entries ?? [];
      setQueueEntries(buildQueueEntries(raw));
    }

    if (reservationsOk) {
      const raw = (reservationsData as { data: { entries: RawEntry[] } }).data?.entries ?? [];
      setReservationItems(buildReservationItems(raw));
      setAgendaEntries(buildAgendaEntries(raw));
    }

    if (dashboardOk) {
      const dashboard = (dashboardData as { data?: RawDashboard })?.data;
      setKpi(dashboard ? mapDashboardToKpi(dashboard) : { revenue: 0, clients: 0, lateFees: 0, occupancy: 0 });
    } else {
      setKpi({ revenue: 0, clients: 0, lateFees: 0, occupancy: 0 });
    }

    if (delaysOk) {
      const payload = (delaysData as { data?: { items?: RawDelayPreview[]; meta?: { total?: number } } })?.data;
      const items = payload?.items ?? [];
      setDelays(
        items
          .filter((d) => d.status === 'pending')
          .map((d): DashboardDelayItem => ({
            id: d.id,
            clientName: `Client #${d.user_id.slice(0, 4).toUpperCase()}`,
            message: d.message,
            requestedAt: d.created_at,
          })),
      );
      setDelaysPendingTotal(payload?.meta?.total ?? items.filter((d) => d.status === 'pending').length);
    }

    setLoading(false);
  }, [selectedDate, view]);

  useEffect(() => {
    if (!authLoading) { loadData(); }
  }, [authLoading, loadData]);

  function requestAction(type: DashboardAction, entryId: string) {
    setPending({ type, entryId });
  }

  async function handleExtraTime(entryId: string, minutes: number) {
    const [ok] = await postWithApi('/station/extra-time', { reservation_id: entryId, extra_minutes: minutes });
    if (!mountedRef.current) return;
    if (ok) {
      await loadData();
    } else {
      showError(t('extra_time_error'));
    }
  }

  function handleOpenManualAdd() {
    /* Manual queue add modal requires vehicleFormats + availableSlots wiring
     * which lives on the queue page. For now we direct the merchant there. */
    showInfo(t('queue_manual_add_redirect'));
  }

  async function executeAction() {
    if (!pending || actionLoading) return;
    setActionLoading(true);

    try {
      if (pending.type === 'call_next') {
        const [ok, data] = await postWithApi('/station/queue/next', {});
        if (!mountedRef.current) return;
        if (ok) {
          setPending(null);
          await loadData();
          return;
        }
        const payload = data as { message?: string; code?: string } | null;
        showError(payload?.code === 'NOT_FOUND' ? t('error_queue_empty') : t('action_error_generic'));
        setPending(null);
        return;
      }

      const newStatus = ACTION_STATUS_MAP[pending.type];
      const [ok, data] = await patchWithApi(`/station/entries/${pending.entryId}`, { status: newStatus });
      if (!mountedRef.current) return;
      if (ok) {
        setPending(null);
        await loadData();
        return;
      }
      const raw = (data as { message?: string })?.message ?? '';
      showError(raw.includes('Cannot transition') ? t('error_invalid_transition') : t('action_error_generic'));
      setPending(null);
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }

  const dialogLabels = pending ? CONFIRM_DIALOG_LABELS[pending.type] : null;

  const visibleAgendaEntries = useMemo(() => {
    if (selectedPostId === 'all') return agendaEntries;
    return agendaEntries.filter((e) => e.postId === selectedPostId || e.postId === null);
  }, [agendaEntries, selectedPostId]);

  if (loading) {
    return <PageLoader label={t('loading')} />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      <DashboardOverviewSection data={kpi} />

      <DashboardDateNav
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        view={view}
        onViewChange={setView}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Bay filter (desktop only) */}
        {view === 'daily' && posts.length > 0 && (
          <DashboardBayFilter
            posts={posts}
            selectedPostId={selectedPostId}
            onSelect={setSelectedPostId}
          />
        )}

        <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
          {view === 'daily' ? (
            <DashboardAgendaTimeline
              posts={posts}
              entries={visibleAgendaEntries}
              selectedDate={selectedDate}
              openingTime={config.openingTime}
              closingTime={config.closingTime}
              breakStart={config.breakStart}
              breakEnd={config.breakEnd}
              selectedPostId={selectedPostId}
              onStart={(id) => requestAction('start', id)}
              onComplete={(id) => requestAction('complete', id)}
              onCancel={(id) => requestAction('cancel', id)}
              onExtraTime={handleExtraTime}
            />
          ) : (
            <DashboardGroupedPanel
              items={reservationItems}
              view={view}
              selectedDate={selectedDate}
            />
          )}

          {view === 'daily' && <DashboardLegendBar />}
          {view === 'daily' && (
            <DashboardQueueBand
              entries={queueEntries}
              onCallNext={() => requestAction('call_next', '')}
              onCallEntry={(id) => requestAction('call', id)}
              onCompleteEntry={(id) => requestAction('complete', id)}
              onOpenManualAdd={handleOpenManualAdd}
            />
          )}
          {view === 'daily' && delays.length > 0 && (
            <DashboardDelaysPanel items={delays} totalPending={delaysPendingTotal} />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={dialogLabels ? t(dialogLabels.title) : ''}
        message={dialogLabels ? t(dialogLabels.message) : ''}
        confirmLabel={t('confirm_btn_confirm')}
        cancelLabel={t('confirm_btn_cancel')}
        variant={pending?.type === 'cancel' ? 'danger' : 'default'}
        loading={actionLoading}
        blocking
        onConfirm={executeAction}
        onCancel={() => { if (!actionLoading) setPending(null); }}
      />
    </div>
  );
}

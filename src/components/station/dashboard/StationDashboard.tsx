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
import { DashboardBayFilter, BayFilterMobilePills } from './DashboardBayFilter';
import { AgendaSlotDetailModal } from './AgendaSlotDetailModal';
import { StartServiceModal } from './StartServiceModal';
import { ManualQueueAddModal } from '../queue/ManualQueueAddModal';
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
  service?: { id: string; name: string; category: string } | null;
  walk_in_client_email?: string | null;
  walk_in_client_name?: string | null;
  is_walk_in?: boolean;
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

type DashboardAction = 'complete' | 'cancel';

interface PendingAction {
  type: DashboardAction;
  entryId: string;
}

function clientNameOf(entry: RawEntry): string {
  /* Walk-in (off-platform) clients added manually by the merchant:
   *   1. Display the name typed in the modal if any.
   *   2. Otherwise fall back to the typed email.
   * Registered clients (matched walk-ins included) use their account
   * first_name, and only as a last resort do we surface a placeholder
   * from the user_id. */
  const walkInName = entry.walk_in_client_name?.trim();
  if (walkInName) return walkInName;
  const walkInEmail = entry.walk_in_client_email?.trim();
  if (walkInEmail) return walkInEmail;
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
      serviceLabel: e.service?.name ?? e.vehicle_format?.label ?? undefined,
      price: e.amount_paid ? parseFloat(e.amount_paid) : undefined,
      isNext: false,
      status: e.status,
      isWalkIn: Boolean(e.is_walk_in),
    }));
  const waiting = raw
    .filter((e) => (ACTIVE_QUEUE_STATUSES as readonly string[]).includes(e.status))
    .sort((a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999))
    .map((e, idx): QueueEntry => ({
      id: e.id,
      position: e.queue_position ?? idx + 1,
      clientName: clientNameOf(e),
      entryType: e.entry_type,
      serviceLabel: e.service?.name ?? e.vehicle_format?.label ?? undefined,
      price: e.amount_paid ? parseFloat(e.amount_paid) : undefined,
      isNext: inProgress.length === 0 && idx === 0,
      status: e.status,
      isWalkIn: Boolean(e.is_walk_in),
    }));
  return [...inProgress, ...waiting];
}

function buildAgendaEntries(raw: RawEntry[]): AgendaEntry[] {
  return raw.map((e): AgendaEntry => ({
    id: e.id,
    clientName: clientNameOf(e),
    /* Prefer the merchant-set service name; the vehicle format becomes
     * a secondary descriptor surfaced in the agenda detail modal. */
    vehicleFormat: e.service?.name ?? e.vehicle_format?.label ?? null,
    status: e.status,
    slotStart: e.slot_start_time,
    slotEnd: e.slot_end_time,
    amountPaid: e.amount_paid ? parseFloat(e.amount_paid) : null,
    postId: e.post_id,
    isWalkIn: Boolean(e.is_walk_in),
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
      serviceName: e.service?.name ?? null,
      vehicleFormat: e.vehicle_format?.label ?? null,
      status: e.status,
      slotStart: e.slot_start_time ?? null,
      slotEnd: e.slot_end_time ?? null,
      amountPaid: e.amount_paid ? parseFloat(e.amount_paid) : null,
    }));
}

const ACTION_STATUS_MAP: Record<DashboardAction, string> = {
  complete: 'completed',
  cancel: 'cancelled',
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
  complete: { title: 'confirm_complete_title', message: 'confirm_complete_message' },
  cancel:   { title: 'confirm_cancel_title',   message: 'confirm_cancel_message' },
};

export function StationDashboard() {
  const { isLoading: authLoading } = useAuth();
  const { error: showError, info: showInfo, success: showSuccess } = useToast();
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
  /* Detail/start modals are local to the dashboard so the timeline stays a
   * pure presentational component. */
  const [detailEntry, setDetailEntry] = useState<AgendaEntry | null>(null);
  const [startEntry, setStartEntry] = useState<AgendaEntry | null>(null);
  const [manualAddOpen, setManualAddOpen] = useState(false);

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
    /* Open the dedicated walk-in modal. The modal fetches services + their
     * vehicle entries on its own and posts to /station/entries on confirm. */
    setManualAddOpen(true);
  }

  async function handleManualAddSuccess(_entryId: string) {
    void _entryId;
    setManualAddOpen(false);
    /* Refresh the dashboard data so the new walk-in shows up immediately
     * in the queue band / agenda. */
    await loadData();
    showSuccess(t('manual_queue_success'));
  }

  /** Starts a walk-in entry directly via PATCH (no code required) — the
   *  off-platform client never received a ticket. Used by both the
   *  agenda and queue start buttons. Returns true on success. */
  async function startWalkInDirectly(entryId: string): Promise<boolean> {
    const [ok, data] = await patchWithApi(`/station/entries/${entryId}`, { status: 'in_progress' });
    if (!mountedRef.current) return false;
    if (ok) {
      await loadData();
      return true;
    }
    const raw = (data as { message?: string })?.message ?? '';
    showError(raw.includes('Cannot transition') ? t('error_invalid_transition') : t('action_error_generic'));
    return false;
  }

  function requestStart(id: string) {
    /* Resolve the agenda entry so the modal can show client name + verify. */
    const entry = agendaEntries.find((e) => e.id === id);
    if (!entry) return;
    if (entry.isWalkIn) {
      /* Walk-in clients (matched or off-platform) never received a
       * 6-char ticket code, so the merchant starts the service straight
       * away without the verification modal. */
      void startWalkInDirectly(entry.id);
      return;
    }
    setStartEntry(entry);
  }

  function requestQueueStart(id: string) {
    const q = queueEntries.find((e) => e.id === id);
    if (!q) return;
    if (q.isWalkIn) {
      void startWalkInDirectly(q.id);
      return;
    }
    /* Real queue entries (client booked through the app) keep the
     * code-verification flow: synthesize an AgendaEntry for the modal. */
    setStartEntry({
      id: q.id,
      clientName: q.clientName,
      vehicleFormat: q.serviceLabel ?? null,
      status: q.status ?? 'pending',
      slotStart: null,
      slotEnd: null,
      amountPaid: q.price ?? null,
      postId: null,
    });
  }

  async function submitStartCode(code: string): Promise<{ ok: boolean; reason?: 'invalid_code' | 'generic' }> {
    if (!startEntry) return { ok: false, reason: 'generic' };
    const [ok, data] = await postWithApi(`/station/entries/${startEntry.id}/start`, { code });
    if (!mountedRef.current) return { ok: false, reason: 'generic' };
    if (ok) {
      await loadData();
      return { ok: true };
    }
    const payload = data as { message?: string; code?: string } | null;
    const isInvalidCode = payload?.code === 'VALIDATION_FAILED' && /code/i.test(payload?.message ?? '');
    return { ok: false, reason: isInvalidCode ? 'invalid_code' : 'generic' };
  }

  async function executeAction() {
    if (!pending || actionLoading) return;
    setActionLoading(true);

    try {
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

      {view === 'daily' && posts.length > 0 && (
        <BayFilterMobilePills
          posts={posts}
          selectedPostId={selectedPostId}
          onSelect={setSelectedPostId}
        />
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
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
              onSelectEntry={setDetailEntry}
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
              onStartEntry={requestQueueStart}
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

      <AgendaSlotDetailModal
        open={detailEntry !== null}
        entry={detailEntry}
        onClose={() => setDetailEntry(null)}
        onStart={requestStart}
        onComplete={(id) => requestAction('complete', id)}
        onCancel={(id) => requestAction('cancel', id)}
        onExtraTime={handleExtraTime}
      />

      <StartServiceModal
        open={startEntry !== null}
        clientName={startEntry?.clientName ?? ''}
        onClose={() => setStartEntry(null)}
        onSubmit={submitStartCode}
      />

      <ManualQueueAddModal
        isOpen={manualAddOpen}
        onClose={() => setManualAddOpen(false)}
        onSuccess={handleManualAddSuccess}
      />
    </div>
  );
}

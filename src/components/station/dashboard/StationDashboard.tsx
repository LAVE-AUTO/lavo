'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getFromApi, patchWithApi, postWithApi } from '@/services';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageLoader } from '@/components/ui/PageLoader';
import { DashboardKpiRow, type KpiData } from './DashboardKpiRow';
import { DashboardDateNav } from './DashboardDateNav';
import { DashboardQueuePanel } from './DashboardQueuePanel';
import { DashboardPostGrid, type Post, type PostEntry } from './DashboardPostGrid';
import { DashboardLegendBar } from './DashboardLegendBar';
import { DashboardDelaysPanel, type DashboardDelayItem } from './DashboardDelaysPanel';
import type { QueueEntry } from './QueueCard';

const DELAYS_PREVIEW_SIZE = 5;

interface RawDelayPreview {
  id: string;
  user_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'refused';
  created_at: string;
}

// All KPIs start as null so the UI shows a placeholder rather than a misleading 0
// before the first dashboard fetch resolves.
const EMPTY_KPI: KpiData = { revenue: null, clients: null, lateFees: null, occupancy: null };

interface RawEntry {
  id: string;
  user_id: string;
  entry_type: 'reservation' | 'queue';
  time_slot_id: string | null;
  station_id: string;
  vehicle_format_id: string | null;
  status: string;
  queue_position: number | null;
  amount_paid: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface RawConfig {
  config: { wash_post_count: number };
  posts: { id: string; position: number; is_active: boolean }[];
}

interface RawDashboard {
  total_revenue: string;
  total_clients: number;
  total_completed: number;
  average_rating: string | null;
  pending_count: number;
}

type DashboardAction = 'call' | 'complete' | 'cancel' | 'start' | 'call_next';

interface PendingAction {
  type: DashboardAction;
  entryId: string;
}

function buildQueueEntries(raw: RawEntry[]): QueueEntry[] {
  // Show in_progress first (being served), then pending (waiting), sorted by queue_position
  const inProgress = raw
    .filter((e) => e.status === 'in_progress')
    .map((e, idx): QueueEntry => ({
      id: e.id,
      position: 0,
      clientName: `Client #${e.user_id.slice(0, 4)}`,
      entryType: e.entry_type,
      price: e.amount_paid ? parseFloat(e.amount_paid) : undefined,
      isNext: idx === 0 && raw.filter((x) => x.status === 'pending').length === 0,
      status: e.status,
    }));
  const waiting = raw
    .filter((e) => e.status === 'pending')
    .sort((a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999))
    .map((e, idx): QueueEntry => ({
      id: e.id,
      position: e.queue_position ?? idx + 1,
      clientName: `Client #${e.user_id.slice(0, 4)}`,
      entryType: e.entry_type,
      price: e.amount_paid ? parseFloat(e.amount_paid) : undefined,
      isNext: inProgress.length === 0 && idx === 0,
      status: e.status,
    }));
  return [...inProgress, ...waiting];
}

function buildPosts(
  rawConfig: RawConfig,
  rawEntries: RawEntry[],
  serviceFallbackLabel: string,
  locale: string,
): Post[] {
  // /station/entries does not denormalize the service / vehicle / user info today.
  // Until the backend ships those fields (see project_pending_backend_specs.md),
  // we surface a neutral placeholder rather than inventing a fake service name.
  const inProgress = rawEntries.filter((e) => e.status === 'in_progress');
  return rawConfig.posts.map((post): Post => {
    const postEntries: PostEntry[] = inProgress
      .filter((_, i) => i % rawConfig.posts.length === rawConfig.posts.indexOf(post))
      .map((e): PostEntry => {
        const start = new Date(e.created_at);
        const startMin = start.getHours() * 60 + start.getMinutes();
        return {
          id: e.id,
          status: 'active',
          timeRange: start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
          serviceLabel: serviceFallbackLabel,
          clientName: `Client #${e.user_id.slice(0, 4)}`,
          price: e.amount_paid ? parseFloat(e.amount_paid) : undefined,
          startMinutes: startMin,
          // No reliable end time without service.duration on the entry — assume
          // 45 min as a visual placeholder. Replace with real duration once the
          // backend denormalizes service/duration on /station/entries.
          endMinutes: startMin + 45,
        };
      });
    return { id: post.id, position: post.position, isActive: post.is_active, entries: postEntries };
  });
}

const ACTION_STATUS_MAP: Partial<Record<DashboardAction, string>> = {
  call: 'in_progress',
  complete: 'completed',
  cancel: 'cancelled',
  start: 'in_progress',
};

export function StationDashboard() {
  const { isLoading: authLoading } = useAuth();
  const { error: showError } = useToast();
  const t = useTranslations('station_dashboard');
  const locale = useLocale();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const [kpi, setKpi] = useState<KpiData>(EMPTY_KPI);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [delays, setDelays] = useState<DashboardDelayItem[]>([]);
  const [delaysPendingTotal, setDelaysPendingTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function mapDashboardToKpi(raw: RawDashboard): KpiData {
    // Only map fields the backend actually returns. Late fees and occupancy/fill
    // rate are NOT exposed by /station/dashboard yet — leave them null so the UI
    // shows the "Bientôt disponible" placeholder instead of a fake number.
    // See project_pending_backend_specs.md → "Missing fields on /station/dashboard".
    const revenue = Number.parseFloat(raw.total_revenue ?? '');
    return {
      revenue: Number.isFinite(revenue) ? Math.round(revenue) : null,
      clients: typeof raw.total_clients === 'number' ? raw.total_clients : null,
      lateFees: null,
      occupancy: null,
    };
  }

  const loadData = useCallback(async () => {
    const [entriesResult, configResult, dashboardResult, delaysResult] = await Promise.all([
      getFromApi('/station/entries'),
      getFromApi('/station/config'),
      getFromApi('/station/dashboard'),
      getFromApi(`/station/delays?status=pending&per_page=${DELAYS_PREVIEW_SIZE}`),
    ]);

    const [entriesOk, entriesData] = entriesResult;
    const [configOk, configData] = configResult;
    const [dashboardOk, dashboardData] = dashboardResult;
    const [delaysOk, delaysData] = delaysResult;

    if (!mountedRef.current) return;

    if (entriesOk && configOk) {
      const raw = (entriesData as { data: { entries: RawEntry[] } }).data.entries ?? [];
      const config = (configData as { data: RawConfig }).data;
      setQueueEntries(buildQueueEntries(raw));
      setPosts(buildPosts(config, raw, t('post_unknown_service'), locale));
    }

    if (dashboardOk) {
      const dashboard = (dashboardData as { data?: RawDashboard })?.data;
      if (dashboard) {
        setKpi(mapDashboardToKpi(dashboard));
      }
    }

    if (delaysOk) {
      const payload = (delaysData as { data?: { items?: RawDelayPreview[]; meta?: { total?: number } } })?.data;
      const items = payload?.items ?? [];
      // /station/delays does not denormalize the user — show anonymised id until the
      // backend returns a name (see project_pending_backend_specs.md).
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
  }, [t, locale]);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  function requestAction(type: DashboardAction, entryId: string) {
    setPending({ type, entryId });
  }

  async function executeAction() {
    if (!pending) return;
    setActionLoading(true);

    // call_next hits a queue-scoped endpoint (promote the next waiting
    // entry); every other action targets a specific entry by id.
    if (pending.type === 'call_next') {
      const [ok, data] = await postWithApi('/station/queue/next', {});
      if (!mountedRef.current) return;
      setActionLoading(false);
      if (ok) {
        setPending(null);
        await loadData();
        return;
      }
      const payload = data as { message?: string; code?: string } | null;
      const errorMsg = payload?.code === 'NOT_FOUND'
        ? t('error_queue_empty')
        : t('action_error_generic');
      showError(errorMsg);
      setPending(null);
      return;
    }

    const newStatus = ACTION_STATUS_MAP[pending.type];
    const [ok, data] = await patchWithApi(`/station/entries/${pending.entryId}`, { status: newStatus });
    if (!mountedRef.current) return;
    setActionLoading(false);
    if (ok) {
      setPending(null);
      await loadData();
    } else {
      const raw = (data as { message?: string })?.message ?? '';
      // Translate the backend transition error into a user-friendly toast
      const errorMsg = raw.includes('Cannot transition')
        ? t('error_invalid_transition')
        : t('action_error_generic');
      showError(errorMsg);
      setPending(null);
    }
  }

  function confirmDialogTitle(): string {
    if (!pending) return '';
    const labels: Record<DashboardAction, string> = {
      call: t('confirm_call_title'),
      complete: t('confirm_complete_title'),
      cancel: t('confirm_cancel_title'),
      start: t('confirm_start_title'),
      call_next: t('confirm_call_next_title'),
    };
    return labels[pending.type];
  }

  function confirmDialogMessage(): string {
    if (!pending) return '';
    const labels: Record<DashboardAction, string> = {
      call: t('confirm_call_message'),
      complete: t('confirm_complete_message'),
      cancel: t('confirm_cancel_message'),
      start: t('confirm_start_message'),
      call_next: t('confirm_call_next_message'),
    };
    return labels[pending.type];
  }

  if (loading) {
    return <PageLoader label={t('loading')} />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      <DashboardKpiRow data={kpi} />
      <DashboardDateNav
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        view={view}
        onViewChange={setView}
      />
      <div className="flex flex-1 flex-col overflow-auto md:flex-row md:overflow-hidden">
        {/* Left column: queue + delays shortcut, stacked */}
        <div className="flex shrink-0 flex-col md:w-[280px] md:overflow-hidden">
          <DashboardQueuePanel
            entries={queueEntries}
            onCallEntry={(id) => requestAction('call', id)}
            onCompleteEntry={(id) => requestAction('complete', id)}
            onCallNext={() => requestAction('call_next', '')}
          />
          <DashboardDelaysPanel items={delays} totalPending={delaysPendingTotal} />
        </div>
        <DashboardPostGrid
          posts={posts}
          onCompleteEntry={(id) => requestAction('complete', id)}
          onCancelEntry={(id) => requestAction('cancel', id)}
          onStartEntry={(id) => requestAction('start', id)}
        />
      </div>
      <DashboardLegendBar />

      <ConfirmDialog
        open={pending !== null}
        title={confirmDialogTitle()}
        message={confirmDialogMessage()}
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

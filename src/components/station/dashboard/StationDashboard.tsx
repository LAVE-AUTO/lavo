'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, patchWithApi } from '@/services';
import { useAuth } from '@/context/auth-context';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DashboardKpiRow, type KpiData } from './DashboardKpiRow';
import { DashboardDateNav } from './DashboardDateNav';
import { DashboardQueuePanel } from './DashboardQueuePanel';
import { DashboardPostGrid, type Post, type PostEntry } from './DashboardPostGrid';
import { DashboardLegendBar } from './DashboardLegendBar';
import type { QueueEntry } from './QueueCard';

// TODO: connect to API once endpoint is available
const MOCK_KPI: KpiData = { revenue: 165, clients: 8, lateFees: 5, occupancy: 72 };

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

type DashboardAction = 'call' | 'complete' | 'cancel' | 'start';

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

function buildPosts(rawConfig: RawConfig, rawEntries: RawEntry[]): Post[] {
  const inProgress = rawEntries.filter((e) => e.status === 'in_progress');
  return rawConfig.posts.map((post): Post => {
    const postEntries: PostEntry[] = inProgress
      .filter((_, i) => i % rawConfig.posts.length === rawConfig.posts.indexOf(post))
      .map((e): PostEntry => ({
        id: e.id,
        status: 'active',
        timeRange: new Date(e.created_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }),
        serviceLabel: 'En cours',
        clientName: `Client #${e.user_id.slice(0, 4)}`,
        price: e.amount_paid ? parseFloat(e.amount_paid) : undefined,
      }));
    return { id: post.id, position: post.position, isActive: post.is_active, entries: postEntries };
  });
}

const ACTION_STATUS_MAP: Record<DashboardAction, string> = {
  call: 'in_progress',
  complete: 'completed',
  cancel: 'cancelled',
  start: 'in_progress',
};

export function StationDashboard() {
  const { isLoading: authLoading } = useAuth();
  const t = useTranslations('station_dashboard');
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [entriesOk, entriesData] = await getFromApi('/station/entries');
    const [configOk, configData] = await getFromApi('/station/config');
    if (!mountedRef.current) return;
    if (entriesOk && configOk) {
      const raw = (entriesData as { data: { entries: RawEntry[] } }).data.entries ?? [];
      const config = (configData as { data: RawConfig }).data;
      setQueueEntries(buildQueueEntries(raw));
      setPosts(buildPosts(config, raw));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  function requestAction(type: DashboardAction, entryId: string) {
    setActionError(null);
    setPending({ type, entryId });
  }

  async function executeAction() {
    if (!pending) return;
    setActionLoading(true);
    setActionError(null);
    const newStatus = ACTION_STATUS_MAP[pending.type];
    const [ok, data] = await patchWithApi(`/station/entries/${pending.entryId}`, { status: newStatus });
    if (!mountedRef.current) return;
    setActionLoading(false);
    if (ok) {
      setPending(null);
      await loadData();
    } else {
      const raw = (data as { message?: string })?.message ?? '';
      // Translate backend transition errors into a readable message
      const errorMsg = raw.includes('Cannot transition')
        ? t('error_invalid_transition')
        : raw || t('action_error_generic');
      setActionError(errorMsg);
    }
  }

  function confirmDialogTitle(): string {
    if (!pending) return '';
    const labels: Record<DashboardAction, string> = {
      call: t('confirm_call_title'),
      complete: t('confirm_complete_title'),
      cancel: t('confirm_cancel_title'),
      start: t('confirm_start_title'),
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
    };
    return labels[pending.type];
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C09A18] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      <DashboardKpiRow data={MOCK_KPI} />
      <DashboardDateNav
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        view={view}
        onViewChange={setView}
      />
      {actionError && (
        <div className="border-b border-[#E8472A]/20 bg-[#FEF2F2] px-5 py-2 text-[13px] font-medium text-[#E8472A] dark:border-[#E8472A]/20 dark:bg-[#2A0A0A] dark:text-[#F87171]">
          {actionError}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <DashboardQueuePanel
          entries={queueEntries}
          onCallEntry={(id) => requestAction('call', id)}
          onCompleteEntry={(id) => requestAction('complete', id)}
        />
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

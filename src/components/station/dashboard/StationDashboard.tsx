'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFromApi, patchWithApi } from '@/services';
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

function buildQueueEntries(raw: RawEntry[]): QueueEntry[] {
  return raw
    .filter((e) => e.status === 'pending')
    .sort((a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999))
    .map((e, idx): QueueEntry => ({
      id: e.id,
      position: e.queue_position ?? idx + 1,
      clientName: `Client #${e.user_id.slice(0, 4)}`,
      entryType: e.entry_type,
      price: e.amount_paid ? parseFloat(e.amount_paid) : undefined,
      isNext: idx === 0,
    }));
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

export function StationDashboard() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [entriesOk, entriesData] = await getFromApi('/station/entries');
    const [configOk, configData] = await getFromApi('/station/config');

    if (entriesOk && configOk) {
      const raw = (entriesData as { data: RawEntry[] }).data ?? [];
      const config = (configData as { data: RawConfig }).data;
      setQueueEntries(buildQueueEntries(raw));
      setPosts(buildPosts(config, raw));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCall(id: string) {
    await patchWithApi(`/station/entries/${id}`, { status: 'in_progress' });
    await loadData();
  }

  async function handleComplete(id: string) {
    await patchWithApi(`/station/entries/${id}`, { status: 'completed' });
    await loadData();
  }

  async function handleCancel(id: string) {
    await patchWithApi(`/station/entries/${id}`, { status: 'cancelled' });
    await loadData();
  }

  async function handleStart(id: string) {
    await patchWithApi(`/station/entries/${id}`, { status: 'in_progress' });
    await loadData();
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px]" style={{ color: '#8A8A7A' }}>
        Chargement...
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DashboardKpiRow data={MOCK_KPI} />
      <DashboardDateNav
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        view={view}
        onViewChange={setView}
      />
      <div className="flex flex-1 overflow-hidden">
        <DashboardQueuePanel entries={queueEntries} onCallEntry={handleCall} />
        <DashboardPostGrid
          posts={posts}
          onCompleteEntry={handleComplete}
          onCancelEntry={handleCancel}
          onStartEntry={handleStart}
        />
      </div>
      <DashboardLegendBar />
    </div>
  );
}

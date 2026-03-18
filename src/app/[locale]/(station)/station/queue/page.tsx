'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, patchWithApi } from '@/services';
import { QueueCard, type QueueEntry } from '@/components/station/dashboard/QueueCard';

interface RawEntry {
  id: string;
  user_id: string;
  entry_type: 'reservation' | 'queue';
  queue_position: number | null;
  status: string;
  amount_paid: string | null;
  created_at: string;
}

// TODO: connect to API once endpoint returns real data — remove mock fallback
const MOCK_QUEUE: QueueEntry[] = [
  { id: 'mock-q1', position: 1, clientName: 'Client #a1b2', entryType: 'reservation', time: '09:30', serviceLabel: 'Lavage Complet', price: 45, isNext: true },
  { id: 'mock-q2', position: 2, clientName: 'Client #c3d4', entryType: 'queue', time: '09:45', serviceLabel: 'Lavage Exterieur', price: 25, isNext: false },
  { id: 'mock-q3', position: 3, clientName: 'Client #e5f6', entryType: 'reservation', time: '10:00', serviceLabel: 'Lavage SUV', price: 55, isNext: false },
  { id: 'mock-q4', position: 4, clientName: 'Client #a7b8', entryType: 'queue', price: 30, isNext: false },
  { id: 'mock-q5', position: 5, clientName: 'Client #c9d0', entryType: 'queue', price: 28, isNext: false },
];

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

export default function StationQueuePage() {
  const t = useTranslations('station_dashboard');
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    const [ok, data] = await getFromApi('/station/entries');
    if (ok) {
      const raw = (data as { data: { entries: RawEntry[] } }).data.entries ?? [];
      const built = buildQueueEntries(raw);
      // TODO: remove mock fallback once real data is available
      setEntries(built.length > 0 ? built : MOCK_QUEUE);
    } else {
      setEntries(MOCK_QUEUE);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  async function handleCall(id: string) {
    const [ok] = await patchWithApi(`/station/entries/${id}`, { status: 'in_progress' });
    if (ok) {
      await loadEntries();
    } else {
      // TODO: remove local mock fallback once API is fully connected
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
  }

  const nextEntry = useMemo(() => entries.find((e) => e.isNext), [entries]);
  const restEntries = useMemo(() => entries.filter((e) => !e.isNext), [entries]);
  const reservedCount = entries.filter((e) => e.entryType === 'reservation').length;
  const walkInCount = entries.filter((e) => e.entryType === 'queue').length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#F5F5EE] dark:bg-[#0C1209]">
      {/* Header */}
      <div className="border-b border-[#E0DCD0] bg-white px-5 pb-4 pt-5 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[18px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('queue_title')}</h1>
            <p className="mt-0.5 text-[12px] text-[#888] dark:text-[#6A6A5A]">
              {entries.length > 0 ? t('queue_waiting', { n: entries.length }) : t('queue_empty')}
            </p>
          </div>
          {entries.length > 0 && (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <StatChip count={reservedCount} color="#2ECC71" label={t('queue_tag_reserved')} />
              <StatChip count={walkInCount} color="#3B82F6" label={t('queue_tag_app')} />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <QueueEmptyIcon />
            <span className="text-[13px] font-semibold text-[#999] dark:text-[#6A6A5A]">
              {t('queue_empty')}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row">
            {/* Left: next client (takes 40% on large screens) */}
            {nextEntry && (
              <div className="lg:w-2/5 lg:shrink-0">
                <QueueCard entry={nextEntry} onCall={handleCall} />
              </div>
            )}

            {/* Right: rest of the queue */}
            {restEntries.length > 0 && (
              <div className="flex flex-1 flex-col gap-2">
                {restEntries.map((entry) => (
                  <QueueCard key={entry.id} entry={entry} onCall={handleCall} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-[#F7F6F2] px-2.5 py-1.5 dark:bg-[#0F1A0C]">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span className="font-mono text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{count}</span>
      <span className="text-[9px] font-semibold text-[#888] dark:text-[#6A6A5A]">{label}</span>
    </div>
  );
}

const QueueEmptyIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="text-[#D8D4C8] dark:text-[#243020]">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
    <path d="M8 18h.01M12 18h.01M16 18h.01" />
  </svg>
);

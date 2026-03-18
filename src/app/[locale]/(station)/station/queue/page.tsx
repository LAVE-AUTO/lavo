'use client';

import { useState, useEffect, useCallback } from 'react';
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
  { id: 'mock-q3', position: 3, clientName: 'Client #e5f6', entryType: 'reservation', time: '10:00', serviceLabel: 'Lavage Complet SUV', price: 55, isNext: false },
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#F5F5EE] dark:bg-[#0C1209]">
      <div className="border-b border-[#E0DCD0] bg-white px-6 py-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <h1 className="text-[18px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('queue_title')}</h1>
        <p className="text-[12px] text-[#666] dark:text-[#8A8A7A]">
          {entries.length > 0 ? t('queue_waiting', { n: entries.length }) : t('queue_empty')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[13px] text-[#666] dark:text-[#8A8A7A]">
            Chargement...
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-[#666] dark:text-[#8A8A7A]">
            {t('queue_empty')}
          </div>
        ) : (
          <div className="mx-auto flex max-w-[480px] flex-col gap-3">
            {entries.map((entry) => (
              <QueueCard key={entry.id} entry={entry} onCall={handleCall} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
      const raw = (data as { data: RawEntry[] }).data ?? [];
      setEntries(buildQueueEntries(raw));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  async function handleCall(id: string) {
    await patchWithApi(`/station/entries/${id}`, { status: 'in_progress' });
    await loadEntries();
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

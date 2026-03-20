'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, patchWithApi, postWithApi } from '@/services';
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
      const raw = (data as { data: { entries: RawEntry[] } }).data.entries ?? [];
      setEntries(buildQueueEntries(raw));
    } else {
      setEntries([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  async function handleCall(id: string) {
    const [ok] = await patchWithApi(`/station/entries/${id}`, { status: 'in_progress' });
    if (ok) await loadEntries();
  }

  async function handlePick(id: string) {
    const [ok] = await postWithApi(`/stations/queue/${id}/pick`, {});
    if (ok) await loadEntries();
  }

  async function handleReorder(id: string, newPosition: number) {
    const [ok] = await patchWithApi(`/station/entries/${id}/position`, { queue_position: newPosition });
    if (ok) await loadEntries();
  }

  const nextEntry = useMemo(() => entries.find((e) => e.isNext), [entries]);
  const restEntries = useMemo(() => entries.filter((e) => !e.isNext), [entries]);
  const reservedCount = entries.filter((e) => e.entryType === 'reservation').length;
  const walkInCount = entries.filter((e) => e.entryType === 'queue').length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#EDEDED] dark:bg-[#1A2116]">
      {/* Header */}
      <div className="border-b border-[#CCCCCC] bg-[#E0E0D0] px-6 pb-4 pt-5 dark:border-[#3A4A36] dark:bg-[#243020]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('queue_title')}</h1>
            <p className="mt-0.5 text-[12px] text-[#000717]/50 dark:text-[#FFFFF0]/50">
              {entries.length > 0 ? t('queue_waiting', { n: entries.length }) : t('queue_empty')}
            </p>
          </div>
          {entries.length > 0 && (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <StatChip count={reservedCount} color="#00C851" label={t('queue_tag_reserved')} />
              <StatChip count={walkInCount} color="#0044FF" label={t('queue_tag_app')} />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C09A18] border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <QueueEmptyIcon />
            <span className="text-[13px] font-semibold text-[#000C1F]/40 dark:text-[#FFF8EC]/30">
              {t('queue_empty')}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row">
            {/* Left: next client */}
            {nextEntry && (
              <div className="lg:w-2/5 lg:shrink-0">
                <QueueCard entry={nextEntry} onCall={handleCall} />
              </div>
            )}

            {/* Right: rest of the queue */}
            {restEntries.length > 0 && (
              <div className="flex flex-1 flex-col gap-2.5">
                {restEntries.map((entry, idx) => (
                  <QueueCard
                    key={entry.id}
                    entry={entry}
                    onCall={handleCall}
                    onPick={entry.entryType === 'queue' ? handlePick : undefined}
                    onMoveUp={idx > 0 ? () => handleReorder(entry.id, entry.position - 1) : undefined}
                    onMoveDown={idx < restEntries.length - 1 ? () => handleReorder(entry.id, entry.position + 1) : undefined}
                  />
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
    <div className="flex items-center gap-1.5 rounded-[8px] bg-[#C8C8B4] px-3 py-1.5 dark:bg-[#1E2A1A]">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="font-mono text-[14px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{count}</span>
      <span className="text-[10px] font-semibold text-[#000717]/50 dark:text-[#FFFFF0]/50">{label}</span>
    </div>
  );
}

const QueueEmptyIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="text-[#000C1F]/15 dark:text-[#FFF8EC]/15">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
    <path d="M8 18h.01M12 18h.01M16 18h.01" />
  </svg>
);

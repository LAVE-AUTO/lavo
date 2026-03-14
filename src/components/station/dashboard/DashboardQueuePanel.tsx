'use client';

import { useTranslations } from 'next-intl';
import { QueueCard, type QueueEntry } from './QueueCard';

interface DashboardQueuePanelProps {
  entries: QueueEntry[];
  onCallEntry: (id: string) => void;
}

export function DashboardQueuePanel({ entries, onCallEntry }: DashboardQueuePanelProps) {
  const t = useTranslations('station_dashboard');

  return (
    <div
      className="flex w-[280px] flex-shrink-0 flex-col overflow-hidden border-r"
      style={{ background: '#182214', borderColor: '#1A2A14' }}
    >
      {/* Header */}
      <div className="border-b px-4 py-3.5" style={{ borderColor: '#1A2A14' }}>
        <div className="text-[14px] font-black" style={{ color: '#F0EDD4' }}>
          {t('queue_title')}
        </div>
        <div className="mt-0.5 text-[11px]" style={{ color: '#8A8A7A' }}>
          {entries.length > 0
            ? t('queue_waiting', { n: entries.length })
            : t('queue_empty')}
        </div>
      </div>

      {/* Entries */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {entries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[12px]" style={{ color: '#8A8A7A' }}>
            {t('queue_empty')}
          </div>
        ) : (
          entries.map((entry) => (
            <QueueCard key={entry.id} entry={entry} onCall={onCallEntry} />
          ))
        )}
      </div>
    </div>
  );
}

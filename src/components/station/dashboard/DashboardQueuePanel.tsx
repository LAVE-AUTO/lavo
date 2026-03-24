'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { QueueCard, type QueueEntry } from './QueueCard';

interface DashboardQueuePanelProps {
  entries: QueueEntry[];
  onCallEntry: (id: string) => void;
}

export function DashboardQueuePanel({ entries, onCallEntry }: DashboardQueuePanelProps) {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();

  const inProgressEntries = entries.filter((e) => e.isNext && e.position === 0);
  const waitingEntries = entries.filter((e) => e.position > 0 || !e.isNext);
  const waitingCount = entries.filter((e) => e.position > 0).length;

  return (
    <div className="flex w-[280px] flex-shrink-0 flex-col overflow-hidden border-r border-[#E0DCD0] bg-[#F0EDE0] dark:border-[#1A2A14] dark:bg-[#182214]">
      {/* Header */}
      <div className="border-b border-[#E0DCD0] px-4 py-3.5 dark:border-[#1A2A14]">
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
            {t('queue_title')}
          </div>
          <Link
            href={`/${locale}/station/queue`}
            className="text-[10px] font-bold text-[#C09A18] hover:text-[#D4A820] transition-colors"
          >
            {t('queue_see_all')} →
          </Link>
        </div>
        <div className="mt-0.5 text-[11px] text-[#666] dark:text-[#8A8A7A]">
          {waitingCount > 0
            ? t('queue_waiting', { n: waitingCount })
            : t('queue_empty')}
        </div>
      </div>

      {/* Entries */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {entries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-[#666] dark:text-[#8A8A7A]">
            {t('queue_empty')}
          </div>
        ) : (
          <>
            {inProgressEntries.map((entry) => (
              <QueueCard
                key={entry.id}
                entry={entry}
                onCall={onCallEntry}
                badgeColor="#00C851"
                badgeLabel={t('queue_in_progress_badge')}
                callLabel={t('queue_complete_now')}
              />
            ))}
            {waitingEntries.map((entry) => (
              <QueueCard key={entry.id} entry={entry} onCall={onCallEntry} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

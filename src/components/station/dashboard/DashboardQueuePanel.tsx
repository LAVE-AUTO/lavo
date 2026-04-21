'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { QueueCard, type QueueEntry } from './QueueCard';

interface DashboardQueuePanelProps {
  entries: QueueEntry[];
  onCallEntry: (id: string) => void;
  onCompleteEntry?: (id: string) => void;
}

export function DashboardQueuePanel({ entries, onCallEntry, onCompleteEntry }: DashboardQueuePanelProps) {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();

  // Fix: use entry.status directly instead of isNext + position heuristic
  const inProgressEntries = entries.filter((e) => e.status === 'in_progress');
  const waitingEntries = entries.filter((e) => e.status === 'pending');
  const waitingCount = waitingEntries.length;
  const totalCount = entries.length;

  return (
    <div className="flex w-full max-h-[40vh] flex-shrink-0 flex-col overflow-hidden border-b border-[#E0DCD0] bg-[#F0EDE0] md:max-h-none md:w-[280px] md:border-b-0 md:border-r dark:border-[#1A2A14] dark:bg-[#182214]">
      {/* Header */}
      <div className="border-b border-[#E0DCD0] px-4 py-3.5 dark:border-[#1A2A14]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-[14px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
              {t('queue_title')}
            </div>
            {totalCount > 0 && (
              <span className="rounded-full bg-[#C09A18] px-2 py-0.5 text-[10px] font-black text-[#0C1209] leading-tight">
                {totalCount}
              </span>
            )}
          </div>
          <Link
            href={`/${locale}/station/queue`}
            className="text-[11px] font-bold text-[#C09A18] hover:text-[#D4A820] transition-colors"
          >
            {t('queue_see_all')} →
          </Link>
        </div>
        <div className="mt-0.5 text-[12px] text-[#666] dark:text-[#A0A090]">
          {waitingCount > 0
            ? t('queue_waiting', { n: waitingCount })
            : t('queue_empty')}
        </div>
      </div>

      {/* Entries */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {entries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-[#666] dark:text-[#A0A090]">
            {t('queue_empty')}
          </div>
        ) : (
          <>
            {inProgressEntries.map((entry, idx) => (
              <div
                key={entry.id}
                className="animate-fade-in-up transition-all duration-150 hover:bg-[#E8E4D0] dark:hover:bg-[#1A2A14] rounded-2xl"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <QueueCard
                  entry={entry}
                  onCall={onCompleteEntry ?? onCallEntry}
                  badgeColor="#00C851"
                  badgeLabel={t('queue_in_progress_badge')}
                  callLabel={t('queue_complete_now')}
                />
              </div>
            ))}
            {waitingEntries.map((entry, idx) => (
              <div
                key={entry.id}
                className="animate-fade-in-up transition-all duration-150 hover:bg-[#E8E4D0] dark:hover:bg-[#1A2A14] rounded-2xl"
                style={{ animationDelay: `${(inProgressEntries.length + idx) * 60}ms` }}
              >
                <QueueCard entry={entry} onCall={onCallEntry} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

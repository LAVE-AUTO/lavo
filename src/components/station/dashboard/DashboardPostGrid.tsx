'use client';

import { useTranslations } from 'next-intl';

export interface PostEntry {
  id: string;
  status: 'done' | 'active' | 'waiting';
  timeRange: string;
  serviceLabel: string;
  clientName?: string;
  marginText?: string;
  price?: number;
}

export interface Post {
  id: string;
  position: number;
  isActive: boolean;
  entries: PostEntry[];
}

interface DashboardPostGridProps {
  posts: Post[];
  onCompleteEntry: (entryId: string) => void;
  onCancelEntry: (entryId: string) => void;
  onStartEntry: (entryId: string) => void;
}

const PlayIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const ChevronDoubleRight = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" />
  </svg>
);

const styleMap = {
  done: {
    bg: 'bg-[#E8E5CC] dark:bg-[#1A1A14]',
    border: 'border-[#CCCCAA] dark:border-[#3A3A2A]',
    badgeBg: '#DDD',
    badgeColor: '#555',
  },
  active: {
    bg: 'bg-[#E8F8EE] dark:bg-[#0A2A14]',
    border: 'border-[#2ECC71] dark:border-[#1E7A3E]',
    badgeBg: '#2ECC71',
    badgeColor: '#fff',
  },
  waiting: {
    bg: 'bg-[#EDE9CC] dark:bg-[#1A200A]',
    border: 'border-[#3B82F6] dark:border-[#2A4A18]',
    badgeBg: '#F59E0B',
    badgeColor: '#fff',
  },
};

function EntryBlock({ entry, onComplete, onCancel, onStart }: {
  entry: PostEntry;
  onComplete: () => void;
  onCancel: () => void;
  onStart: () => void;
}) {
  const t = useTranslations('station_dashboard');
  const style = styleMap[entry.status];

  const badgeLabel =
    entry.status === 'done'
      ? `\u2713 ${t('status_done')}`
      : entry.status === 'active'
      ? `\u23F1 ${t('status_active')}`
      : t('status_waiting');

  return (
    <div className={`rounded-xl border p-3 transition-all duration-200 hover:shadow-sm ${style.bg} ${style.border}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[9px] font-bold text-[#555] dark:text-[#F0EDD4]/60">
          {entry.timeRange}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-bold"
          style={{ background: style.badgeBg, color: style.badgeColor }}
        >
          {badgeLabel}
        </span>
        {entry.status === 'active' && (
          <button
            type="button"
            onClick={onComplete}
            className="ml-auto rounded-md bg-[#C49A1E] px-2 py-0.5 text-[9px] font-black text-[#0C1209] transition-opacity hover:opacity-80"
          >
            {t('btn_add_time')}
          </button>
        )}
        {entry.status === 'waiting' && (
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto rounded-md border border-[#EF4444] bg-[rgba(239,68,68,0.1)] px-2 py-0.5 text-[9px] font-bold text-[#EF4444] transition-opacity hover:opacity-80"
          >
            ! {t('btn_cancel')}
          </button>
        )}
      </div>
      <div className="mb-0.5 text-[11px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
        {entry.serviceLabel}{entry.price ? ` \u2022 ${entry.price}$` : ''}
      </div>
      {entry.clientName && (
        <div className="mb-1 text-[10px] text-[#666] dark:text-[#A0A090]">{entry.clientName}</div>
      )}
      {entry.marginText && (
        <div className="text-[9px] text-[#2ECC71]">{entry.marginText}</div>
      )}
      {entry.status === 'active' && (
        <button
          type="button"
          onClick={onComplete}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#C49A1E] py-2 text-[11px] font-black text-[#0C1209] transition-opacity hover:opacity-80"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10">
            <ChevronDoubleRight />
          </span>
          {t('btn_slide_complete')}
        </button>
      )}
      {entry.status === 'waiting' && (
        <button
          type="button"
          onClick={onStart}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#C49A1E] py-2 text-[11px] font-bold text-[#C49A1E] transition-opacity hover:opacity-80"
        >
          <PlayIcon />
          {t('btn_start')}
        </button>
      )}
    </div>
  );
}

export function DashboardPostGrid({ posts, onCompleteEntry, onCancelEntry, onStartEntry }: DashboardPostGridProps) {
  const t = useTranslations('station_dashboard');

  if (posts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-[#666] dark:text-[#A0A090]">
        {t('empty_post')}
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-auto">
      <div className="flex min-w-0 flex-1">
        {posts.map((post, colIdx) => (
          <div
            key={post.id}
            className="animate-fade-in flex flex-1 flex-col border-l border-[#E0DCD0] dark:border-[#1A2A14]"
            style={{ minWidth: 180, animationDelay: `${colIdx * 60}ms` }}
          >
            {/* Post header */}
            <div className="border-b border-[#E0DCD0] bg-[#F0EDE0] px-3 py-2.5 text-center dark:border-[#1A2A14] dark:bg-[#0C1209]">
              <div className="text-[13px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
                {t('filter_post', { n: post.position })}
              </div>
              <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-semibold">
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: post.isActive ? '#2ECC71' : '#3B82F6' }}
                />
                <span style={{ color: post.isActive ? '#2ECC71' : '#3B82F6' }}>
                  {post.isActive ? t('post_in_service') : t('post_available')}
                </span>
              </div>
            </div>

            {/* Entries */}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
              {post.entries.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-[18px] text-[#CCC] dark:text-[#2A3A20]">
                  {t('add_entry')}
                </div>
              ) : (
                post.entries.map((entry) => (
                  <EntryBlock
                    key={entry.id}
                    entry={entry}
                    onComplete={() => onCompleteEntry(entry.id)}
                    onCancel={() => onCancelEntry(entry.id)}
                    onStart={() => onStartEntry(entry.id)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

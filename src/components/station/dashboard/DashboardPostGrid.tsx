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

function EntryBlock({ entry, onComplete, onCancel, onStart }: {
  entry: PostEntry;
  onComplete: () => void;
  onCancel: () => void;
  onStart: () => void;
}) {
  const t = useTranslations('station_dashboard');

  const styleMap = {
    done: { bg: 'bg-[#E8E5CC]', border: 'border-[#CCCCAA]', badgeBg: '#DDD', badgeColor: '#555', badgeLabel: `\u2713 ${t('status_done')}` },
    active: { bg: 'bg-[#E8F8EE]', border: 'border-[#2ECC71]', badgeBg: '#2ECC71', badgeColor: '#fff', badgeLabel: `\u23F1 ${t('status_active')}` },
    waiting: { bg: 'bg-[#EDE9CC]', border: 'border-[#3B82F6]', badgeBg: '#F59E0B', badgeColor: '#fff', badgeLabel: t('status_waiting') },
  }[entry.status];

  return (
    <div className={`rounded-xl border p-3 ${styleMap.bg} ${styleMap.border}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[9px] font-bold text-[#555]">
          {entry.timeRange}
        </span>
        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: styleMap.badgeBg, color: styleMap.badgeColor }}>
          {styleMap.badgeLabel}
        </span>
        {entry.status === 'active' && (
          <button
            type="button"
            onClick={onComplete}
            className="ml-auto rounded-md bg-[#C49A1E] px-2 py-0.5 text-[9px] font-black text-[#0C1209]"
          >
            {t('btn_add_time')}
          </button>
        )}
        {entry.status === 'waiting' && (
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto rounded-md border border-[#EF4444] bg-[rgba(239,68,68,0.1)] px-2 py-0.5 text-[9px] font-bold text-[#EF4444]"
          >
            ! {t('btn_cancel')}
          </button>
        )}
      </div>
      <div className="mb-0.5 text-[11px] font-black text-[#1A1A0A]">
        {entry.serviceLabel}{entry.price ? ` • ${entry.price}$` : ''}
      </div>
      {entry.clientName && (
        <div className="mb-1 text-[10px] text-[#666]">{entry.clientName}</div>
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
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10">&gt;&gt;</span>
          {t('btn_slide_complete')}
        </button>
      )}
      {entry.status === 'waiting' && (
        <button
          type="button"
          onClick={onStart}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#C49A1E] py-2 text-[11px] font-bold text-[#C49A1E] transition-opacity hover:opacity-80"
        >
          &#9654; {t('btn_start')}
        </button>
      )}
    </div>
  );
}

export function DashboardPostGrid({ posts, onCompleteEntry, onCancelEntry, onStartEntry }: DashboardPostGridProps) {
  const t = useTranslations('station_dashboard');

  if (posts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-[#666] dark:text-[#8A8A7A]">
        {t('empty_post')}
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-auto">
      <div className="flex min-w-0 flex-1">
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex flex-1 flex-col border-l border-[#E0DCD0] dark:border-[#1A2A14]"
            style={{ minWidth: 180 }}
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

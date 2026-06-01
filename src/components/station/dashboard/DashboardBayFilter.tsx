'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AgendaPost } from './DashboardAgendaTimeline';

const PAGE_SIZE = 8;

interface Props {
  posts: AgendaPost[];
  selectedPostId: string | 'all';
  onSelect: (id: string | 'all') => void;
}

export function DashboardBayFilter({ posts, selectedPostId, onSelect }: Props) {
  const t = useTranslations('station_dashboard');
  const [cursor, setCursor] = useState(0);

  const active = posts.filter((p) => p.isActive).sort((a, b) => a.position - b.position);
  if (active.length === 0) return null;

  const totalPages = Math.ceil(active.length / PAGE_SIZE);
  const currentPage = Math.floor(cursor / PAGE_SIZE);
  const paginated = active.slice(cursor, cursor + PAGE_SIZE);
  const hasPrev = cursor > 0;
  const hasNext = cursor + PAGE_SIZE < active.length;

  function goNext() { setCursor((c) => Math.min(c + PAGE_SIZE, (totalPages - 1) * PAGE_SIZE)); }
  function goPrev() { setCursor((c) => Math.max(c - PAGE_SIZE, 0)); }

  return (
    <aside className="hidden w-[180px] flex-shrink-0 flex-col border-r border-[#FFF9EC] bg-[#FFF9EC] px-3 py-4 lg:flex dark:border-[#1A2A14] dark:bg-dark-bg">
      <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/55 dark:text-[#B0BFB1]">
        {t('filter_bay_title')}
      </div>

      <div className="flex flex-1 min-h-0 flex-col gap-1.5 overflow-y-auto pr-0.5">
        <BayItem
          active={selectedPostId === 'all'}
          onClick={() => onSelect('all')}
          label={t('filter_all_posts')}
        />
        {paginated.map((p) => (
          <BayItem
            key={p.id}
            active={selectedPostId === p.id}
            onClick={() => onSelect(p.id)}
            label={t('filter_post', { n: p.position })}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-1">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={goPrev}
            className="flex h-6 w-6 items-center justify-center rounded text-foreground/55 transition-colors hover:bg-[#E8E4D0] disabled:opacity-30 dark:text-[#B0BFB1] dark:hover:bg-[#001A05]"
            aria-label={t('filter_page_prev')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2L4 6l3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-[10px] font-medium text-[#999] dark:text-[#6A6A5A]">
            {currentPage + 1}/{totalPages}
          </span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={goNext}
            className="flex h-6 w-6 items-center justify-center rounded text-foreground/55 transition-colors hover:bg-[#E8E4D0] disabled:opacity-30 dark:text-[#B0BFB1] dark:hover:bg-[#001A05]"
            aria-label={t('filter_page_next')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2L8 6l-3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </aside>
  );
}

export function BayFilterMobilePills({ posts, selectedPostId, onSelect }: Props) {
  const t = useTranslations('station_dashboard');
  const active = posts.filter((p) => p.isActive).sort((a, b) => a.position - b.position);
  if (active.length === 0) return null;

  return (
    <div className="flex lg:hidden items-center gap-2 overflow-x-auto border-b border-separator bg-transparent px-4 py-2 scrollbar-hide dark:border-[#1A2A14] dark:bg-dark-bg">
      <MobilePill
        active={selectedPostId === 'all'}
        onClick={() => onSelect('all')}
        label={t('filter_all_posts')}
      />
      {active.map((p) => (
        <MobilePill
          key={p.id}
          active={selectedPostId === p.id}
          onClick={() => onSelect(p.id)}
          label={t('filter_post', { n: p.position })}
        />
      ))}
    </div>
  );
}

interface ItemProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function BayItem({ active, onClick, label }: ItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg px-3 py-2 text-left text-[12px] font-bold transition-all',
        active
          ? 'border border-[#DDAF3B] bg-[#DDAF3B]/10 text-[#DDAF3B]'
          : 'border border-transparent bg-[#EFECDE] text-foreground/65 hover:bg-[#E8E4D0] dark:bg-[#1A2A14] dark:text-[#B0BFB1] dark:hover:bg-[#001A05]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function MobilePill({ active, onClick, label }: ItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap',
        active
          ? 'border border-[#DDAF3B] bg-[#DDAF3B]/10 text-[#DDAF3B]'
          : 'border border-[#FFF9EC] bg-[#EFECDE] text-foreground/65 hover:bg-[#E8E4D0] dark:border-[#1A2A14] dark:bg-[#1A2A14] dark:text-[#B0BFB1] dark:hover:bg-[#001A05]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

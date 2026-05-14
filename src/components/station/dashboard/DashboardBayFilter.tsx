'use client';

import { useTranslations } from 'next-intl';
import type { AgendaPost } from './DashboardAgendaTimeline';

interface Props {
  posts: AgendaPost[];
  selectedPostId: string | 'all';
  onSelect: (id: string | 'all') => void;
}

export function DashboardBayFilter({ posts, selectedPostId, onSelect }: Props) {
  const t = useTranslations('station_dashboard');
  const active = posts.filter((p) => p.isActive).sort((a, b) => a.position - b.position);

  if (active.length === 0) return null;

  return (
    <aside className="hidden w-[180px] flex-shrink-0 flex-col border-r border-[#E0DCD0] bg-[#F7F6F2] px-3 py-4 lg:flex dark:border-[#1A2A14] dark:bg-[#0F1A0C]">
      <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#888] dark:text-[#9A9A8A]">
        {t('filter_bay_title')}
      </div>
      <div className="flex flex-col gap-1.5">
        <BayItem
          active={selectedPostId === 'all'}
          onClick={() => onSelect('all')}
          label={t('filter_all_posts')}
        />
        {active.map((p) => (
          <BayItem
            key={p.id}
            active={selectedPostId === p.id}
            onClick={() => onSelect(p.id)}
            label={t('filter_post', { n: p.position })}
          />
        ))}
      </div>
    </aside>
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
          ? 'border border-[#C49A1E] bg-[#C49A1E]/10 text-[#C49A1E]'
          : 'border border-transparent bg-[#EFECDE] text-[#666] hover:bg-[#E8E4D0] dark:bg-[#1A2A14] dark:text-[#A0A090] dark:hover:bg-[#243020]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { MOCK_STATIONS } from '@/data/stations-mock';
import { Spinner } from '@/components/ui/Spinner';
import { SearchBar } from './SearchBar';
import { StationCard } from './StationCard';
import type { Station } from '@/types/station';

type FilterKey = 'all' | 'available';

/**
 * Client-side station list view.
 * Uses static mock data (replace with API call when backend is ready).
 * Handles search filtering and splits results:
 * available stations on top, unavailable grayed at bottom.
 */
export function StationListView() {
  const t = useTranslations('stations');

  const [query, setQuery]   = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_STATIONS.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesFilter = filter === 'all' || s.availableSlots > 0;
      return matchesQuery && matchesFilter;
    });
  }, [query, filter]);

  const available   = filtered.filter((s) => s.availableSlots > 0);
  const unavailable = filtered.filter((s) => s.availableSlots === 0);

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all',       label: t('filter_all') },
    { key: 'available', label: t('filter_available') },
  ];

  return (
    <div className="animate-fade-in">
      {/* Search + filters */}
      <div className="mb-8 space-y-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('search_placeholder')}
        />
        <div className="flex gap-2">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={[
                'px-4 py-1.5 rounded-full text-[12px] font-bold transition-colors duration-150',
                filter === key
                  ? 'bg-gold text-[#1A2116]'
                  : 'bg-white dark:bg-dark-card text-lavo-muted border border-[#E0E0D0] dark:border-[#3A4A36] hover:border-gold',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t('empty_title')} desc={t('empty_desc')} />
      ) : (
        <div className="space-y-10">
          {available.length > 0 && (
            <section>
              <SectionLabel label={t('available_section')} count={available.length} accent />
              <StationGrid stations={available} unavailable={false} />
            </section>
          )}

          {unavailable.length > 0 && filter === 'all' && (
            <section>
              <SectionLabel label={t('unavailable_section')} count={unavailable.length} />
              <StationGrid stations={unavailable} unavailable />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Internal sub-components                                              */
/* ------------------------------------------------------------------ */

function SectionLabel({
  label,
  count,
  accent = false,
}: {
  label: string;
  count: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      {accent && <span className="w-1 h-5 rounded-full bg-gold shrink-0" />}
      <span className="text-[13px] font-bold text-[#1A1A1A] dark:text-white uppercase tracking-widest">
        {label}
      </span>
      <span className="text-[11px] text-lavo-muted font-semibold bg-[#F0F0E8] dark:bg-dark-card px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  );
}

function StationGrid({
  stations,
  unavailable,
}: {
  stations: Station[];
  unavailable: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {stations.map((station) => (
        <StationCard key={station.id} station={station} unavailable={unavailable} />
      ))}
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-[#F0F0E8] dark:bg-dark-card flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3A4A36" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <p className="text-[16px] font-bold text-[#1A1A1A] dark:text-white">{title}</p>
      <p className="text-[13px] text-lavo-muted max-w-xs leading-relaxed">{desc}</p>
    </div>
  );
}

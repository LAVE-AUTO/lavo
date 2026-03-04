'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { MOCK_STATIONS } from '@/data/stations-mock';
import { SearchBar } from './SearchBar';
import { StationCard } from './StationCard';
import type { StationDetailData } from '@/types/station';

type FilterKey = 'all' | 'available';

/**
 * Client-side station list view.
 * Dark design matching the HTML mockup's filter-bar and result-card aesthetic.
 * Uses static mock data (replace with API call when backend is ready).
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
      {/* Search + filter chips — matching HTML filter-bar style */}
      <div className="mb-6 space-y-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('search_placeholder')}
        />
        <div className="flex gap-1.5">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={[
                'px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors duration-150 whitespace-nowrap',
                filter === key
                  ? 'bg-gold text-[#1A2116]'
                  : 'bg-[#1E2A1A] text-[#9A9A8A]',
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
    <div className="flex items-center gap-3 mb-4">
      {accent && <span className="w-1 h-4 rounded-full bg-gold shrink-0" />}
      <span className="text-[12px] font-black text-white uppercase tracking-widest">
        {label}
      </span>
      <span className="text-[10px] text-[#9A9A8A] font-semibold bg-[#1E2A1A] px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  );
}

function StationGrid({
  stations,
  unavailable,
}: {
  stations: StationDetailData[];
  unavailable: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {stations.map((station) => (
        <StationCard key={station.id} station={station} unavailable={unavailable} />
      ))}
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-[#1E2A1A] flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3A4A36" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <p className="text-[16px] font-black text-white">{title}</p>
      <p className="text-[13px] text-[#9A9A8A] max-w-xs leading-relaxed">{desc}</p>
    </div>
  );
}

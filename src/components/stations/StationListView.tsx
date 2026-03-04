'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { MOCK_STATIONS } from '@/data/stations-mock';
import { SearchBar } from './SearchBar';
import { StationCard } from './StationCard';
import type { StationDetailData } from '@/types/station';

type SortKey    = 'default' | 'price_asc' | 'best_rated';
type FilterKey  = 'all' | 'available';

/**
 * Client-side station list view matching the HTML mockup design.
 * Dark filter chips + expandable filter panel with sort and city selection.
 */
export function StationListView() {
  const t = useTranslations('stations');

  const [query,       setQuery]       = useState('');
  const [filter,      setFilter]      = useState<FilterKey>('all');
  const [sort,        setSort]        = useState<SortKey>('default');
  const [cityFilter,  setCityFilter]  = useState<string>('all');
  const [panelOpen,   setPanelOpen]   = useState(false);

  /* Collect unique cities from data */
  const cities = useMemo(
    () => [...new Set(MOCK_STATIONS.map((s) => s.city))].sort(),
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let results = MOCK_STATIONS.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesFilter = filter === 'all' || s.availableSlots > 0;
      const matchesCity   = cityFilter === 'all' || s.city === cityFilter;
      return matchesQuery && matchesFilter && matchesCity;
    });

    if (sort === 'price_asc')   results = [...results].sort((a, b) => a.priceFrom - b.priceFrom);
    if (sort === 'best_rated')  results = [...results].sort((a, b) => b.rating - a.rating);

    return results;
  }, [query, filter, sort, cityFilter]);

  const available   = filtered.filter((s) => s.availableSlots > 0);
  const unavailable = filtered.filter((s) => s.availableSlots === 0);

  const sortChips: { key: SortKey; label: string }[] = [
    { key: 'default',    label: t('filter_all') },
    { key: 'price_asc',  label: t('filter_price_asc') },
    { key: 'best_rated', label: t('filter_best_rated') },
  ];

  /* Active filter count badge */
  const activeCount = (filter !== 'all' ? 1 : 0) + (cityFilter !== 'all' ? 1 : 0) + (sort !== 'default' ? 1 : 0);

  const handleReset = () => {
    setFilter('all');
    setSort('default');
    setCityFilter('all');
    setPanelOpen(false);
  };

  return (
    <div className="animate-fade-in">
      {/* Search + filter toggle */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder={t('search_placeholder')}
            />
          </div>
          {/* Filter toggle button */}
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className={[
              'relative flex items-center gap-1.5 px-3 py-2.5 rounded-[10px] text-[12px] font-bold transition-colors',
              panelOpen ? 'bg-gold text-[#1A2116]' : 'bg-[#2C3828] text-[#9A9A8A]',
            ].join(' ')}
            aria-expanded={panelOpen}
            aria-label={t('filter_panel_title')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            <span className="hidden sm:inline">Filtres</span>
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gold text-[#1A2116] text-[9px] font-black rounded-full flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* Sort chips row */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {sortChips.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={[
                'px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors duration-150',
                sort === key ? 'bg-gold text-[#1A2116]' : 'bg-[#1E2A1A] text-[#9A9A8A]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilter(filter === 'all' ? 'available' : 'all')}
            className={[
              'px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors duration-150',
              filter === 'available' ? 'bg-gold text-[#1A2116]' : 'bg-[#1E2A1A] text-[#9A9A8A]',
            ].join(' ')}
          >
            {t('filter_available')}
          </button>
        </div>

        {/* Expandable filter panel */}
        {panelOpen && (
          <div className="bg-[#1E2A1A] rounded-xl p-4 space-y-4 animate-fade-in border border-[#2C3828]">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-black text-white uppercase tracking-wider">
                {t('filter_panel_title')}
              </span>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] font-bold text-gold hover:text-gold-hover"
                >
                  {t('filter_reset')}
                </button>
              )}
            </div>

            {/* City filter */}
            <div>
              <p className="text-[10px] font-bold text-[#9A9A8A] uppercase tracking-wider mb-2">
                {t('filter_city_label')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCityFilter('all')}
                  className={[
                    'px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors',
                    cityFilter === 'all' ? 'bg-gold text-[#1A2116]' : 'bg-[#2C3828] text-[#9A9A8A]',
                  ].join(' ')}
                >
                  {t('filter_city_all')}
                </button>
                {cities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setCityFilter(city)}
                    className={[
                      'px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors',
                      cityFilter === city ? 'bg-gold text-[#1A2116]' : 'bg-[#2C3828] text-[#9A9A8A]',
                    ].join(' ')}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <p className="text-[10px] font-bold text-[#9A9A8A] uppercase tracking-wider mb-2">
                {t('filter_sort_label')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sortChips.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSort(key)}
                    className={[
                      'px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors',
                      sort === key ? 'bg-gold text-[#1A2116]' : 'bg-[#2C3828] text-[#9A9A8A]',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Availability toggle */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white">
                {t('filter_available')} uniquement
              </span>
              <button
                type="button"
                onClick={() => setFilter(filter === 'all' ? 'available' : 'all')}
                className={[
                  'relative w-10 h-5.5 rounded-full transition-colors duration-200',
                  filter === 'available' ? 'bg-gold' : 'bg-[#2C3828]',
                ].join(' ')}
                aria-pressed={filter === 'available'}
              >
                <span
                  className={[
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
                    filter === 'available' ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
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

function SectionLabel({ label, count, accent = false }: { label: string; count: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {accent && <span className="w-1 h-4 rounded-full bg-gold shrink-0" />}
      <span className="text-[12px] font-black text-white uppercase tracking-widest">{label}</span>
      <span className="text-[10px] text-[#9A9A8A] font-semibold bg-[#1E2A1A] px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  );
}

function StationGrid({ stations, unavailable }: { stations: StationDetailData[]; unavailable: boolean }) {
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

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services/axios-service';
import { Spinner } from '@/components/ui/Spinner';
import { SearchBar } from './SearchBar';
import { StationCard } from './StationCard';
import type { Station } from '@/types/station';
import type { ApiSuccessBody } from '@/types';

type FilterKey = 'all' | 'available';

/**
 * Client-side station list view.
 * Fetches stations from GET /stations, handles search filtering and
 * splits results: available stations on top, unavailable grayed at bottom.
 */
export function StationListView() {
  const t = useTranslations('stations');

  const [stations, setStations]   = useState<Station[]>([]);
  const [loading, setLoading]     = useState(true);
  const [hasError, setHasError]   = useState(false);
  const [query, setQuery]         = useState('');
  const [filter, setFilter]       = useState<FilterKey>('all');

  const fetchStations = async () => {
    setLoading(true);
    setHasError(false);
    const [ok, data] = await getFromApi<ApiSuccessBody<Station[]>>('/stations');
    setLoading(false);
    if (ok) {
      setStations((data as ApiSuccessBody<Station[]>).data ?? []);
    } else {
      setHasError(true);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stations.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesFilter = filter === 'all' || s.availableSlots > 0;
      return matchesQuery && matchesFilter;
    });
  }, [stations, query, filter]);

  const available   = filtered.filter((s) => s.availableSlots > 0);
  const unavailable = filtered.filter((s) => s.availableSlots === 0);

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all',       label: t('filter_all') },
    { key: 'available', label: t('filter_available') },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fade-in">
        <Spinner size="lg" />
        <p className="text-[14px] text-lavo-muted">{t('loading')}</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center animate-fade-in">
        <p className="text-[15px] font-semibold text-[#1A1A1A] dark:text-white">{t('error_load')}</p>
        <button
          type="button"
          onClick={fetchStations}
          className="px-6 py-2.5 bg-gold hover:bg-gold-hover rounded-[10px] text-[14px] font-bold text-[#1A2116] transition-colors"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Search + filters */}
      <div className="mb-6 space-y-3">
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
                  : 'bg-[#F0F0E8] dark:bg-dark-card text-lavo-muted dark:text-lavo-muted border border-[#E0E0D0] dark:border-[#3A4A36] hover:border-gold',
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
        <div className="space-y-8">
          {/* Available stations */}
          {available.length > 0 && (
            <section>
              <SectionLabel label={t('available_section')} count={available.length} />
              <StationGrid stations={available} unavailable={false} />
            </section>
          )}

          {/* Unavailable stations */}
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

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[13px] font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wide">
        {label}
      </span>
      <span className="text-[11px] text-lavo-muted font-semibold">({count})</span>
    </div>
  );
}

function StationGrid({ stations, unavailable }: { stations: Station[]; unavailable: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {stations.map((station) => (
        <StationCard key={station.id} station={station} unavailable={unavailable} />
      ))}
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center animate-fade-in">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3A4A36" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <p className="text-[16px] font-bold text-[#1A1A1A] dark:text-white">{title}</p>
      <p className="text-[13px] text-lavo-muted max-w-xs leading-relaxed">{desc}</p>
    </div>
  );
}

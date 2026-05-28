'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { fetchStations, type FetchStationsResult } from '@/services/station-api';
import { useUserLocation, requestUserLocation } from './useUserLocation';
import { SearchBar } from './SearchBar';
import { StationCard } from './StationCard';
import { PageSpinner } from '@/components/ui/PageSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  StationFilters,
  type StationFiltersState,
  type WashTypeOption,
  type VehicleFormatOption,
} from './StationFilters';
import type { StationDetailData } from '@/types/station';

type SortKey = 'default' | 'best_rated' | 'price_asc' | 'nearest';

interface StationListViewProps {
  washTypes: WashTypeOption[];
  vehicleFormats: VehicleFormatOption[];
}

export type { WashTypeOption, VehicleFormatOption } from './StationFilters';

const DEFAULT_FILTERS: StationFiltersState = {
  nameSearch:        '',
  onlyAvail:         false,
  selectedWashTypes: [],
  serviceScope:      '',
  formatId:          '',
  priceMin:          '',
  priceMax:          '',
  timeFrom:          '',
  timeTo:            '',
  distanceMinKm:     '',
  distanceMaxKm:     '',
  date:              '',
};

/** Convert "HHhMM - HHhMM" or "HH:MM - HH:MM" into [openMinutes, closeMinutes]. */
function parseOpeningHoursToMinutes(oh: string | undefined): { open: number; close: number } | null {
  if (!oh) return null;
  const parts = oh.split(/[–\-]/).map((s) => s.trim());
  if (parts.length !== 2) return null;
  const toMin = (s: string): number | null => {
    const m = s.match(/(\d{1,2})[:h](\d{2})?/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    if (Number.isNaN(h) || Number.isNaN(mm)) return null;
    return h * 60 + mm;
  };
  const open = toMin(parts[0]);
  const close = toMin(parts[1]);
  return open != null && close != null ? { open, close } : null;
}

function timeStringToMinutes(s: string): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return h * 60 + mm;
}

/**
 * Public station list with mixed backend + client-side filtering.
 *
 * Backend-driven (forwarded as query params to GET /stations):
 *   - q (merchant name), city, sort, wash_type_ids, service_scope, format_id
 *
 * Client-driven (no backend param yet):
 *   - "available only" toggle, price range, time window
 */
export function StationListView({ washTypes, vehicleFormats }: StationListViewProps) {
  const t = useTranslations('stations');
  const searchParams = useSearchParams();

  const userLocation = useUserLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [geocodedCoords, setGeocodedCoords] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  /* Stores the debounced query for which the user explicitly dismissed the geocoded result,
     so we don't immediately re-geocode the same term. Resets when the query changes. */
  const [geocodeDismissedFor, setGeocodeDismissedFor] = useState('');
  const [filters, setFilters] = useState<StationFiltersState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>('default');
  const [panelOpen, setPanelOpen] = useState(false);

  /* Desktop detection — false on SSR, updated after hydration. */
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /* Debounce the unified search query (name + city text search). */
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(id);
  }, [searchQuery]);

  /* Debounce the filter panel name search separately. */
  const [debouncedNameSearch, setDebouncedNameSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedNameSearch(filters.nameSearch.trim()), 350);
    return () => clearTimeout(id);
  }, [filters.nameSearch]);

  /* Silent background geocoding — runs after text debounce.
     Tries to resolve the search query to GPS coords for distance sorting.
     Fails silently: a station-name query like "AutoSpa" simply won't resolve. */
  useEffect(() => {
    if (!debouncedSearch || debouncedSearch === geocodeDismissedFor) {
      if (!debouncedSearch) setGeocodedCoords(null);
      setGeocoding(false);
      return;
    }
    let cancelled = false;
    setGeocoding(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(debouncedSearch)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'fr' } },
    )
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data: unknown) => {
        if (cancelled) return;
        const results = Array.isArray(data) ? data as Array<{ lat: string; lon: string }> : [];
        if (results.length > 0) {
          setGeocodedCoords({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), label: debouncedSearch });
        } else {
          setGeocodedCoords(null);
        }
      })
      .catch(() => { if (!cancelled) setGeocodedCoords(null); })
      .finally(() => { if (!cancelled) setGeocoding(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, geocodeDismissedFor]);

  /* API state */
  const [allStations, setAllStations] = useState<StationDetailData[]>([]);
  const [apiGroups, setApiGroups] = useState<FetchStationsResult['groups']>({
    available_now: [], most_appreciated: [], most_visited: [],
  });
  const [loading, setLoading] = useState(true);

  /* Fetch when any backend-driven filter changes. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params: Record<string, string> = {};
    /* Unified search: send as both q (name match) and city (location text match). */
    if (debouncedSearch)                       params.q = debouncedSearch;
    if (debouncedSearch)                       params.city = debouncedSearch;
    if (debouncedNameSearch)                   params.q = debouncedNameSearch; // filter-panel name overrides
    if (sort === 'best_rated')                 params.sort = 'rating_desc';
    if (sort === 'nearest' && (geocodedCoords || userLocation)) params.sort = 'distance_asc';
    if (filters.selectedWashTypes.length > 0)  params.wash_type_ids = filters.selectedWashTypes.join(',');
    if (filters.serviceScope)                  params.service_scope = filters.serviceScope;
    if (filters.formatId)                      params.format_id = filters.formatId;
    if (filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date)) params.date = filters.date;
    /* Geocoded address takes precedence over GPS for near_lat/near_lng. */
    const locationSource = geocodedCoords
      ? { latitude: geocodedCoords.lat, longitude: geocodedCoords.lng }
      : userLocation;
    if (locationSource) {
      params.near_lat = String(locationSource.latitude);
      params.near_lng = String(locationSource.longitude);
    }
    if (filters.distanceMinKm !== '') params.distance_min_km = filters.distanceMinKm;
    if (filters.distanceMaxKm !== '') params.distance_max_km = filters.distanceMaxKm;

    fetchStations(params).then((result) => {
      if (cancelled) return;
      setAllStations(result.stations);
      setApiGroups(result.groups);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [debouncedSearch, debouncedNameSearch, sort, filters.selectedWashTypes, filters.serviceScope, filters.formatId, filters.distanceMinKm, filters.distanceMaxKm, filters.date, userLocation, geocodedCoords]);

  /* Hydrate unified search from URL ?q= */
  useEffect(() => {
    const q = searchParams.get('q');
    if (q == null) return;
    const id = setTimeout(() => setSearchQuery(q), 0);
    return () => clearTimeout(id);
  }, [searchParams]);

  /* Client-side pipeline */
  const priceMinNum = filters.priceMin !== '' ? parseFloat(filters.priceMin) : null;
  const priceMaxNum = filters.priceMax !== '' ? parseFloat(filters.priceMax) : null;
  const timeFromMin = timeStringToMinutes(filters.timeFrom);
  const timeToMin   = timeStringToMinutes(filters.timeTo);

  const applyClientFilters = (list: StationDetailData[]) => {
    let out = list;
    if (filters.onlyAvail) out = out.filter((s) => s.availableSlots > 0);
    if (priceMinNum != null && Number.isFinite(priceMinNum)) {
      out = out.filter((s) => s.priceFrom != null && s.priceFrom >= priceMinNum);
    }
    if (priceMaxNum != null && Number.isFinite(priceMaxNum)) {
      out = out.filter((s) => s.priceFrom != null && s.priceFrom <= priceMaxNum);
    }
    if (timeFromMin != null || timeToMin != null) {
      out = out.filter((s) => {
        const range = parseOpeningHoursToMinutes(s.openingHours);
        if (!range) return false;
        if (timeFromMin != null && range.close <= timeFromMin) return false;
        if (timeToMin   != null && range.open  >= timeToMin)   return false;
        return true;
      });
    }
    const distMin = filters.distanceMinKm !== '' ? parseFloat(filters.distanceMinKm) : null;
    const distMax = filters.distanceMaxKm !== '' ? parseFloat(filters.distanceMaxKm) : null;
    if ((distMin != null || distMax != null) && userLocation) {
      out = out.filter((s) => {
        if (s.distanceKm == null) return false;
        if (distMin != null && s.distanceKm < distMin) return false;
        if (distMax != null && s.distanceKm > distMax) return false;
        return true;
      });
    }
    if (sort === 'price_asc') {
      out = [...out].sort((a, b) => {
        const ap = a.priceFrom ?? Number.POSITIVE_INFINITY;
        const bp = b.priceFrom ?? Number.POSITIVE_INFINITY;
        return ap - bp;
      });
    }
    return out;
  };

  const hasActiveSearch =
    debouncedSearch !== '' ||
    filters.selectedWashTypes.length > 0 || filters.serviceScope !== '' || filters.formatId !== '' ||
    priceMinNum != null || priceMaxNum != null ||
    timeFromMin != null || timeToMin != null ||
    filters.date !== '' || geocodedCoords != null ||
    sort !== 'default';

  const flatResults   = useMemo(() => applyClientFilters(allStations),                                                 [allStations, filters, sort, userLocation]);
  const availableNow  = useMemo(() => applyClientFilters(apiGroups.available_now.filter((s) => s.availableSlots > 0)), [apiGroups, filters, sort, userLocation]);
  const topRated      = useMemo(() => applyClientFilters(apiGroups.most_appreciated.filter((s) => s.reviewCount > 0)), [apiGroups, filters, sort, userLocation]);
  const mostRevisited = useMemo(() => applyClientFilters(apiGroups.most_visited.filter((s) => s.completedCount > 0)),  [apiGroups, filters, sort, userLocation]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const activeCount =
    (filters.onlyAvail ? 1 : 0) +
    (filters.nameSearch.trim() ? 1 : 0) +
    (filters.selectedWashTypes.length ? 1 : 0) +
    (filters.serviceScope ? 1 : 0) +
    (filters.formatId ? 1 : 0) +
    (priceMinNum != null || priceMaxNum != null ? 1 : 0) +
    (timeFromMin != null || timeToMin != null ? 1 : 0) +
    (filters.distanceMinKm !== '' || filters.distanceMaxKm !== '' ? 1 : 0) +
    (filters.date !== '' ? 1 : 0);

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setSort('default');
    setSearchQuery('');
    setGeocodedCoords(null);
    setGeocodeDismissedFor('');
    setPanelOpen(false);
  };

  const sortChips: { key: SortKey; label: string; icon?: string }[] = [
    { key: 'default',    label: t('filter_all') },
    { key: 'nearest',    label: t('filter_nearby') },
    { key: 'best_rated', label: t('filter_best_rated') },
    { key: 'price_asc',  label: t('filter_price_asc') },
  ];

  return (
    <div className="animate-fade-in">

      {/* Sticky controls */}
      <div className="sticky top-[58px] z-30 bg-[#EDEDED] dark:bg-dark-bg pb-3 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-3 space-y-3">
        {/* Unified search row + filter button */}
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchBar
              value={searchQuery}
              onChange={(v) => { setSearchQuery(v); setGeocodeDismissedFor(''); }}
              placeholder={t('search_unified_placeholder')}
            />
          </div>

          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            className={[
              'relative flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[14px] font-bold transition-colors cursor-pointer',
              panelOpen || activeCount > 0
                ? 'bg-gold text-dark-bg'
                : 'bg-[#E0E0D0] dark:bg-tab-inactive text-[#222] dark:text-[#D0D0C0] hover:bg-[#D0D0C0] dark:hover:bg-tab-inactive',
            ].join(' ')}
            aria-label={t('filter_panel_title')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            <span className="hidden sm:inline">{t('filter_panel_title')}</span>
            {activeCount > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-dark-bg text-gold text-[11px] font-black">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* Geocoded location pill — shown when background geocoding resolves */}
        {(geocoding && searchQuery) || geocodedCoords ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/15 border border-gold/30 text-[12.5px] font-semibold text-[#1A1A1A] dark:text-white max-w-[calc(100%-5rem)] overflow-hidden">
              {geocoding ? (
                <svg className="animate-spin shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
              )}
              <span className="truncate">
                {geocoding ? t('search_geocoding') : `${t('search_address_near_label')} : ${geocodedCoords?.label}`}
              </span>
            </span>
            {geocodedCoords && !geocoding && (
              <button
                type="button"
                onClick={() => { setGeocodedCoords(null); setGeocodeDismissedFor(debouncedSearch); }}
                className="text-[12px] font-bold text-gold hover:text-gold-hover transition-colors cursor-pointer shrink-0"
              >
                {t('search_address_clear')}
              </button>
            )}
          </div>
        ) : null}

        {/* Desktop: inline filter panel inside sticky bar */}
        {isDesktop && panelOpen && (
          <StationFilters
            inline
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            value={filters}
            onChange={setFilters}
            onReset={handleReset}
            washTypes={washTypes}
            vehicleFormats={vehicleFormats}
            activeCount={activeCount}
            hasLocation={userLocation != null}
          />
        )}

        {/* Sort + available pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-1 px-1">
          {sortChips.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={async () => {
                const next = sort === key ? 'default' : key;
                if (next === 'nearest' && !userLocation) {
                  await requestUserLocation();
                }
                setSort(next);
              }}
              className={[
                'py-1.5 px-3.5 rounded-full text-[13.5px] font-bold whitespace-nowrap transition-colors duration-150 shrink-0 flex items-center gap-1.5',
                sort === key && !(key === 'default' && filters.onlyAvail)
                  ? 'bg-gold text-dark-bg'
                  : 'bg-[#E0E0D0] dark:bg-dark-card text-[#222] dark:text-[#D0D0C0] hover:bg-[#D0D0C0] dark:hover:bg-tab-inactive',
              ].join(' ')}
            >
              {icon && <span aria-hidden="true">{icon}</span>}
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, onlyAvail: !f.onlyAvail }))}
            className={[
              'py-1.5 px-3.5 rounded-full text-[13.5px] font-bold whitespace-nowrap transition-colors duration-150 shrink-0',
              filters.onlyAvail
                ? 'bg-gold text-dark-bg'
                : 'bg-[#E0E0D0] dark:bg-dark-card text-[#222] dark:text-[#D0D0C0] hover:bg-[#D0D0C0] dark:hover:bg-tab-inactive',
            ].join(' ')}
          >
            {t('filter_available')}
          </button>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="py-1.5 px-3.5 rounded-full text-[13px] font-bold whitespace-nowrap text-gold hover:bg-gold/10 transition-colors shrink-0 underline underline-offset-2"
            >
              {t('filter_reset')}
            </button>
          )}
        </div>
      </div>

      {/* Mobile: modal sheet filter */}
      {!isDesktop && (
        <StationFilters
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          value={filters}
          onChange={setFilters}
          onReset={handleReset}
          washTypes={washTypes}
          vehicleFormats={vehicleFormats}
          activeCount={activeCount}
          hasLocation={userLocation != null}
        />
      )}

      {/* Results */}
      <div className="mt-4">
        {loading ? (
          <PageSpinner py="py-20" />
        ) : hasActiveSearch ? (
          flatResults.length === 0 ? (
            <EmptyState
              title={t('empty_title')}
              description={t('empty_desc')}
              icon={<EmptyIcon />}
            />
          ) : (
            <StationSection
              id="results"
              label={t('section_results')}
              stations={flatResults}
              expanded={!!expandedSections['results']}
              onToggle={() => setExpandedSections((s) => ({ ...s, results: !s['results'] }))}
              seeMoreLabel={t('see_more')}
              accent
            />
          )
        ) : availableNow.length === 0 && topRated.length === 0 && mostRevisited.length === 0 ? (
          <EmptyState title={t('empty_title')} description={t('empty_desc')} icon={<EmptyIcon />} />
        ) : (
          <div className="space-y-10">
            {availableNow.length > 0 && (
              <StationSection
                id="available_now" label={t('section_available_now')} stations={availableNow}
                expanded={!!expandedSections['available_now']}
                onToggle={() => setExpandedSections((s) => ({ ...s, available_now: !s['available_now'] }))}
                seeMoreLabel={t('see_more')} accent
              />
            )}
            {topRated.length > 0 && (
              <StationSection
                id="top_rated" label={t('section_top_rated')} stations={topRated}
                expanded={!!expandedSections['top_rated']}
                onToggle={() => setExpandedSections((s) => ({ ...s, top_rated: !s['top_rated'] }))}
                seeMoreLabel={t('see_more')} accent
              />
            )}
            {mostRevisited.length > 0 && (
              <StationSection
                id="most_revisited" label={t('section_most_revisited')} stations={mostRevisited}
                expanded={!!expandedSections['most_revisited']}
                onToggle={() => setExpandedSections((s) => ({ ...s, most_revisited: !s['most_revisited'] }))}
                seeMoreLabel={t('see_more')} accent
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section helper                                                       */
/* ------------------------------------------------------------------ */

interface StationSectionProps {
  id: string;
  label: string;
  stations: StationDetailData[];
  expanded: boolean;
  onToggle: () => void;
  seeMoreLabel: string;
  accent?: boolean;
}

function StationSection({ label, stations, expanded, onToggle, seeMoreLabel, accent = false }: StationSectionProps) {
  const sorted = useMemo(
    () => [...stations].sort((a, b) => (a.availableSlots > 0 ? 0 : 1) - (b.availableSlots > 0 ? 0 : 1)),
    [stations],
  );

  return (
    <section>
      <SectionHeader
        title={label}
        count={stations.length}
        accentBar={accent}
        className="mb-4 uppercase tracking-widest"
        action={stations.length > 3 ? (
          <button
            type="button"
            onClick={onToggle}
            className="text-[14px] font-bold text-gold hover:text-gold-hover transition-colors cursor-pointer"
          >
            {seeMoreLabel}
          </button>
        ) : undefined}
      />

      {expanded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((station) => (
            <StationCard key={station.id} station={station} unavailable={station.availableSlots === 0} />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
          {sorted.map((station) => (
            <div key={station.id} className="w-[280px] sm:w-[300px] shrink-0 snap-start">
              <StationCard station={station} unavailable={station.availableSlots === 0} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

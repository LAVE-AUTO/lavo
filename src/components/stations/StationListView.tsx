'use client';

import { useState, useMemo, useRef, useEffect, useId } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { fetchStations, type FetchStationsResult } from '@/services/station-api';
import { SearchBar } from './SearchBar';
import { StationCard } from './StationCard';
import { PageSpinner } from '@/components/ui/PageSpinner';
import { Toggle } from '@/components/ui/Toggle';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { StationDetailData } from '@/types/station';

type SortKey = 'default' | 'price_asc' | 'best_rated';

interface PriceRange {
  min: string;
  max: string;
}

/** Parse "HH:MM" → hour integer. */
function parseTimeHour(value: string): number | null {
  if (!value) return null;
  const h = parseInt(value.split(':')[0], 10);
  return isNaN(h) ? null : h;
}

/** Parse "07h00 – 20h00" or "07:00 - 20:00" → { open: 7, close: 20 } */
function parseOpeningHours(oh: string): { open: number; close: number } | null {
  const timeRegex = /(\d{1,2})[:h]/;
  const parts = oh.split(/[–\-]/).map((s) => s.trim());
  if (parts.length !== 2) return null;
  const openMatch  = parts[0].match(timeRegex);
  const closeMatch = parts[1].match(timeRegex);
  if (!openMatch || !closeMatch) return null;
  const open  = parseInt(openMatch[1],  10);
  const close = parseInt(closeMatch[1], 10);
  return isNaN(open) || isNaN(close) ? null : { open, close };
}

/**
 * Client-side station list view.
 * Main search bar filters by city. Filter panel allows filtering by merchant name.
 * Time range uses native <input type="time"> for keyboard + clock-picker support.
 */
export function StationListView() {
  const t            = useTranslations('stations');
  const searchParams = useSearchParams();

  /* Main search: city */
  const [cityQuery, setCityQuery] = useState('');

  /* Filter panel fields */
  const [nameSearch,         setNameSearch]         = useState('');
  const [onlyAvail,          setOnlyAvail]          = useState(false);
  const [sort,               setSort]               = useState<SortKey>('default');
  const [price,              setPrice]              = useState<PriceRange>({ min: '', max: '' });
  const [priceErrors,        setPriceErrors]        = useState({ min: '', max: '' });
  const [panelOpen,          setPanelOpen]          = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedVehicles,   setSelectedVehicles]   = useState<string[]>([]);
  const [selectedServices,   setSelectedServices]   = useState<string[]>([]);
  const [date,               setDate]               = useState('');
  const [timeFrom,           setTimeFrom]           = useState('');
  const [timeTo,             setTimeTo]             = useState('');

  /* API-fetched stations */
  const [allStations, setAllStations] = useState<StationDetailData[]>([]);
  const [apiGroups, setApiGroups] = useState<FetchStationsResult['groups']>({
    available_now:    [],
    most_appreciated: [],
    most_visited:     [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchStations().then((result) => {
      if (cancelled) return;
      setAllStations(result.stations);
      setApiGroups(result.groups);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  /* Sync city query from URL param (?q=) */
  useEffect(() => {
    const q = searchParams.get('q');
    if (q == null) return;
    const id = setTimeout(() => setCityQuery(q), 0);
    return () => clearTimeout(id);
  }, [searchParams]);

  /* Price validation */
  const validateAndSetMin = (val: string) => {
    setPrice((p) => ({ ...p, min: val }));
    const num = parseFloat(val);
    if (val !== '' && num < 0) {
      setPriceErrors((e) => ({ ...e, min: t('filter_price_error_min') }));
    } else {
      setPriceErrors((e) => ({ ...e, min: '' }));
    }
  };

  const validateAndSetMax = (val: string) => {
    setPrice((p) => ({ ...p, max: val }));
    const maxNum = parseFloat(val);
    const minNum = parseFloat(price.min);
    if (val !== '' && !isNaN(minNum) && maxNum < minNum) {
      setPriceErrors((e) => ({ ...e, max: t('filter_price_error_max') }));
    } else {
      setPriceErrors((e) => ({ ...e, max: '' }));
    }
  };

  /* Derived filter options */
  const allCategories = useMemo(
    () => [...new Set(allStations.flatMap((s) => s.tags))].sort(),
    [allStations],
  );
  const allServices = useMemo(
    () => [...new Set(allStations.flatMap((s) => s.services))].sort(),
    [allStations],
  );
  const allVehicleTypes = useMemo(
    () => [
      t('vehicle_type_sedan'),
      t('vehicle_type_suv'),
      t('vehicle_type_motorcycle'),
      t('vehicle_type_van'),
    ],
    [t],
  );

  /* Toggle helpers */
  const toggleCategory = (c: string) =>
    setSelectedCategories((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  const toggleVehicle = (v: string) =>
    setSelectedVehicles((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  const toggleService = (s: string) =>
    setSelectedServices((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  /* Filtered + sorted results */
  const filtered = useMemo(() => {
    const cityQ  = cityQuery.trim().toLowerCase();
    const nameQ  = nameSearch.trim().toLowerCase();
    const minNum = parseFloat(price.min);
    const maxNum = parseFloat(price.max);
    const fromH  = parseTimeHour(timeFrom);
    const toH    = parseTimeHour(timeTo);

    let results = allStations.filter((s) => {
      const matchesCity = !cityQ || s.city.toLowerCase().includes(cityQ) || s.address.toLowerCase().includes(cityQ);
      const matchesName = !nameQ || s.name.toLowerCase().includes(nameQ) || s.tags.some((tag) => tag.toLowerCase().includes(nameQ));
      const matchesAvail      = !onlyAvail || s.availableSlots > 0;
      const matchesMin        = isNaN(minNum) || price.min === '' || s.priceFrom >= minNum;
      const matchesMax        = isNaN(maxNum) || price.max === '' || s.priceFrom <= maxNum;
      const matchesCategories = !selectedCategories.length || selectedCategories.some((c) => s.tags.includes(c));
      const matchesVehicles   = !selectedVehicles.length  || selectedVehicles.some((v) => s.vehicleTypes?.includes(v));
      const matchesServices   = !selectedServices.length  || selectedServices.some((sv) => s.services.includes(sv));
      const matchesTime       = (() => {
        if (fromH === null && toH === null) return true;
        if (!s.openingHours) return true;
        const parsed = parseOpeningHours(s.openingHours);
        if (!parsed) return true;
        const effectiveFrom = fromH ?? 0;
        const effectiveTo   = toH   ?? 23;
        return parsed.open <= effectiveTo && parsed.close >= effectiveFrom;
      })();

      return matchesCity && matchesName && matchesAvail && matchesMin && matchesMax
        && matchesCategories && matchesVehicles && matchesServices && matchesTime;
    });

    if (sort === 'price_asc')  results = [...results].sort((a, b) => a.priceFrom - b.priceFrom);
    if (sort === 'best_rated') results = [...results].sort((a, b) => b.rating - a.rating);

    return results;
  }, [cityQuery, nameSearch, onlyAvail, sort, price, selectedCategories, selectedVehicles, selectedServices, timeFrom, timeTo, allStations]);

  /* Derived section lists */
  const hasFilters = cityQuery.trim() || nameSearch.trim() || onlyAvail || price.min !== '' || price.max !== ''
    || selectedCategories.length > 0 || selectedVehicles.length > 0 || selectedServices.length > 0
    || timeFrom !== '' || timeTo !== '';
  const availableNow  = useMemo(
    () => (hasFilters ? filtered : apiGroups.available_now).filter((s) => s.availableSlots > 0),
    [filtered, hasFilters, apiGroups],
  );
  const topRated      = useMemo(() => hasFilters ? [...filtered].sort((a, b) => b.rating - a.rating)          : apiGroups.most_appreciated, [filtered, hasFilters, apiGroups]);
  const mostRevisited = useMemo(() => hasFilters ? [...filtered].sort((a, b) => b.reviewCount - a.reviewCount) : apiGroups.most_visited,     [filtered, hasFilters, apiGroups]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const sortChips: { key: SortKey; label: string }[] = [
    { key: 'default',    label: t('filter_all') },
    { key: 'price_asc',  label: t('filter_price_asc') },
    { key: 'best_rated', label: t('filter_best_rated') },
  ];

  const activeCount =
    (onlyAvail ? 1 : 0) +
    (nameSearch.trim() ? 1 : 0) +
    (sort !== 'default' ? 1 : 0) +
    (price.min !== '' || price.max !== '' ? 1 : 0) +
    (selectedCategories.length ? 1 : 0) +
    (selectedVehicles.length ? 1 : 0) +
    (selectedServices.length ? 1 : 0) +
    (date ? 1 : 0) +
    (timeFrom !== '' || timeTo !== '' ? 1 : 0);

  const handleReset = () => {
    setOnlyAvail(false);
    setSort('default');
    setNameSearch('');
    setPrice({ min: '', max: '' });
    setPriceErrors({ min: '', max: '' });
    setSelectedCategories([]);
    setSelectedVehicles([]);
    setSelectedServices([]);
    setDate('');
    setTimeFrom('');
    setTimeTo('');
    setPanelOpen(false);
  };

  return (
    <div className="animate-fade-in">
      {/* -- Search + filter toggle (sticky below navbar) -- */}
      <div className="sticky top-16 z-30 bg-[#EDEDED] dark:bg-dark-bg pb-3 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-3 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchBar value={cityQuery} onChange={setCityQuery} placeholder={t('search_city_placeholder')} />
          </div>

          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className={[
              'relative flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-[15px] font-bold transition-colors',
              panelOpen
                ? 'bg-gold text-dark-bg'
                : 'bg-[#E0E0D0] dark:bg-tab-inactive text-[#222] dark:text-[#D0D0C0] hover:bg-[#D0D0C0] dark:hover:bg-tab-inactive',
            ].join(' ')}
            aria-expanded={panelOpen}
            aria-label={t('filter_panel_title')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            <span className="hidden sm:inline">{t('filter_panel_title')}</span>
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gold text-dark-bg text-[13px] font-black rounded-full flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* -- Quick sort chips -- */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {sortChips.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={[
                'py-1.5 px-3.5 rounded-full text-[14px] font-bold whitespace-nowrap transition-colors duration-150 shrink-0',
                sort === key
                  ? 'bg-gold text-dark-bg'
                  : 'bg-[#E0E0D0] dark:bg-dark-card text-[#222] dark:text-[#D0D0C0] hover:bg-[#D0D0C0] dark:hover:bg-tab-inactive',
              ].join(' ')}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setOnlyAvail((v) => !v)}
            className={[
              'py-1.5 px-3.5 rounded-full text-[14px] font-bold whitespace-nowrap transition-colors duration-150 shrink-0',
              onlyAvail
                ? 'bg-gold text-dark-bg'
                : 'bg-[#E0E0D0] dark:bg-dark-card text-[#222] dark:text-[#D0D0C0] hover:bg-[#D0D0C0] dark:hover:bg-tab-inactive',
            ].join(' ')}
          >
            {t('filter_available')}
          </button>
        </div>

        {/* -- Expandable filter panel -- */}
        {panelOpen && (
          <div className="bg-white dark:bg-dark-card rounded-xl p-4 space-y-4 animate-fade-in border border-[#E0E0D0] dark:border-tab-inactive shadow-sm">

            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-[13px] sm:text-[15px] font-black text-[#1A1A1A] dark:text-white uppercase tracking-wider">
                {t('filter_panel_title')}
              </span>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[13px] sm:text-[14px] font-bold text-gold hover:text-gold-hover transition-colors"
                >
                  {t('filter_reset')}
                </button>
              )}
            </div>

            {/* Row 1: Merchant name + Available only */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] sm:text-[13px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-1.5">
                  {t('filter_name_label')}
                </label>
                <input
                  type="text"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  placeholder={t('filter_name_placeholder')}
                  className="w-full px-2.5 sm:px-3 py-2 rounded-lg bg-[#F5F5EE] dark:bg-tab-inactive border border-[#E0E0D0] dark:border-tab-inactive text-[13px] sm:text-[14px] text-[#1A1A1A] dark:text-white placeholder-[#9A9A8A] outline-none focus:border-gold transition-colors"
                />
              </div>
              <div>
                <p className="text-[11px] sm:text-[13px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-1.5">
                  {t('filter_available_only')}
                </p>
                <div className="h-[34px] flex items-center px-2.5 sm:px-3 rounded-lg border border-[#E0E0D0] dark:border-tab-inactive bg-[#F5F5EE] dark:bg-tab-inactive">
                  <Toggle checked={onlyAvail} onChange={setOnlyAvail} />
                </div>
              </div>
            </div>

            {/* Row 2: Price range */}
            <div>
              <label className="block text-[11px] sm:text-[13px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-1.5">
                {t('filter_price_label')}
              </label>
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <input
                    type="number"
                    min={0}
                    value={price.min}
                    onChange={(e) => validateAndSetMin(e.target.value)}
                    placeholder={t('filter_price_min_placeholder')}
                    className={[
                      'w-full px-2.5 sm:px-3 py-2 rounded-lg bg-[#F5F5EE] dark:bg-tab-inactive border text-[13px] sm:text-[14px] text-[#1A1A1A] dark:text-white placeholder-[#9A9A8A] outline-none transition-colors',
                      priceErrors.min
                        ? 'border-lavo-error focus:border-lavo-error'
                        : 'border-[#E0E0D0] dark:border-tab-inactive focus:border-gold',
                    ].join(' ')}
                  />
                  {priceErrors.min && (
                    <p className="text-[11px] text-lavo-error mt-1">{priceErrors.min}</p>
                  )}
                </div>
                <div className="pt-2 text-[#555] dark:text-[#B0B0A0] text-[13px] font-bold">&mdash;</div>
                <div className="flex-1">
                  <input
                    type="number"
                    min={0}
                    value={price.max}
                    onChange={(e) => validateAndSetMax(e.target.value)}
                    placeholder={t('filter_price_max_placeholder')}
                    className={[
                      'w-full px-2.5 sm:px-3 py-2 rounded-lg bg-[#F5F5EE] dark:bg-tab-inactive border text-[13px] sm:text-[14px] text-[#1A1A1A] dark:text-white placeholder-[#9A9A8A] outline-none transition-colors',
                      priceErrors.max
                        ? 'border-lavo-error focus:border-lavo-error'
                        : 'border-[#E0E0D0] dark:border-tab-inactive focus:border-gold',
                    ].join(' ')}
                  />
                  {priceErrors.max && (
                    <p className="text-[11px] text-lavo-error mt-1">{priceErrors.max}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Categories + Vehicles */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] sm:text-[13px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-1.5">
                  {t('filter_categories_label')}
                </p>
                <CustomMultiSelect
                  options={allCategories}
                  selected={selectedCategories}
                  onToggle={toggleCategory}
                  placeholder={t('filter_categories_placeholder')}
                />
              </div>
              <div>
                <p className="text-[11px] sm:text-[13px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-1.5">
                  {t('filter_vehicle_label')}
                </p>
                <CustomMultiSelect
                  options={allVehicleTypes}
                  selected={selectedVehicles}
                  onToggle={toggleVehicle}
                  placeholder={t('filter_vehicle_placeholder')}
                />
              </div>
            </div>

            {/* Row 4: Services + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] sm:text-[13px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-1.5">
                  {t('filter_service_label')}
                </p>
                <CustomMultiSelect
                  options={allServices}
                  selected={selectedServices}
                  onToggle={toggleService}
                  placeholder={t('filter_service_placeholder')}
                />
              </div>
              <div>
                <label className="block text-[11px] sm:text-[13px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-1.5">
                  {t('filter_date_label')}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={[
                    'w-full px-2.5 sm:px-3 py-2 rounded-lg border text-[13px] sm:text-[14px] outline-none transition-all duration-150 cursor-pointer',
                    date
                      ? 'border-gold bg-gold/5 dark:bg-gold/10 text-[#1A1A1A] dark:text-white'
                      : 'border-[#E0E0D0] dark:border-tab-inactive bg-[#F5F5EE] dark:bg-tab-inactive text-[#1A1A1A] dark:text-white',
                  ].join(' ')}
                />
              </div>
            </div>

            {/* Row 5: Time range — native time inputs */}
            <div>
              <p className="text-[11px] sm:text-[13px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-1.5">
                {t('filter_time_label')}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[12px] sm:text-[13px] font-semibold text-[#555] dark:text-[#B0B0A0] shrink-0">
                  {t('filter_time_from')}
                </span>
                <div className="flex-1">
                  <TimeInput value={timeFrom} onChange={setTimeFrom} />
                </div>
                <span className="text-[#AAA] dark:text-[#555] text-[13px] font-bold shrink-0">—</span>
                <span className="text-[12px] sm:text-[13px] font-semibold text-[#555] dark:text-[#B0B0A0] shrink-0">
                  {t('filter_time_to')}
                </span>
                <div className="flex-1">
                  <TimeInput value={timeTo} onChange={setTimeTo} />
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <PageSpinner py="py-20" />
      ) : availableNow.length === 0 && topRated.length === 0 && mostRevisited.length === 0 ? (
        <EmptyState
          title={t('empty_title')}
          description={t('empty_desc')}
          icon={
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          }
        />
      ) : (
        <div className="space-y-10">
          {availableNow.length > 0 && (
            <StationSection
              id="available_now"
              label={t('section_available_now')}
              stations={availableNow}
              expanded={!!expandedSections['available_now']}
              onToggle={() => setExpandedSections((s) => ({ ...s, available_now: !s['available_now'] }))}
              seeMoreLabel={t('see_more')}
              accent
            />
          )}
          {topRated.length > 0 && (
            <StationSection
              id="top_rated"
              label={t('section_top_rated')}
              stations={topRated}
              expanded={!!expandedSections['top_rated']}
              onToggle={() => setExpandedSections((s) => ({ ...s, top_rated: !s['top_rated'] }))}
              seeMoreLabel={t('see_more')}
              accent
            />
          )}
          {mostRevisited.length > 0 && (
            <StationSection
              id="most_revisited"
              label={t('section_most_revisited')}
              stations={mostRevisited}
              expanded={!!expandedSections['most_revisited']}
              onToggle={() => setExpandedSections((s) => ({ ...s, most_revisited: !s['most_revisited'] }))}
              seeMoreLabel={t('see_more')}
              accent
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Station section                                                      */
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
  /* Unavailable stations (no slots) are pushed to the bottom of each section. */
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
        action={
          stations.length > 3 ? (
            <button
              type="button"
              onClick={onToggle}
              className="text-[14px] font-bold text-gold hover:text-gold-hover transition-colors cursor-pointer"
            >
              {seeMoreLabel}
            </button>
          ) : undefined
        }
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

/* ------------------------------------------------------------------ */
/* Time input — native HTML5 time picker                               */
/* ------------------------------------------------------------------ */

interface TimeInputProps {
  value: string;
  onChange: (val: string) => void;
}

function TimeInput({ value, onChange }: TimeInputProps) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        'w-full px-2 py-2 rounded-lg border text-[13px] sm:text-[14px] font-semibold outline-none transition-all duration-150 cursor-pointer',
        value
          ? 'border-gold bg-gold/5 dark:bg-gold/10 text-[#1A1A1A] dark:text-white'
          : 'border-[#E0E0D0] dark:border-tab-inactive bg-[#F5F5EE] dark:bg-tab-inactive text-[#555] dark:text-[#C0C0B0]',
      ].join(' ')}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Custom multi-select                                                  */
/* ------------------------------------------------------------------ */

interface CustomMultiSelectProps {
  options: string[];
  selected: string[];
  onToggle: (opt: string) => void;
  placeholder: string;
}

function CustomMultiSelect({ options, selected, onToggle, placeholder }: CustomMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref       = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const triggerLabel =
    selected.length === 0 ? placeholder
    : selected.length === 1 ? selected[0]
    : `${selected[0]} +${selected.length - 1}`;

  const isActive = open || selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={[
          'w-full flex items-center justify-between px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-lg border text-[13px] sm:text-[14px] font-semibold transition-all duration-150 select-none',
          isActive
            ? 'border-gold bg-gold/5 dark:bg-gold/10 text-[#1A1A1A] dark:text-white'
            : 'border-[#E0E0D0] dark:border-tab-inactive bg-[#F5F5EE] dark:bg-tab-inactive text-[#555] dark:text-[#C0C0B0]',
        ].join(' ')}
      >
        <span className={`truncate ${selected.length > 0 ? 'text-[#1A1A1A] dark:text-white' : ''}`}>{triggerLabel}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 ml-1 transition-transform duration-200 ${open ? 'rotate-180 text-gold' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white dark:bg-dark-surface border border-[#E0E0D0] dark:border-tab-inactive rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 max-h-52 overflow-y-auto animate-fade-in"
        >
          {options.map((opt) => {
            const isSel = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onToggle(opt)}
                role="option"
                aria-selected={isSel}
                className={[
                  'w-full flex items-center justify-between px-3.5 py-2.5 text-[14px] font-semibold text-left transition-colors duration-100',
                  isSel
                    ? 'text-gold bg-gold/5 dark:bg-gold/10'
                    : 'text-[#1A1A1A] dark:text-white hover:bg-[#F5F5EE] dark:hover:bg-tab-inactive',
                ].join(' ')}
              >
                <span>{opt}</span>
                {isSel && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-gold">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

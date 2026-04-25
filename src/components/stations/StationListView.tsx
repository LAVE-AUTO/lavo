'use client';

import { useState, useMemo, useRef, useEffect, useId } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { fetchStations, type FetchStationsResult } from '@/services/station-api';
import { SearchBar } from './SearchBar';
import { StationCard } from './StationCard';
import { LocationPermissionBanner } from './LocationPermissionBanner';
import { PageSpinner } from '@/components/ui/PageSpinner';
import { Toggle } from '@/components/ui/Toggle';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { StationDetailData } from '@/types/station';

type SortKey = 'default' | 'best_rated';
// TODO: re-enable 'price_asc' once GET /stations exposes a station-level
// price floor (current list payload has no formats, so priceFrom is always 0).

type ServiceScope = '' | 'exterior' | 'interior' | 'both';

export interface WashTypeOption {
  id: string;
  code: string;
  label: string;
}

interface StationListViewProps {
  washTypes: WashTypeOption[];
}

/* ------------------------------------------------------------------ */
/*  Commented-out helpers — kept for when the backend list payload     */
/*  carries openingHours / formats again.                              */
/* ------------------------------------------------------------------ */
/* function parseTimeHour(value: string): number | null {
 *   if (!value) return null;
 *   const h = parseInt(value.split(':')[0], 10);
 *   return isNaN(h) ? null : h;
 * }
 * function parseOpeningHours(oh: string): { open: number; close: number } | null {
 *   const timeRegex = /(\d{1,2})[:h]/;
 *   const parts = oh.split(/[–\-]/).map((s) => s.trim());
 *   if (parts.length !== 2) return null;
 *   const openMatch  = parts[0].match(timeRegex);
 *   const closeMatch = parts[1].match(timeRegex);
 *   if (!openMatch || !closeMatch) return null;
 *   const open  = parseInt(openMatch[1],  10);
 *   const close = parseInt(closeMatch[1], 10);
 *   return isNaN(open) || isNaN(close) ? null : { open, close };
 * }
 */

/**
 * Public station list with backend-driven filtering.
 * The main search bar drives the `city` query param; the filter panel
 * drives `q` (merchant name), `sort`, `wash_type_ids` and `service_scope`.
 * Only the "available only" toggle runs client-side because the API has
 * no dedicated param for it.
 */
export function StationListView({ washTypes }: StationListViewProps) {
  const t            = useTranslations('stations');
  const searchParams = useSearchParams();

  /* Main search bar — city */
  const [cityQuery, setCityQuery] = useState('');

  /* Filter panel fields — backend-driven */
  const [nameSearch,         setNameSearch]         = useState('');
  const [onlyAvail,          setOnlyAvail]          = useState(false);
  const [sort,               setSort]               = useState<SortKey>('default');
  const [selectedWashTypes,  setSelectedWashTypes]  = useState<string[]>([]);
  const [serviceScope,       setServiceScope]       = useState<ServiceScope>('');
  const [panelOpen,          setPanelOpen]          = useState(false);

  /* Commented-out filters — UI + state disabled until backend exposes the
   * matching data (prices via formats in list payload, wash category tags,
   * vehicle types, date/slot filter, per-station opening hours).
   *
   * const [price, setPrice]                         = useState({ min: '', max: '' });
   * const [priceErrors, setPriceErrors]             = useState({ min: '', max: '' });
   * const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
   * const [selectedVehicles, setSelectedVehicles]     = useState<string[]>([]);
   * const [selectedServices, setSelectedServices]     = useState<string[]>([]);
   * const [date, setDate]                             = useState('');
   * const [timeFrom, setTimeFrom]                     = useState('');
   * const [timeTo, setTimeTo]                         = useState('');
   */

  /* Debounced text inputs — avoid a fetch on every keystroke. */
  const [debouncedText, setDebouncedText] = useState({ city: '', q: '' });
  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedText({ city: cityQuery.trim(), q: nameSearch.trim() }),
      350,
    );
    return () => clearTimeout(id);
  }, [cityQuery, nameSearch]);

  /* API-fetched list + groups */
  const [allStations, setAllStations] = useState<StationDetailData[]>([]);
  const [apiGroups, setApiGroups] = useState<FetchStationsResult['groups']>({
    available_now:    [],
    most_appreciated: [],
    most_visited:     [],
  });
  const [loading, setLoading] = useState(true);

  /* Fetch stations whenever a filter changes. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params: Record<string, string> = {};
    if (debouncedText.q)                   params.q = debouncedText.q;
    if (debouncedText.city)                params.city = debouncedText.city;
    if (sort === 'best_rated')             params.sort = 'rating_desc';
    if (selectedWashTypes.length > 0)      params.wash_type_ids = selectedWashTypes.join(',');
    if (serviceScope)                      params.service_scope = serviceScope;

    fetchStations(params).then((result) => {
      if (cancelled) return;
      setAllStations(result.stations);
      setApiGroups(result.groups);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [debouncedText, sort, selectedWashTypes, serviceScope]);

  /* Sync city query from URL param (?q=) — `q` here is a synonym coming from the landing search. */
  useEffect(() => {
    const q = searchParams.get('q');
    if (q == null) return;
    const id = setTimeout(() => setCityQuery(q), 0);
    return () => clearTimeout(id);
  }, [searchParams]);

  /* Toggle helper for wash_type multi-select */
  const toggleWashType = (id: string) =>
    setSelectedWashTypes((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  /* Layered client-side rules on top of the backend response:
     - Section qualification (backend sorts but does not exclude empties):
       * available_now    → availableSlots > 0 (redundant w/ backend, defensive)
       * most_appreciated → reviewCount > 0 (hide unrated stations)
       * most_visited     → completedCount > 0 (hide never-visited stations)
     - User-driven "available only" toggle applies to every visible list.

     Discovery mode (no active search/sort) shows the three category sections;
     as soon as the user searches, picks a filter or selects a sort chip the UI
     collapses into a single "Résultats" list so the effect of the chosen sort
     is immediately visible — `allStations` is already ordered by the backend. */
  const filterAvail = (list: StationDetailData[]) =>
    onlyAvail ? list.filter((s) => s.availableSlots > 0) : list;

  const hasActiveSearch =
    debouncedText.q !== '' ||
    debouncedText.city !== '' ||
    selectedWashTypes.length > 0 ||
    serviceScope !== '' ||
    sort !== 'default';

  const flatResults   = useMemo(() => filterAvail(allStations),                                          [allStations,          onlyAvail]);
  const availableNow  = useMemo(() => filterAvail(apiGroups.available_now.filter((s) => s.availableSlots > 0)),    [apiGroups, onlyAvail]);
  const topRated      = useMemo(() => filterAvail(apiGroups.most_appreciated.filter((s) => s.reviewCount > 0)),     [apiGroups, onlyAvail]);
  const mostRevisited = useMemo(() => filterAvail(apiGroups.most_visited.filter((s) => s.completedCount > 0)),      [apiGroups, onlyAvail]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const sortChips: { key: SortKey; label: string }[] = [
    { key: 'default',    label: t('filter_all') },
    /* { key: 'price_asc',  label: t('filter_price_asc') }, // TODO re-enable when backend exposes priceFrom */
    { key: 'best_rated', label: t('filter_best_rated') },
  ];

  const activeCount =
    (onlyAvail ? 1 : 0) +
    (nameSearch.trim() ? 1 : 0) +
    (sort !== 'default' ? 1 : 0) +
    (selectedWashTypes.length ? 1 : 0) +
    (serviceScope ? 1 : 0);

  const handleReset = () => {
    setOnlyAvail(false);
    setSort('default');
    setNameSearch('');
    setSelectedWashTypes([]);
    setServiceScope('');
    setPanelOpen(false);
  };

  return (
    <div className="animate-fade-in">
      {/* -- Pre-prompt banner before triggering the native geolocation dialog -- */}
      <LocationPermissionBanner />

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

            {/* Row 2: Wash types + Service scope */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] sm:text-[13px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-1.5">
                  {t('filter_wash_type_label')}
                </p>
                <CustomMultiSelect
                  options={washTypes.map((w) => ({ value: w.id, label: w.label }))}
                  selected={selectedWashTypes}
                  onToggle={toggleWashType}
                  placeholder={t('filter_wash_type_placeholder')}
                />
              </div>
              <div>
                <p className="block text-[11px] sm:text-[13px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-1.5">
                  {t('filter_scope_label')}
                </p>
                <CustomSelect
                  value={serviceScope}
                  onChange={(v) => setServiceScope(v as ServiceScope)}
                  placeholder={t('filter_scope_all')}
                  options={[
                    { value: '',         label: t('filter_scope_all') },
                    { value: 'exterior', label: t('filter_scope_exterior') },
                    { value: 'interior', label: t('filter_scope_interior') },
                    { value: 'both',     label: t('filter_scope_both') },
                  ]}
                />
              </div>
            </div>

            {/* ----------------------------------------------------------
             * Filtres désactivés — à réactiver quand le backend expose les
             * données correspondantes dans GET /stations :
             *   - Fourchette de prix (min/max) → requiert formats dans la liste
             *   - Catégories (tags), Services, Types de véhicule → requièrent
             *     des champs dédiés ou un dérivé wash_types-based
             *   - Date → `date` param déjà supporté mais non branché ici
             *   - Plage horaire → requiert openingHours dans la liste
             * Les states, composants (TimeInput) et markup originaux ont été
             * retirés pour ne pas alourdir le rendu ; le git history contient
             * la version complète pour restauration.
             * -------------------------------------------------------- */}

          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <PageSpinner py="py-20" />
      ) : hasActiveSearch ? (
        flatResults.length === 0 ? (
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
/* Custom multi-select                                                  */
/* ------------------------------------------------------------------ */

interface MultiSelectOption {
  value: string;
  label: string;
}

interface CustomMultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onToggle: (value: string) => void;
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

  const selectedLabels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  const triggerLabel =
    selectedLabels.length === 0 ? placeholder
    : selectedLabels.length === 1 ? selectedLabels[0]
    : `${selectedLabels[0]} +${selectedLabels.length - 1}`;

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

      {open && options.length === 0 && (
        <div
          id={listboxId}
          className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white dark:bg-dark-surface border border-[#E0E0D0] dark:border-tab-inactive rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 px-3.5 py-3 text-[13px] text-[#555] dark:text-[#B0B0A0] animate-fade-in"
        >
          —
        </div>
      )}

      {open && options.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white dark:bg-dark-surface border border-[#E0E0D0] dark:border-tab-inactive rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 max-h-52 overflow-y-auto animate-fade-in"
        >
          {options.map((opt) => {
            const isSel = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggle(opt.value)}
                role="option"
                aria-selected={isSel}
                className={[
                  'w-full flex items-center justify-between px-3.5 py-2.5 text-[14px] font-semibold text-left transition-colors duration-100',
                  isSel
                    ? 'text-gold bg-gold/5 dark:bg-gold/10'
                    : 'text-[#1A1A1A] dark:text-white hover:bg-[#F5F5EE] dark:hover:bg-tab-inactive',
                ].join(' ')}
              >
                <span>{opt.label}</span>
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

/* ------------------------------------------------------------------ */
/* Custom select — single value, same visual language as MultiSelect   */
/* ------------------------------------------------------------------ */

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function CustomSelect({ options, value, onChange, placeholder }: CustomSelectProps) {
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

  const selectedOption = options.find((o) => o.value === value);
  const triggerLabel   = selectedOption && value ? selectedOption.label : placeholder;
  const isActive       = open || value !== '';

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
        <span className={`truncate ${value ? 'text-[#1A1A1A] dark:text-white' : ''}`}>{triggerLabel}</span>
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
          className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white dark:bg-dark-surface border border-[#E0E0D0] dark:border-tab-inactive rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 max-h-60 overflow-y-auto animate-fade-in"
        >
          {options.map((opt) => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                role="option"
                aria-selected={isSel}
                className={[
                  'w-full flex items-center justify-between px-3.5 py-2.5 text-[14px] font-semibold text-left transition-colors duration-100',
                  isSel
                    ? 'text-gold bg-gold/5 dark:bg-gold/10'
                    : 'text-[#1A1A1A] dark:text-white hover:bg-[#F5F5EE] dark:hover:bg-tab-inactive',
                ].join(' ')}
              >
                <span>{opt.label}</span>
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

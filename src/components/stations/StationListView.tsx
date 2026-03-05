'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { MOCK_STATIONS } from '@/data/stations-mock';
import { SearchBar } from './SearchBar';
import { StationCard } from './StationCard';
import type { StationDetailData } from '@/types/station';

type SortKey   = 'default' | 'price_asc' | 'best_rated';

interface PriceRange {
  min: string;
  max: string;
}

/**
 * Client-side station list view.
 * Dark/light mode aware. Filter panel uses text inputs (city, price range) and
 * a proper toggle switch for availability. Sort chips stay in the quick row.
 */
export function StationListView() {
  const t = useTranslations('stations');

  const [query,       setQuery]       = useState('');
  const [onlyAvail,  setOnlyAvail]   = useState(false);
  const [sort,        setSort]        = useState<SortKey>('default');
  const [cityInput,   setCityInput]   = useState('');
  const [price,       setPrice]       = useState<PriceRange>({ min: '', max: '' });
  const [priceErrors, setPriceErrors] = useState({ min: '', max: '' });
  const [panelOpen,   setPanelOpen]   = useState(false);

  /* ── Price validation ── */
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

  /* ── Filtered + sorted results ── */
  const filtered = useMemo(() => {
    const q       = query.trim().toLowerCase();
    const city    = cityInput.trim().toLowerCase();
    const minNum  = parseFloat(price.min);
    const maxNum  = parseFloat(price.max);

    let results = MOCK_STATIONS.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.tags.some((tag) => tag.toLowerCase().includes(q));

      const matchesAvail = !onlyAvail || s.availableSlots > 0;
      const matchesCity  = !city || s.city.toLowerCase().includes(city);
      const matchesMin   = isNaN(minNum) || price.min === '' || s.priceFrom >= minNum;
      const matchesMax   = isNaN(maxNum) || price.max === '' || s.priceFrom <= maxNum;

      return matchesQuery && matchesAvail && matchesCity && matchesMin && matchesMax;
    });

    if (sort === 'price_asc')  results = [...results].sort((a, b) => a.priceFrom - b.priceFrom);
    if (sort === 'best_rated') results = [...results].sort((a, b) => b.rating - a.rating);

    return results;
  }, [query, onlyAvail, sort, cityInput, price]);

  const available   = filtered.filter((s) => s.availableSlots > 0);
  const unavailable = filtered.filter((s) => s.availableSlots === 0);

  const sortChips: { key: SortKey; label: string }[] = [
    { key: 'default',    label: t('filter_all') },
    { key: 'price_asc',  label: t('filter_price_asc') },
    { key: 'best_rated', label: t('filter_best_rated') },
  ];

  /* Active filter count */
  const activeCount =
    (onlyAvail ? 1 : 0) +
    (cityInput.trim() ? 1 : 0) +
    (sort !== 'default' ? 1 : 0) +
    (price.min !== '' || price.max !== '' ? 1 : 0);

  const handleReset = () => {
    setOnlyAvail(false);
    setSort('default');
    setCityInput('');
    setPrice({ min: '', max: '' });
    setPriceErrors({ min: '', max: '' });
    setPanelOpen(false);
  };

  return (
    <div className="animate-fade-in">
      {/* -- Search + filter toggle -- */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchBar value={query} onChange={setQuery} placeholder={t('search_placeholder')} />
          </div>

          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className={[
              'relative flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-[15px] font-bold transition-colors',
              panelOpen
                ? 'bg-gold text-[#1A2116]'
                : 'bg-[#E0E0D0] dark:bg-[#2C3828] text-[#222] dark:text-[#D0D0C0] hover:bg-[#D0D0C0] dark:hover:bg-[#3A4A36]',
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
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gold text-[#1A2116] text-[13px] font-black rounded-full flex items-center justify-center">
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
                  ? 'bg-gold text-[#1A2116]'
                  : 'bg-[#E0E0D0] dark:bg-[#1E2A1A] text-[#222] dark:text-[#D0D0C0] hover:bg-[#D0D0C0] dark:hover:bg-[#2C3828]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}

          {/* Quick available toggle chip */}
          <button
            type="button"
            onClick={() => setOnlyAvail((v) => !v)}
            className={[
              'py-1.5 px-3.5 rounded-full text-[14px] font-bold whitespace-nowrap transition-colors duration-150 shrink-0',
              onlyAvail
                ? 'bg-gold text-[#1A2116]'
                : 'bg-[#E0E0D0] dark:bg-[#1E2A1A] text-[#222] dark:text-[#D0D0C0] hover:bg-[#D0D0C0] dark:hover:bg-[#2C3828]',
            ].join(' ')}
          >
            {t('filter_available')}
          </button>
        </div>

        {/* -- Expandable filter panel -- */}
        {panelOpen && (
          <div className="bg-white dark:bg-[#1E2A1A] rounded-xl p-5 space-y-5 animate-fade-in border border-[#E0E0D0] dark:border-[#2C3828] shadow-sm">

            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-black text-[#1A1A1A] dark:text-white uppercase tracking-wider">
                {t('filter_panel_title')}
              </span>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[14px] font-bold text-gold hover:text-gold-hover transition-colors"
                >
                  {t('filter_reset')}
                </button>
              )}
            </div>

            {/* City input */}
            <div>
              <label className="block text-[14px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-2">
                {t('filter_city_label')}
              </label>
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder={t('filter_city_placeholder')}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#F5F5EE] dark:bg-[#2C3828] border border-[#E0E0D0] dark:border-[#3A4A36] text-[15px] text-[#1A1A1A] dark:text-white placeholder-[#9A9A8A] outline-none focus:border-gold transition-colors"
              />
            </div>

            {/* Price range */}
            <div>
              <label className="block text-[14px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-2">
                {t('filter_price_label')}
              </label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    min={0}
                    value={price.min}
                    onChange={(e) => validateAndSetMin(e.target.value)}
                    placeholder={t('filter_price_min_placeholder')}
                    className={[
                      'w-full px-3.5 py-2.5 rounded-lg bg-[#F5F5EE] dark:bg-[#2C3828] border text-[15px] text-[#1A1A1A] dark:text-white placeholder-[#9A9A8A] outline-none transition-colors',
                      priceErrors.min
                        ? 'border-lavo-error focus:border-lavo-error'
                        : 'border-[#E0E0D0] dark:border-[#3A4A36] focus:border-gold',
                    ].join(' ')}
                  />
                  {priceErrors.min && (
                    <p className="text-[14px] text-lavo-error mt-1">{priceErrors.min}</p>
                  )}
                </div>
                <div className="flex items-center text-[#555] dark:text-[#B0B0A0] text-[14px] font-bold pt-2.5">&mdash;</div>
                <div className="flex-1">
                  <input
                    type="number"
                    min={0}
                    value={price.max}
                    onChange={(e) => validateAndSetMax(e.target.value)}
                    placeholder={t('filter_price_max_placeholder')}
                    className={[
                      'w-full px-3.5 py-2.5 rounded-lg bg-[#F5F5EE] dark:bg-[#2C3828] border text-[15px] text-[#1A1A1A] dark:text-white placeholder-[#9A9A8A] outline-none transition-colors',
                      priceErrors.max
                        ? 'border-lavo-error focus:border-lavo-error'
                        : 'border-[#E0E0D0] dark:border-[#3A4A36] focus:border-gold',
                    ].join(' ')}
                  />
                  {priceErrors.max && (
                    <p className="text-[14px] text-lavo-error mt-1">{priceErrors.max}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Sort */}
            <div>
              <p className="text-[14px] font-bold text-[#333333] dark:text-[#C0C0B0] uppercase tracking-wider mb-2">
                {t('filter_sort_label')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sortChips.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSort(key)}
                    className={[
                      'py-1.5 px-3.5 rounded-full text-[14px] font-bold transition-colors',
                      sort === key
                        ? 'bg-gold text-[#1A2116]'
                        : 'bg-[#F5F5EE] dark:bg-[#2C3828] text-[#222] dark:text-[#D0D0C0] hover:bg-[#E0E0D0] dark:hover:bg-[#3A4A36]',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Availability toggle */}
            <div className="flex items-center justify-between gap-4 py-1">
              <span className="text-[15px] font-semibold text-[#1A1A1A] dark:text-white leading-snug">
                {t('filter_available_only')}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={onlyAvail}
                onClick={() => setOnlyAvail((v) => !v)}
                className={[
                  'relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                  onlyAvail ? 'bg-gold' : 'bg-[#9A9A8A] dark:bg-[#2C3828]',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform duration-200',
                    onlyAvail ? 'translate-x-[22px]' : 'translate-x-[3px]',
                  ].join(' ')}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Results ── */}
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
          {unavailable.length > 0 && !onlyAvail && (
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
      <span className="text-[16px] font-black text-[#1A1A1A] dark:text-white uppercase tracking-widest">{label}</span>
      <span className="text-[13px] text-[#555] dark:text-[#B0B0A0] font-semibold bg-[#E0E0D0] dark:bg-[#1E2A1A] px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  );
}

function StationGrid({ stations, unavailable }: { stations: StationDetailData[]; unavailable: boolean }) {
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
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-[#E0E0D0] dark:bg-[#1E2A1A] flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <p className="text-[18px] font-black text-[#1A1A1A] dark:text-white">{title}</p>
      <p className="text-[15px] text-[#555] dark:text-[#C0C0B0] max-w-xs leading-relaxed">{desc}</p>
    </div>
  );
}

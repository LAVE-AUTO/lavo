'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Toggle } from '@/components/ui/Toggle';
import { CustomSelect, CustomMultiSelect } from '@/components/ui/CustomSelect';

export type ServiceScope = '' | 'exterior' | 'interior' | 'both';

export interface WashTypeOption  { id: string; code: string; label: string; }
export interface VehicleFormatOption { id: string; label: string; }

export interface StationFiltersState {
  nameSearch: string;
  onlyAvail: boolean;
  selectedWashTypes: string[];
  serviceScope: ServiceScope;
  formatId: string;
  priceMin: string;
  priceMax: string;
  timeFrom: string;
  timeTo: string;
}

interface StationFiltersProps {
  open: boolean;
  onClose: () => void;
  value: StationFiltersState;
  onChange: (next: StationFiltersState) => void;
  onReset: () => void;
  washTypes: WashTypeOption[];
  vehicleFormats: VehicleFormatOption[];
  activeCount: number;
}

/**
 * Filter sheet for the public station list.
 * Mobile: bottom-anchored sheet. Desktop: floating panel anchored under the
 * trigger button (placement handled by the parent via positioning).
 *
 * Closes on backdrop click and Escape. Locks body scroll while open.
 */
export function StationFilters({
  open,
  onClose,
  value,
  onChange,
  onReset,
  washTypes,
  vehicleFormats,
  activeCount,
}: StationFiltersProps) {
  const t = useTranslations('stations');

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const patch = (partial: Partial<StationFiltersState>) => onChange({ ...value, ...partial });
  const toggleWashType = (id: string) =>
    patch({ selectedWashTypes: value.selectedWashTypes.includes(id)
      ? value.selectedWashTypes.filter((x) => x !== id)
      : [...value.selectedWashTypes, id] });

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px] animate-fade-in flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filters-title"
        className="relative w-full sm:max-w-xl bg-white dark:bg-dark-card rounded-t-3xl sm:rounded-2xl shadow-[0_-12px_48px_rgba(0,0,0,0.25)] sm:shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[80vh] animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet handle - mobile */}
        <div className="sm:hidden flex items-center justify-center pt-3 pb-2 shrink-0">
          <span className="w-10 h-1 rounded-full bg-[#D0D0C0] dark:bg-tab-inactive" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-2 sm:pt-5 pb-3 sm:pb-4 border-b border-[#E0E0D0] dark:border-tab-inactive shrink-0">
          <div className="flex items-center gap-2">
            <h2 id="filters-title" className="text-[16px] font-black text-[#1A1A1A] dark:text-white tracking-wider uppercase">
              {t('filter_panel_title')}
            </h2>
            {activeCount > 0 && (
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-gold text-dark-bg">
                {activeCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('filter_close')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#555] dark:text-[#B0B0A0] hover:bg-[#F0F0E2] dark:hover:bg-tab-inactive transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">

          {/* Name */}
          <FilterRow label={t('filter_name_label')}>
            <input
              type="text"
              value={value.nameSearch}
              onChange={(e) => patch({ nameSearch: e.target.value })}
              placeholder={t('filter_name_placeholder')}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F5EE] dark:bg-tab-inactive border border-[#E0E0D0] dark:border-tab-inactive text-[14px] text-[#1A1A1A] dark:text-white placeholder-[#9A9A8A] outline-none focus:border-gold transition-colors"
            />
          </FilterRow>

          {/* Available */}
          <FilterRow label={t('filter_available_only')}>
            <div className="h-[44px] flex items-center px-3.5 rounded-xl border border-[#E0E0D0] dark:border-tab-inactive bg-[#F5F5EE] dark:bg-tab-inactive">
              <Toggle checked={value.onlyAvail} onChange={(v) => patch({ onlyAvail: v })} />
              <span className="ml-auto text-[12.5px] font-semibold text-[#555] dark:text-[#B0B0A0]">
                {value.onlyAvail ? t('filter_on') : t('filter_off')}
              </span>
            </div>
          </FilterRow>

          {/* Wash types */}
          <FilterRow label={t('filter_wash_type_label')}>
            <CustomMultiSelect
              options={washTypes.map((w) => ({ value: w.id, label: w.label }))}
              selected={value.selectedWashTypes}
              onToggle={toggleWashType}
              placeholder={t('filter_wash_type_placeholder')}
            />
          </FilterRow>

          {/* Service scope */}
          <FilterRow label={t('filter_scope_label')}>
            <CustomSelect
              value={value.serviceScope}
              onChange={(v) => patch({ serviceScope: v as ServiceScope })}
              placeholder={t('filter_scope_all')}
              options={[
                { value: '',         label: t('filter_scope_all') },
                { value: 'exterior', label: t('filter_scope_exterior') },
                { value: 'interior', label: t('filter_scope_interior') },
                { value: 'both',     label: t('filter_scope_both') },
              ]}
            />
          </FilterRow>

          {/* Vehicle */}
          <FilterRow label={t('filter_vehicle_label')}>
            <CustomSelect
              value={value.formatId}
              onChange={(v) => patch({ formatId: v })}
              placeholder={t('filter_vehicle_placeholder')}
              options={[
                { value: '', label: t('filter_vehicle_placeholder') },
                ...vehicleFormats.map((f) => ({ value: f.id, label: f.label })),
              ]}
            />
          </FilterRow>

          {/* Price range */}
          <FilterRow label={t('filter_price_label')}>
            <div className="grid grid-cols-2 gap-2.5">
              <PriceInput
                value={value.priceMin}
                onChange={(v) => patch({ priceMin: v })}
                placeholder={t('filter_price_min_placeholder')}
                unit={t('filter_currency_unit')}
              />
              <PriceInput
                value={value.priceMax}
                onChange={(v) => patch({ priceMax: v })}
                placeholder={t('filter_price_max_placeholder')}
                unit={t('filter_currency_unit')}
              />
            </div>
          </FilterRow>

          {/* Time range */}
          <FilterRow label={t('filter_time_label')}>
            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="time"
                value={value.timeFrom}
                onChange={(e) => patch({ timeFrom: e.target.value })}
                aria-label={t('filter_time_from')}
                className="w-full rounded-xl border border-[#E0E0D0] bg-[#F5F5EE] px-3 py-2.5 text-center font-mono text-[14px] text-[#1A1A1A] outline-none focus:border-gold dark:border-tab-inactive dark:bg-tab-inactive dark:text-white transition-colors"
              />
              <input
                type="time"
                value={value.timeTo}
                onChange={(e) => patch({ timeTo: e.target.value })}
                aria-label={t('filter_time_to')}
                className="w-full rounded-xl border border-[#E0E0D0] bg-[#F5F5EE] px-3 py-2.5 text-center font-mono text-[14px] text-[#1A1A1A] outline-none focus:border-gold dark:border-tab-inactive dark:bg-tab-inactive dark:text-white transition-colors"
              />
            </div>
          </FilterRow>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-[#E0E0D0] dark:border-tab-inactive shrink-0 flex items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            disabled={activeCount === 0}
            className="px-4 py-2.5 rounded-xl border border-[#D0D0C0] dark:border-tab-inactive text-[13.5px] font-bold text-[#555] dark:text-[#B0B0A0] hover:bg-[#F0F0E2] dark:hover:bg-tab-inactive transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('filter_reset')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer"
          >
            {t('filter_apply')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] sm:text-[12px] font-black text-[#555] dark:text-[#A0A090] uppercase tracking-[0.15em] mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function PriceInput({ value, onChange, placeholder, unit }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  unit: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-[#888]">
        {unit}
      </span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#E0E0D0] bg-[#F5F5EE] py-2.5 pl-8 pr-3 text-[14px] text-[#1A1A1A] placeholder-[#9A9A8A] outline-none focus:border-gold dark:border-tab-inactive dark:bg-tab-inactive dark:text-white transition-colors"
      />
    </div>
  );
}

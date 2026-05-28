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
  distanceMinKm: string;
  distanceMaxKm: string;
  date: string;
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
  hasLocation: boolean;
  /** Desktop-only: render as an inline card instead of a modal sheet. */
  inline?: boolean;
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
  hasLocation,
  inline = false,
}: StationFiltersProps) {
  const t = useTranslations('stations');

  const hasManualWash = washTypes.some(
    (wt) => wt.code === 'hand_wash' && value.selectedWashTypes.includes(wt.id),
  );

  /* Auto-reset serviceScope when manual wash is no longer selected. */
  useEffect(() => {
    if (!hasManualWash && value.serviceScope !== '') {
      onChange({ ...value, serviceScope: '' });
    }
  }, [hasManualWash, onChange, value]);

  /* Lock body scroll only for the modal sheet, not the inline panel. */
  useEffect(() => {
    if (inline || !open) return;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose, inline]);

  if (!open) return null;

  const patch = (partial: Partial<StationFiltersState>) => onChange({ ...value, ...partial });
  const toggleWashType = (id: string) =>
    patch({ selectedWashTypes: value.selectedWashTypes.includes(id)
      ? value.selectedWashTypes.filter((x) => x !== id)
      : [...value.selectedWashTypes, id] });

  const inputBase = 'w-full rounded-lg border border-[#E0E0D0] dark:border-border bg-[#F5F5EE] dark:bg-tab-inactive text-[13px] text-[#001201] dark:text-white placeholder-[#9A9A8A] outline-none focus:border-gold transition-colors';
  const labelBase = 'block text-[11px] font-black text-foreground/70 dark:text-[#A0A090] uppercase tracking-[0.12em] mb-1.5';

  /* ── Inline desktop panel (main-branch style, dev-branch fields) ── */
  if (inline) {
    return (
      <div className="bg-white dark:bg-surface rounded-xl p-4 border border-[#E0E0D0] dark:border-border shadow-sm animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[12px] sm:text-[13px] font-black text-[#001201] dark:text-white uppercase tracking-wider">
              {t('filter_panel_title')}
            </span>
            {activeCount > 0 && (
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-gold text-dark-bg">{activeCount}</span>
            )}
          </div>
          {activeCount > 0 && (
            <button type="button" onClick={onReset} className="text-[12px] sm:text-[13px] font-bold text-gold hover:text-gold-hover transition-colors cursor-pointer">
              {t('filter_reset')}
            </button>
          )}
        </div>

        {/* Row 1: Name + Available */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={labelBase}>{t('filter_name_label')}</label>
            <input type="text" value={value.nameSearch} onChange={(e) => patch({ nameSearch: e.target.value })} placeholder={t('filter_name_placeholder')} className={`${inputBase} px-2.5 py-2`} />
          </div>
          <div>
            <p className={labelBase}>{t('filter_available_only')}</p>
            <div className="h-[34px] flex items-center px-2.5 rounded-lg border border-[#E0E0D0] dark:border-border bg-[#F5F5EE] dark:bg-tab-inactive">
              <Toggle checked={value.onlyAvail} onChange={(v) => patch({ onlyAvail: v })} />
              <span className="ml-auto text-[12px] font-semibold text-foreground/70">
                {value.onlyAvail ? t('filter_on') : t('filter_off')}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Wash types + Service scope */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className={labelBase}>{t('filter_wash_type_label')}</p>
            <CustomMultiSelect options={washTypes.map((w) => ({ value: w.id, label: w.label }))} selected={value.selectedWashTypes} onToggle={toggleWashType} placeholder={t('filter_wash_type_placeholder')} />
          </div>
          <div>
            <p className={labelBase}>{t('filter_scope_label')}</p>
            <CustomSelect value={value.serviceScope} onChange={(v) => patch({ serviceScope: v as ServiceScope })} placeholder={t('filter_scope_all')} options={[{ value: '', label: t('filter_scope_all') }, { value: 'exterior', label: t('filter_scope_exterior') }, { value: 'interior', label: t('filter_scope_interior') }, { value: 'both', label: t('filter_scope_both') }]} disabled={!hasManualWash} />
          </div>
        </div>

        {/* Row 3: Vehicle + Price */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className={labelBase}>{t('filter_vehicle_label')}</p>
            <CustomSelect value={value.formatId} onChange={(v) => patch({ formatId: v })} placeholder={t('filter_vehicle_placeholder')} options={[{ value: '', label: t('filter_vehicle_placeholder') }, ...vehicleFormats.map((f) => ({ value: f.id, label: f.label }))]} />
          </div>
          <div>
            <p className={labelBase}>{t('filter_price_label')}</p>
            <div className="flex gap-2 items-center">
              <PriceInput value={value.priceMin} onChange={(v) => patch({ priceMin: v })} placeholder={t('filter_price_min_placeholder')} unit={t('filter_currency_unit')} />
              <span className="text-[#999] dark:text-foreground/70 text-[12px] font-bold shrink-0">—</span>
              <PriceInput value={value.priceMax} onChange={(v) => patch({ priceMax: v })} placeholder={t('filter_price_max_placeholder')} unit={t('filter_currency_unit')} />
            </div>
          </div>
        </div>

        {/* Row 4: Distance */}
        <div className="mb-3">
          <p className={labelBase}>{t('filter_distance_label')}</p>
          <div className="grid grid-cols-2 gap-2.5">
            <DistanceInput value={value.distanceMinKm} onChange={(v) => patch({ distanceMinKm: v })} placeholder={t('filter_distance_min_placeholder')} />
            <DistanceInput value={value.distanceMaxKm} onChange={(v) => patch({ distanceMaxKm: v })} placeholder={t('filter_distance_max_placeholder')} />
          </div>
          {!hasLocation && (
            <p className="mt-1.5 text-[11px] text-[#9A9A8A] dark:text-[#707068] italic">{t('filter_distance_no_location')}</p>
          )}
        </div>

        {/* Row 5: Date + Time range */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className={labelBase}>{t('filter_date_label')}</p>
            <input
              type="date"
              value={value.date}
              onChange={(e) => patch({ date: e.target.value })}
              aria-label={t('filter_date_label')}
              className={`${inputBase} px-2.5 py-2 font-mono`}
            />
          </div>
          <div>
            <p className={labelBase}>{t('filter_time_label')}</p>
            <div className="flex items-center gap-1">
              <input type="time" value={value.timeFrom} onChange={(e) => patch({ timeFrom: e.target.value })} aria-label={t('filter_time_from')} className={`flex-1 ${inputBase} px-2 py-2 text-center font-mono`} />
              <span className="text-[#AAA] dark:text-foreground/70 text-[12px] font-bold shrink-0">—</span>
              <input type="time" value={value.timeTo} onChange={(e) => patch({ timeTo: e.target.value })} aria-label={t('filter_time_to')} className={`flex-1 ${inputBase} px-2 py-2 text-center font-mono`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Modal sheet (mobile / non-desktop) ── */
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
        className="relative w-full sm:max-w-xl bg-white dark:bg-surface rounded-t-3xl sm:rounded-2xl shadow-[0_-12px_48px_rgba(0,0,0,0.25)] sm:shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[80vh] animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet handle - mobile */}
        <div className="sm:hidden flex items-center justify-center pt-3 pb-2 shrink-0">
          <span className="w-10 h-1 rounded-full bg-[#D0D0C0] dark:bg-tab-inactive" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-2 sm:pt-5 pb-3 sm:pb-4 border-b border-[#E0E0D0] dark:border-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 id="filters-title" className="text-[16px] font-black text-[#001201] dark:text-white tracking-wider uppercase">
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
            className="w-9 h-9 rounded-full flex items-center justify-center text-foreground/70 hover:bg-surface/60 dark:hover:bg-tab-inactive transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="scrollbar-hover flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          <FilterRow label={t('filter_name_label')}>
            <input type="text" value={value.nameSearch} onChange={(e) => patch({ nameSearch: e.target.value })} placeholder={t('filter_name_placeholder')} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F5EE] dark:bg-tab-inactive border border-[#E0E0D0] dark:border-border text-[14px] text-[#001201] dark:text-white placeholder-[#9A9A8A] outline-none focus:border-gold transition-colors" />
          </FilterRow>
          <FilterRow label={t('filter_available_only')}>
            <div className="h-[44px] flex items-center px-3.5 rounded-xl border border-[#E0E0D0] dark:border-border bg-[#F5F5EE] dark:bg-tab-inactive">
              <Toggle checked={value.onlyAvail} onChange={(v) => patch({ onlyAvail: v })} />
              <span className="ml-auto text-[12.5px] font-semibold text-foreground/70">{value.onlyAvail ? t('filter_on') : t('filter_off')}</span>
            </div>
          </FilterRow>
          <FilterRow label={t('filter_wash_type_label')}>
            <CustomMultiSelect options={washTypes.map((w) => ({ value: w.id, label: w.label }))} selected={value.selectedWashTypes} onToggle={toggleWashType} placeholder={t('filter_wash_type_placeholder')} />
          </FilterRow>
          <FilterRow label={t('filter_scope_label')}>
            <CustomSelect value={value.serviceScope} onChange={(v) => patch({ serviceScope: v as ServiceScope })} placeholder={t('filter_scope_all')} options={[{ value: '', label: t('filter_scope_all') }, { value: 'exterior', label: t('filter_scope_exterior') }, { value: 'interior', label: t('filter_scope_interior') }, { value: 'both', label: t('filter_scope_both') }]} disabled={!hasManualWash} />
          </FilterRow>
          <FilterRow label={t('filter_vehicle_label')}>
            <CustomSelect value={value.formatId} onChange={(v) => patch({ formatId: v })} placeholder={t('filter_vehicle_placeholder')} options={[{ value: '', label: t('filter_vehicle_placeholder') }, ...vehicleFormats.map((f) => ({ value: f.id, label: f.label }))]} />
          </FilterRow>
          <FilterRow label={t('filter_price_label')}>
            <div className="grid grid-cols-2 gap-2.5">
              <PriceInput value={value.priceMin} onChange={(v) => patch({ priceMin: v })} placeholder={t('filter_price_min_placeholder')} unit={t('filter_currency_unit')} />
              <PriceInput value={value.priceMax} onChange={(v) => patch({ priceMax: v })} placeholder={t('filter_price_max_placeholder')} unit={t('filter_currency_unit')} />
            </div>
          </FilterRow>
          <FilterRow label={t('filter_distance_label')}>
            <div className="grid grid-cols-2 gap-2.5">
              <DistanceInput value={value.distanceMinKm} onChange={(v) => patch({ distanceMinKm: v })} placeholder={t('filter_distance_min_placeholder')} />
              <DistanceInput value={value.distanceMaxKm} onChange={(v) => patch({ distanceMaxKm: v })} placeholder={t('filter_distance_max_placeholder')} />
            </div>
            {!hasLocation && <p className="mt-2 text-[12px] text-[#9A9A8A] dark:text-[#707068] italic">{t('filter_distance_no_location')}</p>}
          </FilterRow>
          <FilterRow label={t('filter_date_label')}>
            <input
              type="date"
              value={value.date}
              onChange={(e) => patch({ date: e.target.value })}
              aria-label={t('filter_date_label')}
              className="w-full rounded-xl border border-[#E0E0D0] bg-[#F5F5EE] px-3 py-2.5 font-mono text-[14px] text-[#001201] outline-none focus:border-gold dark:border-border dark:bg-tab-inactive dark:text-white transition-colors"
            />
          </FilterRow>
          <FilterRow label={t('filter_time_label')}>
            <div className="grid grid-cols-2 gap-2.5">
              <input type="time" value={value.timeFrom} onChange={(e) => patch({ timeFrom: e.target.value })} aria-label={t('filter_time_from')} className="w-full rounded-xl border border-[#E0E0D0] bg-[#F5F5EE] px-3 py-2.5 text-center font-mono text-[14px] text-[#001201] outline-none focus:border-gold dark:border-border dark:bg-tab-inactive dark:text-white transition-colors" />
              <input type="time" value={value.timeTo} onChange={(e) => patch({ timeTo: e.target.value })} aria-label={t('filter_time_to')} className="w-full rounded-xl border border-[#E0E0D0] bg-[#F5F5EE] px-3 py-2.5 text-center font-mono text-[14px] text-[#001201] outline-none focus:border-gold dark:border-border dark:bg-tab-inactive dark:text-white transition-colors" />
            </div>
          </FilterRow>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-[#E0E0D0] dark:border-border shrink-0 flex items-center gap-3">
          <button type="button" onClick={onReset} disabled={activeCount === 0} className="px-4 py-2.5 rounded-xl border border-border text-[13.5px] font-bold text-foreground/70 hover:bg-surface/60 dark:hover:bg-tab-inactive transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            {t('filter_reset')}
          </button>
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gold hover:bg-gold-hover rounded-xl text-[14px] font-black text-dark-bg transition-colors cursor-pointer">
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
      <p className="text-[11px] sm:text-[12px] font-black text-foreground/70 dark:text-[#A0A090] uppercase tracking-[0.15em] mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function DistanceInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) onChange(raw);
  };
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#E0E0D0] bg-[#F5F5EE] py-2.5 pl-3.5 pr-10 text-[14px] text-[#001201] placeholder-[#9A9A8A] outline-none focus:border-gold dark:border-border dark:bg-tab-inactive dark:text-white transition-colors"
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-foreground/55">
        km
      </span>
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
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-foreground/55">
        {unit}
      </span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#E0E0D0] bg-[#F5F5EE] py-2.5 pl-8 pr-3 text-[14px] text-[#001201] placeholder-[#9A9A8A] outline-none focus:border-gold dark:border-border dark:bg-tab-inactive dark:text-white transition-colors"
      />
    </div>
  );
}

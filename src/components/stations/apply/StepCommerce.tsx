'use client';

import { type ChangeEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { FormField } from '@/components/auth/FormField';
import { CityAutocomplete } from './CityAutocomplete';
import { Button } from '@/components/ui/Button';

export interface WashTypeOption {
  id: string;
  code: string;
  label: string;
}

export interface Step2Data {
  stationName: string;
  legalName: string;
  registrationNumber: string;
  address: string;
  city: string;
  washPostCount: string;
  washTypeIds: string[];
  serviceScope: '' | 'exterior' | 'interior' | 'both';
  description: string;
}

export interface Step2Errors {
  stationName?: string;
  address?: string;
  city?: string;
  washPostCount?: string;
  washTypeIds?: string;
}

interface StepCommerceProps {
  data: Step2Data;
  errors: Step2Errors;
  isLoading: boolean;
  washTypes: WashTypeOption[];
  onChange: (data: Step2Data) => void;
  onErrors: (errors: Step2Errors) => void;
  onNext: () => void;
  onPrev: () => void;
}

/* ------------------------------------------------------------------ */
/* Section divider                                                      */
/* ------------------------------------------------------------------ */

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mt-1 mb-4">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gold/70 dark:text-gold/60 shrink-0">
        {label}
      </span>
      <div className="h-px flex-1 bg-[#E0D8C0] dark:bg-white/8" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wash-type icons                                                      */
/* ------------------------------------------------------------------ */

function HandWashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 11V9a2 2 0 0 0-4 0V7a2 2 0 0 0-4 0v4" />
      <path d="M10 7V5a2 2 0 0 0-4 0v10a6 6 0 0 0 12 0v-3a2 2 0 0 0-4 0" />
    </svg>
  );
}

function AutomaticIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SelfServiceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Service scope icons                                                  */
/* ------------------------------------------------------------------ */

function ExteriorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function InteriorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function BothIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle card                                                          */
/* ------------------------------------------------------------------ */

interface ToggleCardProps {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  sub: string;
  ariaPressed: boolean;
}

function ToggleCard({ selected, onClick, icon, label, sub, ariaPressed }: ToggleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed}
      className={[
        'flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-[1.5px] text-center transition-all duration-150 w-full',
        selected
          ? 'bg-gold/10 border-gold shadow-[0_2px_10px_rgba(175,132,8,0.12)]'
          : 'bg-white dark:bg-dark-card border-[#CCCCCC] dark:border-tab-inactive hover:border-gold/50 dark:hover:border-gold/40',
      ].join(' ')}
    >
      <span className={selected ? 'text-gold' : 'text-[#888] dark:text-Hurryline-muted'}>
        {icon}
      </span>
      <span className={`text-[13px] font-semibold leading-tight ${selected ? 'text-dark-bg dark:text-white' : 'text-[#444] dark:text-white'}`}>
        {label}
      </span>
      <span className={`text-[11px] leading-snug ${selected ? 'text-gold/70' : 'text-[#999] dark:text-Hurryline-muted'}`}>
        {sub}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* StepCommerce                                                         */
/* ------------------------------------------------------------------ */

/**
 * Step 2 of the station onboarding form: business and station details.
 */
export function StepCommerce({ data, errors, isLoading, washTypes, onChange, onErrors, onNext, onPrev }: StepCommerceProps) {
  const t = useTranslations('station_apply');

  function validate(): boolean {
    const next: Step2Errors = {};

    if (!data.stationName.trim() || data.stationName.trim().length < 2) {
      next.stationName = data.stationName.trim() ? t('error_station_name') : t('error_required');
    }
    if (!data.address.trim() || data.address.trim().length < 5) {
      next.address = data.address.trim() ? t('error_address') : t('error_required');
    }
    if (!data.city.trim() || data.city.trim().length < 2) {
      next.city = data.city.trim() ? t('error_city') : t('error_required');
    }

    const count = parseInt(data.washPostCount, 10);
    if (!data.washPostCount || isNaN(count) || count < 1) {
      next.washPostCount = data.washPostCount ? t('error_wash_post_count') : t('error_required');
    }

    if (data.washTypeIds.length === 0) {
      next.washTypeIds = t('error_wash_types');
    }

    onErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleNext() {
    if (validate()) onNext();
  }

  function toggleWashType(id: string) {
    const next = data.washTypeIds.includes(id)
      ? data.washTypeIds.filter((wid) => wid !== id)
      : [...data.washTypeIds, id];
    onChange({ ...data, washTypeIds: next });
    if (errors.washTypeIds && next.length > 0) {
      onErrors({ ...errors, washTypeIds: undefined });
    }
  }

  const WASH_TYPE_META: Record<string, { icon: ReactNode; sub: string }> = {
    hand_wash:    { icon: <HandWashIcon />,    sub: t('wash_type_hand_wash_sub') },
    automatic:    { icon: <AutomaticIcon />,    sub: t('wash_type_automatic_sub') },
    self_service: { icon: <SelfServiceIcon />, sub: t('wash_type_self_service_sub') },
  };


  const charCount = data.description.length;

  return (
    <div>

      {/* ── Station identity ── */}
      <SectionDivider label={t('section_identity')} />

      <FormField
        label={t('station_name')}
        required
        type="text"
        placeholder={t('station_name_placeholder')}
        value={data.stationName}
        autoFocus
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...data, stationName: e.target.value });
          if (errors.stationName) onErrors({ ...errors, stationName: undefined });
        }}
        error={errors.stationName}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <FormField
          label={t('legal_name')}
          type="text"
          placeholder={t('legal_name_placeholder')}
          value={data.legalName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ ...data, legalName: e.target.value })}
        />
        <FormField
          label={t('registration_number')}
          type="text"
          placeholder={t('registration_number_placeholder')}
          value={data.registrationNumber}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ ...data, registrationNumber: e.target.value })}
        />
      </div>

      {/* ── Location ── */}
      <SectionDivider label={t('section_location')} />

      <FormField
        label={t('address')}
        required
        type="text"
        placeholder={t('address_placeholder')}
        value={data.address}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...data, address: e.target.value });
          if (errors.address) onErrors({ ...errors, address: undefined });
        }}
        error={errors.address}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <CityAutocomplete
          label={t('city')}
          required
          value={data.city}
          onChange={(city) => {
            onChange({ ...data, city });
            if (errors.city) onErrors({ ...errors, city: undefined });
          }}
          error={errors.city}
        />
        <FormField
          label={t('wash_post_count')}
          required
          type="number"
          min={1}
          max={100}
          placeholder={t('wash_post_count_placeholder')}
          value={data.washPostCount}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            onChange({ ...data, washPostCount: e.target.value });
            if (errors.washPostCount) onErrors({ ...errors, washPostCount: undefined });
          }}
          error={errors.washPostCount}
        />
      </div>

      {/* ── Configuration ── */}
      <SectionDivider label={t('section_config')} />

      {/* Wash types */}
      <div className="mb-5">
        <p className="text-[14px] font-semibold text-[#1A1A1A] dark:text-white mb-2.5">
          {t('wash_types')}
          <span className="text-gold ml-0.5">*</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {washTypes.map((wt) => {
            const meta = WASH_TYPE_META[wt.code];
            const selected = data.washTypeIds.includes(wt.id);
            const label = wt.code === 'hand_wash'
              ? t('wash_type_hand_wash')
              : wt.code === 'automatic'
              ? t('wash_type_automatic')
              : t('wash_type_self_service');
            return (
              <ToggleCard
                key={wt.id}
                selected={selected}
                onClick={() => toggleWashType(wt.id)}
                ariaPressed={selected}
                icon={meta?.icon ?? null}
                label={label}
                sub={meta?.sub ?? ''}
              />
            );
          })}
        </div>
        {errors.washTypeIds && (
          <p role="alert" className="mt-2 text-[13px] font-medium text-Hurryline-error flex items-center gap-1">
            <span aria-hidden="true">!</span>
            {errors.washTypeIds}
          </p>
        )}
      </div>

      {/* ── Description ── */}
      <SectionDivider label={t('section_description')} />

      <div className="mb-4">
        <label
          htmlFor="description"
          className="block text-[14px] font-semibold text-[#1A1A1A] dark:text-white mb-1.5"
        >
          {t('description')}
        </label>
        <div className="relative">
          <textarea
            id="description"
            rows={3}
            placeholder={t('description_placeholder')}
            value={data.description}
            onChange={(e) => onChange({ ...data, description: e.target.value })}
            maxLength={1000}
            className="w-full px-4 py-3 pb-7 bg-white dark:bg-dark-card border-[1.5px] border-[#CCCCCC] dark:border-tab-inactive rounded-lg text-[15px] text-[#1A1A1A] dark:text-white placeholder-[#AAAAAA] dark:placeholder-[#4A5A46] outline-none focus:border-gold dark:focus:border-gold focus:shadow-[0_0_0_3px_rgba(196,154,30,0.15)] transition-colors duration-150 resize-none"
          />
          <span className={`absolute bottom-2.5 right-3 text-[11px] tabular-nums ${charCount >= 900 ? 'text-Hurryline-error' : 'text-[#AAA] dark:text-Hurryline-muted'}`}>
            {charCount}/1000
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="flex gap-3 mt-2">
        <Button type="button" variant="secondary" onClick={onPrev} className="flex-1">
          {t('btn_prev')}
        </Button>
        <Button type="button" loading={isLoading} onClick={handleNext} className="flex-[2]">
          {isLoading ? t('loading') : t('btn_next')}
        </Button>
      </div>

    </div>
  );
}

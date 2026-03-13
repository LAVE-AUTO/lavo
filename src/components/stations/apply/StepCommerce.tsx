'use client';

import { type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { FormField } from '@/components/auth/FormField';
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

  const SERVICE_SCOPES = [
    { value: '' as const,         label: '—' },
    { value: 'exterior' as const, label: t('service_scope_exterior') },
    { value: 'interior' as const, label: t('service_scope_interior') },
    { value: 'both' as const,     label: t('service_scope_both') },
  ];

  return (
    <div>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <div className="sm:col-span-2">
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
        </div>
        <FormField
          label={t('city')}
          required
          type="text"
          placeholder={t('city_placeholder')}
          value={data.city}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            onChange({ ...data, city: e.target.value });
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

      <div className="mb-4">
        <p className="text-[15px] font-semibold text-[#1A1A1A] dark:text-white mb-2 tracking-wide">
          {t('wash_types')}
          <span className="text-gold ml-0.5">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {washTypes.map((wt) => {
            const selected = data.washTypeIds.includes(wt.id);
            return (
              <button
                key={wt.id}
                type="button"
                onClick={() => toggleWashType(wt.id)}
                className={[
                  'px-4 py-2 rounded-lg border-[1.5px] text-[14px] font-semibold transition-colors duration-150',
                  selected
                    ? 'bg-gold border-gold text-dark-bg'
                    : 'bg-white dark:bg-dark-card border-[#CCCCCC] dark:border-tab-inactive text-[#333] dark:text-white hover:border-gold',
                ].join(' ')}
                aria-pressed={selected}
              >
                {wt.code === 'hand_wash'
                  ? t('wash_type_hand_wash')
                  : wt.code === 'automatic'
                  ? t('wash_type_automatic')
                  : t('wash_type_self_service')}
              </button>
            );
          })}
        </div>
        {errors.washTypeIds && (
          <p role="alert" className="mt-1.5 text-[13px] font-medium text-lavo-error flex items-center gap-1">
            <span aria-hidden="true">!</span>
            {errors.washTypeIds}
          </p>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-[15px] font-semibold text-[#1A1A1A] dark:text-white mb-1.5 tracking-wide" htmlFor="service-scope">
          {t('service_scope')}
        </label>
        <select
          id="service-scope"
          value={data.serviceScope}
          onChange={(e) => onChange({ ...data, serviceScope: e.target.value as Step2Data['serviceScope'] })}
          className="w-full px-4 py-3 bg-white dark:bg-dark-card border-[1.5px] border-[#CCCCCC] dark:border-tab-inactive rounded-lg text-[16px] text-[#1A1A1A] dark:text-white outline-none focus:border-gold dark:focus:border-gold transition-colors duration-150"
        >
          {SERVICE_SCOPES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-[15px] font-semibold text-[#1A1A1A] dark:text-white mb-1.5 tracking-wide" htmlFor="description">
          {t('description')}
        </label>
        <textarea
          id="description"
          rows={3}
          placeholder={t('description_placeholder')}
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          maxLength={1000}
          className="w-full px-4 py-3 bg-white dark:bg-dark-card border-[1.5px] border-[#CCCCCC] dark:border-tab-inactive rounded-lg text-[16px] text-[#1A1A1A] dark:text-white placeholder-[#AAAAAA] dark:placeholder-[#4A5A46] outline-none focus:border-gold dark:focus:border-gold transition-colors duration-150 resize-none"
        />
      </div>

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

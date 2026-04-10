'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AdminCityInput } from './AdminCityInput';

// Wash types: hardcoded codes — backend resolves codes to IDs.
// TODO: connect to API once endpoint is available (GET /admin/wash-types or similar)
export const WASH_TYPE_CODES = ['hand_wash', 'automatic', 'self_service'] as const;
export type WashTypeCode = (typeof WASH_TYPE_CODES)[number];

export type ServiceScope = '' | 'exterior' | 'interior' | 'both';

export interface StationInfoData {
  stationName:        string;
  legalName:          string;
  registrationNumber: string;
  address:            string;
  city:               string;
  washPostCount:      string;
  washTypeCodes:      WashTypeCode[];
  serviceScope:       ServiceScope;
  description:        string;
}

export interface StationInfoErrors {
  stationName?:   string;
  address?:       string;
  city?:          string;
  washPostCount?: string;
  washTypeCodes?: string;
}

interface Props {
  data:      StationInfoData;
  errors:    StationInfoErrors;
  busy:      boolean;
  onChange:  (data: StationInfoData) => void;
  onErrors:  (errors: StationInfoErrors) => void;
  onNext:    () => void;
  onPrev:    () => void;
}

const inputBase  = 'w-full rounded-lg border bg-transparent px-3 py-2 text-[13px] text-[#1A1A0A] outline-none transition-all dark:text-[#F0EDD4]';
const inputIdle  = 'border-[#D8D4C8] focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] dark:border-[#243020] dark:focus:border-[#C49A1E]';
const inputError = 'border-red-400 focus:border-red-400';

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mb-3 mt-1 flex items-center gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-[#C49A1E]/70">{label}</span>
      <div className="h-px flex-1 bg-[#E8E4DC] dark:bg-[#1A2A14]" />
    </div>
  );
}

function ToggleCard({ selected, onClick, icon, label, sub }: {
  selected: boolean; onClick: () => void; icon: ReactNode; label: string; sub: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={[
        'flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-2 py-3 text-center transition-all duration-150 w-full',
        selected
          ? 'border-[#C49A1E] bg-[#C49A1E]/8 shadow-sm'
          : 'border-[#D8D4C8] bg-white hover:border-[#C49A1E]/50 dark:border-[#243020] dark:bg-[#0F1A0C]',
      ].join(' ')}>
      <span className={selected ? 'text-[#C49A1E]' : 'text-[#888] dark:text-[#9A9A8A]'}>{icon}</span>
      <span className={`text-[11px] font-bold leading-tight ${selected ? 'text-[#1A1A0A] dark:text-[#F0EDD4]' : 'text-[#555] dark:text-[#9A9A8A]'}`}>{label}</span>
      <span className={`text-[10px] leading-snug ${selected ? 'text-[#C49A1E]/70' : 'text-[#999] dark:text-[#A0A090]'}`}>{sub}</span>
    </button>
  );
}

export function AdminAddStationInfo({ data, errors, busy, onChange, onErrors, onNext, onPrev }: Props) {
  const t = useTranslations('admin_add_station');

  const WASH_META: Record<WashTypeCode, { icon: ReactNode; label: string; sub: string }> = {
    hand_wash:    { label: t('wash_type_hand_wash'),    sub: t('wash_type_hand_wash_sub'),    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 11V9a2 2 0 0 0-4 0V7a2 2 0 0 0-4 0v4"/><path d="M10 7V5a2 2 0 0 0-4 0v10a6 6 0 0 0 12 0v-3a2 2 0 0 0-4 0"/></svg> },
    automatic:    { label: t('wash_type_automatic'),    sub: t('wash_type_automatic_sub'),    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
    self_service: { label: t('wash_type_self_service'), sub: t('wash_type_self_service_sub'), icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  };

  const SCOPE_META: { value: ServiceScope; label: string; sub: string; icon: ReactNode }[] = [
    { value: 'exterior', label: t('service_scope_exterior'), sub: t('service_scope_exterior_sub'), icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> },
    { value: 'interior', label: t('service_scope_interior'), sub: t('service_scope_interior_sub'), icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> },
    { value: 'both',     label: t('service_scope_both'),     sub: t('service_scope_both_sub'),     icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> },
  ];

  function toggleWashType(code: WashTypeCode) {
    const next = data.washTypeCodes.includes(code)
      ? data.washTypeCodes.filter((c) => c !== code)
      : [...data.washTypeCodes, code];
    onChange({ ...data, washTypeCodes: next });
    if (errors.washTypeCodes && next.length > 0) onErrors({ ...errors, washTypeCodes: undefined });
  }

  return (
    <>
      <div className="flex flex-col gap-3 overflow-y-auto px-6 py-5" style={{ maxHeight: '60vh' }}>
        <SectionLabel label={t('section_identity')} />

        {/* Station name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="stn-name" className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">
            {t('field_station_name')}<span className="ml-0.5 text-[#C49A1E]">*</span>
          </label>
          <input id="stn-name" type="text" value={data.stationName} minLength={2} maxLength={100}
            required aria-required="true"
            placeholder={t('field_station_name_placeholder')}
            onChange={(e) => { onChange({ ...data, stationName: e.target.value }); if (errors.stationName) onErrors({ ...errors, stationName: undefined }); }}
            className={`${inputBase} ${errors.stationName ? inputError : inputIdle}`} />
          {errors.stationName && <p className="text-[11px] font-semibold text-red-500">{errors.stationName}</p>}
        </div>

        {/* Legal name + reg number */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="stn-legal" className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_legal_name')}</label>
            <input id="stn-legal" type="text" value={data.legalName} maxLength={150}
              placeholder={t('field_legal_name_placeholder')}
              onChange={(e) => onChange({ ...data, legalName: e.target.value })}
              className={`${inputBase} ${inputIdle}`} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="stn-reg" className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_reg_number')}</label>
            <input id="stn-reg" type="text" value={data.registrationNumber} maxLength={50}
              placeholder={t('field_reg_number_placeholder')}
              onChange={(e) => onChange({ ...data, registrationNumber: e.target.value })}
              className={`${inputBase} ${inputIdle}`} />
          </div>
        </div>

        <SectionLabel label={t('section_location')} />

        {/* Address */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="stn-address" className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">
            {t('field_address')}<span className="ml-0.5 text-[#C49A1E]">*</span>
          </label>
          <input id="stn-address" type="text" value={data.address} minLength={5} maxLength={200}
            required aria-required="true"
            placeholder={t('field_address_placeholder')}
            onChange={(e) => { onChange({ ...data, address: e.target.value }); if (errors.address) onErrors({ ...errors, address: undefined }); }}
            className={`${inputBase} ${errors.address ? inputError : inputIdle}`} />
          {errors.address && <p className="text-[11px] font-semibold text-red-500">{errors.address}</p>}
        </div>

        {/* City + wash posts */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AdminCityInput
            label={t('field_city')} required value={data.city}
            placeholder={t('field_city_placeholder')} error={errors.city}
            onChange={(city) => { onChange({ ...data, city }); if (errors.city) onErrors({ ...errors, city: undefined }); }} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="stn-posts" className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">
              {t('field_wash_posts')}<span className="ml-0.5 text-[#C49A1E]">*</span>
            </label>
            <input id="stn-posts" type="number" min={1} max={100} value={data.washPostCount}
              required aria-required="true"
              placeholder={t('field_wash_posts_placeholder')}
              onChange={(e) => { onChange({ ...data, washPostCount: e.target.value }); if (errors.washPostCount) onErrors({ ...errors, washPostCount: undefined }); }}
              className={`${inputBase} ${errors.washPostCount ? inputError : inputIdle}`} />
            {errors.washPostCount && <p className="text-[11px] font-semibold text-red-500">{errors.washPostCount}</p>}
          </div>
        </div>

        <SectionLabel label={t('section_config')} />

        {/* Wash types */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">
            {t('field_wash_types')}<span className="ml-0.5 text-[#C49A1E]">*</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {WASH_TYPE_CODES.map((code) => {
              const m = WASH_META[code];
              return (
                <ToggleCard key={code} selected={data.washTypeCodes.includes(code)}
                  onClick={() => toggleWashType(code)} icon={m.icon} label={m.label} sub={m.sub} />
              );
            })}
          </div>
          {errors.washTypeCodes && <p className="text-[11px] font-semibold text-red-500">{errors.washTypeCodes}</p>}
        </div>

        {/* Service scope */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_service_scope')}</p>
          <div className="grid grid-cols-3 gap-2">
            {SCOPE_META.map((s) => (
              <ToggleCard key={s.value} selected={data.serviceScope === s.value}
                onClick={() => onChange({ ...data, serviceScope: data.serviceScope === s.value ? '' : s.value })}
                icon={s.icon} label={s.label} sub={s.sub} />
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="stn-desc" className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">{t('field_description')}</label>
          <div className="relative">
            <textarea id="stn-desc" rows={3} maxLength={1000} value={data.description}
              placeholder={t('field_description_placeholder')}
              onChange={(e) => onChange({ ...data, description: e.target.value })}
              className={`${inputBase} resize-none pb-6 ${inputIdle}`} />
            <span className={`absolute bottom-2 right-2 text-[10px] tabular-nums ${data.description.length >= 900 ? 'text-red-400' : 'text-[#BBBBAA]'}`}>
              {data.description.length}/1000
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-[#F0EDE6] px-6 py-4 dark:border-[#1A2A14]">
        <button type="button" onClick={onPrev} disabled={busy}
          className="rounded-lg border border-[#D8D4C8] px-4 py-2 text-[12px] font-semibold text-[#666] transition-colors hover:bg-[#F5F3EE] disabled:opacity-50 dark:border-[#243020] dark:text-[#9A9A8A]">
          {t('btn_prev')}
        </button>
        <button type="button" onClick={onNext} disabled={busy}
          className="rounded-lg bg-[#C49A1E] px-4 py-2 text-[12px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14] disabled:opacity-50">
          {t('btn_next')}
        </button>
      </div>
    </>
  );
}

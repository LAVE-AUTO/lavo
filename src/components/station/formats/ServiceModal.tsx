'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { postWithApi, updateWithApi } from '@/services';
import type { StationExtras, StationExtra } from '@/components/station/config/StationExtrasForm';
import type { Service, VehicleFormat, ServiceVehicleEntry, ServiceCategory, ServiceType } from './types';
import { ServiceVehicleRows } from './ServiceVehicleRows';

interface Props {
  service: Service | null;
  vehicleFormats: VehicleFormat[];
  availableExtras: StationExtras;
  onClose: () => void;
  onSaved: (service: Service) => void;
}

const CATEGORIES: ServiceCategory[] = ['hand_wash', 'automatic', 'self_service'];
const TYPES: ServiceType[] = ['exterior', 'interior', 'complete'];

const inputClass =
  'w-full rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none transition-colors duration-150 placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] dark:focus:border-[#C49A1E] dark:focus:bg-[#182214]';

function buildEntries(formats: VehicleFormat[], existing?: ServiceVehicleEntry[]): ServiceVehicleEntry[] {
  return formats.map((f) => {
    const found = existing?.find((e) => e.vehicle_format_id === f.id);
    return (
      found ?? {
        vehicle_format_id: f.id,
        vehicle_label: f.label,
        price: '',
        duration_min: 30,
        staff_required: 1,
        is_active: true,
      }
    );
  });
}

export function ServiceModal({ service, vehicleFormats, availableExtras, onClose, onSaved }: Props) {
  const t = useTranslations('station_services');
  const isEdit = service !== null;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('hand_wash');
  const [serviceType, setServiceType] = useState<ServiceType>('exterior');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [entries, setEntries] = useState<ServiceVehicleEntry[]>([]);
  const [selectedFormatIds, setSelectedFormatIds] = useState<string[]>([]);
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [formatSearch, setFormatSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (service) {
      setName(service.name);
      setCategory(service.category);
      setServiceType(service.service_type);
      setDescription(service.description);
      setIsActive(service.is_active);
      setEntries(buildEntries(vehicleFormats, service.vehicle_entries));
      setSelectedFormatIds(service.vehicle_entries.filter((e) => e.is_active).map((e) => e.vehicle_format_id));
      setSelectedExtraIds((service.compatible_extras || []).map((e) => e.id));
    } else {
      setName('');
      setCategory('hand_wash');
      setServiceType('exterior');
      setDescription('');
      setIsActive(true);
      setEntries(buildEntries(vehicleFormats));
      setSelectedFormatIds(vehicleFormats.map((f) => f.id));
      setSelectedExtraIds([]);
    }
    setFormatSearch('');
    setError(null);
  }, [service, vehicleFormats]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('name_required'));
      return;
    }
    setSaving(true);
    setError(null);

    const extrasByType: StationExtra[] = serviceType === 'exterior'
      ? [...availableExtras.exterior, ...availableExtras.both]
      : serviceType === 'interior'
      ? [...availableExtras.interior, ...availableExtras.both]
      : [...availableExtras.exterior, ...availableExtras.interior, ...availableExtras.both];

    const selectedExtras = extrasByType
      .filter((e) => selectedExtraIds.includes(e.id))
      .map((e) => ({ id: e.id, name: e.label }));

    const payload = {
      name: name.trim(),
      category,
      service_type: serviceType,
      description: description.trim(),
      is_active: isActive,
      vehicle_entries: entries.map((entry) => ({
        ...entry,
        is_active: selectedFormatIds.includes(entry.vehicle_format_id),
      })),
      compatible_extras: selectedExtras,
      is_popular: service?.is_popular ?? false,
    };

    const [ok, data] = service
      ? await updateWithApi(`/station/services/${service.id}`, payload)
      : await postWithApi('/station/services', payload);

    setSaving(false);

    if (ok && data && typeof data === 'object' && 'data' in (data as object)) {
      const apiService = (data as { data: Service }).data;
      onSaved(apiService);
      return;
    }

    // Fallback for environments where /station/services is not yet available.
    onSaved({
      id: service?.id ?? crypto.randomUUID(),
      ...payload,
    });
  }

  const activeEntries = entries.filter((e) => selectedFormatIds.includes(e.vehicle_format_id));
  const prices = activeEntries.map((e) => parseFloat(e.price || '0')).filter((p) => !Number.isNaN(p) && p > 0);
  const durations = activeEntries.map((e) => e.duration_min).filter((d) => d > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
  const minDur = durations.length > 0 ? Math.min(...durations) : null;
  const maxDur = durations.length > 0 ? Math.max(...durations) : null;
  const selectedFormats = activeEntries.map((e) => e.vehicle_label);
  const searchableFormats = vehicleFormats.filter((f) =>
    f.label.toLowerCase().includes(formatSearch.trim().toLowerCase())
  );
  const showFormatUnavailable = formatSearch.trim().length > 0 && searchableFormats.length === 0;

  const extrasByType: StationExtra[] = serviceType === 'exterior'
    ? [...availableExtras.exterior, ...availableExtras.both]
    : serviceType === 'interior'
    ? [...availableExtras.interior, ...availableExtras.both]
    : [...availableExtras.exterior, ...availableExtras.interior, ...availableExtras.both];

  function toggleFormat(formatId: string) {
    setSelectedFormatIds((prev) =>
      prev.includes(formatId) ? prev.filter((id) => id !== formatId) : [...prev, formatId]
    );
  }

  function toggleExtra(extraId: string) {
    setSelectedExtraIds((prev) =>
      prev.includes(extraId) ? prev.filter((id) => id !== extraId) : [...prev, extraId]
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl border border-[#E8E4DC] bg-white shadow-xl dark:border-[#1A2A14] dark:bg-[#182214]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14]">
          <span className="text-[16px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
            {isEdit ? t('modal_title_edit') : t('modal_title_new')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#999] transition-colors hover:bg-[#F0EDE4] hover:text-[#333] dark:text-[#5A5A4A] dark:hover:bg-[#243020] dark:hover:text-[#F0EDD4]"
            aria-label={t('aria_close')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
            {/* Left form */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{t('field_name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('placeholder_name')}
                  maxLength={100}
                  required
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{t('field_category')}</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCategory(key)}
                      className={`rounded-[8px] px-3.5 py-2 text-[12px] font-bold transition-all ${
                        category === key
                          ? 'bg-[#C49A1E] text-[#0C1209]'
                          : 'bg-[#1E2A18] text-[#9A9A8A] hover:text-[#F0EDD4] dark:bg-[#1E2A18] dark:text-[#9A9A8A]'
                      }`}
                    >
                      {t(`cat_${key}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{t('field_type')}</label>
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setServiceType(key)}
                      className={`rounded-[8px] px-3.5 py-2 text-[12px] font-bold transition-all ${
                        serviceType === key
                          ? 'bg-[#C49A1E] text-[#0C1209]'
                          : 'bg-[#1E2A18] text-[#9A9A8A] hover:text-[#F0EDD4] dark:bg-[#1E2A18] dark:text-[#9A9A8A]'
                      }`}
                    >
                      {t(`type_${key}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[10px] border border-[#F0EDE4] bg-[#FAFAF7] p-3 dark:border-[#243020] dark:bg-[#0F1A0C]">
                <div className="mb-1 text-[11px] font-black tracking-[.08em] text-[#C49A1E] uppercase">
                  {category === 'hand_wash' ? t('field_type_handwash') : t('field_type')}
                </div>
                <p className="text-[12px] text-[#888] dark:text-[#9A9A8A]">
                  {serviceType === 'exterior'
                    ? t('type_hint_exterior')
                    : serviceType === 'interior'
                    ? t('type_hint_interior')
                    : t('type_hint_complete')}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{t('field_description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('placeholder_description')}
                  rows={2}
                  className={inputClass + ' resize-none'}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-black tracking-[.08em] text-[#C49A1E] uppercase">
                  {t('field_vehicle_formats')}
                </label>
                <input
                  type="text"
                  value={formatSearch}
                  onChange={(e) => setFormatSearch(e.target.value)}
                  placeholder={t('format_search_placeholder')}
                  className={inputClass}
                />
                {showFormatUnavailable && (
                  <p className="text-[12px] font-semibold text-[#EF4444]">{t('format_not_in_list')}</p>
                )}
                {!showFormatUnavailable && searchableFormats.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {searchableFormats.map((format) => {
                      const selected = selectedFormatIds.includes(format.id);
                      return (
                        <button
                          key={format.id}
                          type="button"
                          onClick={() => toggleFormat(format.id)}
                          className={`flex items-center gap-2 rounded-[8px] border px-3 py-2 text-left text-[12px] font-semibold transition-all ${
                            selected
                              ? 'border-[#C49A1E] bg-[#FDF3D8] text-[#C49A1E] dark:bg-[#2A1E08]'
                              : 'border-[#D8D4C8] bg-[#F7F6F2] text-[#5A5A4A] dark:border-[#243020] dark:bg-[#182214] dark:text-[#9A9A8A]'
                          }`}
                        >
                          <span
                            className={`h-3.5 w-3.5 rounded border ${selected ? 'border-[#C49A1E] bg-[#C49A1E]' : 'border-[#AAA] bg-transparent'}`}
                            aria-hidden="true"
                          />
                          <span>{format.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-black tracking-[.08em] text-[#C49A1E] uppercase">
                  {t('section_vehicle_pricing')}
                </span>
                <ServiceVehicleRows
                  formats={vehicleFormats}
                  entries={entries.filter((e) => selectedFormatIds.includes(e.vehicle_format_id))}
                  onChange={(updatedEntries) => {
                    setEntries((prev) => prev.map((entry) => {
                      const updated = updatedEntries.find((u) => u.vehicle_format_id === entry.vehicle_format_id);
                      return updated || entry;
                    }));
                  }}
                  searchQuery={formatSearch}
                  unavailableMessage={t('format_not_in_list')}
                />
              </div>

              <div className="flex flex-col gap-2 rounded-[10px] border border-[#F0EDE4] bg-[#FAFAF7] p-3 dark:border-[#243020] dark:bg-[#0F1A0C]">
                <span className="text-[11px] font-black tracking-[.08em] text-[#C49A1E] uppercase">
                  {t('extras_label')}
                </span>
                {extrasByType.length === 0 ? (
                  <p className="text-[12px] text-[#888] dark:text-[#9A9A8A]">{t('extras_empty_modal')}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {extrasByType.map((extra) => {
                      const selected = selectedExtraIds.includes(extra.id);
                      return (
                        <button
                          key={extra.id}
                          type="button"
                          onClick={() => toggleExtra(extra.id)}
                          className={`flex items-center justify-between rounded-[8px] border px-3 py-2 text-left text-[12px] transition-all ${
                            selected
                              ? 'border-[#C49A1E] bg-[#FDF3D8] dark:bg-[#2A1E08]'
                              : 'border-[#D8D4C8] bg-[#F7F6F2] dark:border-[#243020] dark:bg-[#182214]'
                          }`}
                        >
                          <span className="font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{extra.label}</span>
                          <span className="font-mono text-[11px] font-bold text-[#C49A1E]">+{extra.price}$</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-[10px] border border-[#2A3A20] bg-[#1E2A18] px-4 py-3">
                <span className="text-[13px] font-semibold text-[#F0EDD4]">{t('toggle_active')}</span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
                    isActive
                      ? 'border-[#2ecc71] bg-[rgba(46,204,113,.12)] text-[#2ecc71]'
                      : 'border-[#888] bg-[rgba(136,136,136,.12)] text-[#888]'
                  }`}
                >
                  {isActive ? t('badge_active') : t('badge_inactive')}
                </button>
              </div>

              {error && <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p>}
            </div>

            {/* Right preview */}
            <aside className="rounded-[12px] bg-[#3A2A12] p-4 text-[#F0EDD4]">
              <div className="mb-3 text-[13px] font-black">{t('preview_title')}</div>
              <div className="rounded-[10px] bg-[#4A3418] p-3">
                <div className="text-[15px] font-black">{name || t('placeholder_name')}</div>
                <div className="mt-1 text-[11px] text-[#B7AE8A]">{t('preview_category')}: {t(`cat_${category}`)}</div>
                <div className="mt-3 space-y-2 text-[12px]">
                  <div className="flex items-center justify-between border-b border-[#5A4630] pb-1">
                    <span className="text-[#B7AE8A]">{t('preview_price')}</span>
                    <span className="font-bold text-[#C49A1E]">
                      {minPrice !== null ? (minPrice === maxPrice ? `${minPrice}$` : `${minPrice}$ - ${maxPrice}$`) : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#5A4630] pb-1">
                    <span className="text-[#B7AE8A]">{t('preview_duration')}</span>
                    <span className="font-bold">
                      {minDur !== null ? (minDur === maxDur ? `${minDur} min` : `${minDur}-${maxDur} min`) : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#5A4630] pb-1">
                    <span className="text-[#B7AE8A]">{t('preview_staff')}</span>
                    <span className="font-bold">{activeEntries.length > 0 ? Math.max(...activeEntries.map((e) => e.staff_required)) : '--'}</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-[#B7AE8A]">{t('preview_formats')}</span>
                    <div className="mt-1 text-[11px] font-semibold">
                      {selectedFormats.length > 0 ? selectedFormats.join('; ') : '--'}
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="text-[#B7AE8A]">{t('preview_extras')}</span>
                    <div className="mt-1 text-[11px] font-semibold">
                      {selectedExtraIds.length > 0
                        ? extrasByType
                            .filter((e) => selectedExtraIds.includes(e.id))
                            .map((e) => e.label)
                            .join('; ')
                        : '--'}
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-[#D8D4C8] px-4 py-2 text-[13px] font-medium text-[#5A5A4A] transition-opacity hover:opacity-70 dark:border-[#243020] dark:text-[#9A9A8A]"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-[10px] bg-[#C49A1E] px-5 py-2 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {saving ? t('btn_saving') : t('btn_save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

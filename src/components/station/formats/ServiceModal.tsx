'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { Service, VehicleFormat, ServiceVehicleEntry, ServiceCategory, ServiceType } from './types';
import { ServiceVehicleRows } from './ServiceVehicleRows';

interface Props {
  service: Service | null;
  vehicleFormats: VehicleFormat[];
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

export function ServiceModal({ service, vehicleFormats, onClose, onSaved }: Props) {
  const t = useTranslations('station_services');
  const isEdit = service !== null;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('hand_wash');
  const [serviceType, setServiceType] = useState<ServiceType>('exterior');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [entries, setEntries] = useState<ServiceVehicleEntry[]>([]);
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
    } else {
      setName('');
      setCategory('hand_wash');
      setServiceType('exterior');
      setDescription('');
      setIsActive(true);
      setEntries(buildEntries(vehicleFormats));
    }
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

    // TODO: connect to API once endpoint is available
    await new Promise((r) => setTimeout(r, 300));
    setSaving(false);

    onSaved({
      id: service?.id ?? crypto.randomUUID(),
      name: name.trim(),
      category,
      service_type: serviceType,
      description: description.trim(),
      is_active: isActive,
      vehicle_entries: entries,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-[#E8E4DC] bg-white shadow-xl dark:border-[#1A2A14] dark:bg-[#182214]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14]">
          <span className="text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
            {isEdit ? t('modal_title_edit') : t('modal_title_new')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#999] transition-colors hover:bg-[#F0EDE4] hover:text-[#333] dark:text-[#5A5A4A] dark:hover:bg-[#243020] dark:hover:text-[#F0EDD4]"
            aria-label={t('aria_close')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-col gap-4 overflow-y-auto p-5">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{t('field_name')}</label>
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

            {/* Category chips */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{t('field_category')}</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`rounded-[8px] px-3.5 py-2 text-[12px] font-semibold transition-all ${
                      category === key
                        ? 'bg-[#C49A1E] text-[#0C1209]'
                        : 'border border-[#D8D4C8] text-[#5A5A4A] hover:border-[#C49A1E] dark:border-[#243020] dark:text-[#9A9A8A]'
                    }`}
                  >
                    {t(`cat_${key}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Type chips */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{t('field_type')}</label>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setServiceType(key)}
                    className={`rounded-[8px] px-3.5 py-2 text-[12px] font-semibold transition-all ${
                      serviceType === key
                        ? 'bg-[#C49A1E] text-[#0C1209]'
                        : 'border border-[#D8D4C8] text-[#5A5A4A] hover:border-[#C49A1E] dark:border-[#243020] dark:text-[#9A9A8A]'
                    }`}
                  >
                    {t(`type_${key}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{t('field_description')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('placeholder_description')}
                rows={2}
                className={inputClass + ' resize-none'}
              />
            </div>

            {/* Vehicle pricing */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-black tracking-[.08em] text-[#C49A1E] uppercase">
                {t('section_vehicle_pricing')}
              </span>
              <ServiceVehicleRows formats={vehicleFormats} entries={entries} onChange={setEntries} />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-[10px] border border-[#F0EDE4] px-4 py-3 dark:border-[#1A2A14]">
              <span className="text-[13px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{t('toggle_active')}</span>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`rounded-[8px] px-4 py-1.5 text-[12px] font-bold transition-all ${
                  isActive
                    ? 'bg-[#C49A1E] text-[#0C1209]'
                    : 'border border-[#D8D4C8] text-[#888] dark:border-[#243020] dark:text-[#9A9A8A]'
                }`}
              >
                {isActive ? t('badge_active') : t('badge_inactive')}
              </button>
            </div>

            {error && <p className="text-[12px] font-semibold text-[#EF4444]">{error}</p>}
          </div>

          {/* Footer */}
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

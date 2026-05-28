'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { patchWithApi, postWithApi } from '@/services';
import { TextField } from '@/components/station/config/TextField';
import { Textarea } from '@/components/station/config/Textarea';
import { NumberStepper } from '@/components/station/config/NumberStepper';
import type { StationExtras, StationExtra } from '@/components/station/config/station-extras-types';
import type { Service, VehicleFormat, ServiceVehicleEntry, ServiceCategory, ServiceType } from './types';
import { ServiceVehicleRows } from './ServiceVehicleRows';

interface Props {
  service: Service | null;
  vehicleFormats: VehicleFormat[];
  availableExtras: StationExtras;
  onClose: () => void;
  onSaved: (service: Service) => void;
}

interface AutomaticPackage {
  id: string;
  name: string;
  price: string;
  duration: string;
  is_active: boolean;
}

const CATEGORIES: ServiceCategory[] = ['hand_wash', 'automatic', 'self_service'];
const TYPES: ServiceType[] = ['exterior', 'interior', 'complete'];

const TagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

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

function buildAutomaticPackages(existing?: ServiceVehicleEntry[]): AutomaticPackage[] {
  if (existing && existing.length > 0) {
    return existing.map((entry, index) => ({
      id: `pkg-${index + 1}-${entry.vehicle_format_id}`,
      name: entry.vehicle_label || `Forfait ${index + 1}`,
      price: entry.price || '',
      duration: String(entry.duration_min || 0),
      is_active: entry.is_active,
    }));
  }
  return [
    { id: crypto.randomUUID(), name: 'Forfait 1', price: '15', duration: '20', is_active: true },
    { id: crypto.randomUUID(), name: 'Forfait 2', price: '25', duration: '35', is_active: true },
    { id: crypto.randomUUID(), name: 'Forfait 3', price: '35', duration: '45', is_active: true },
  ];
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
  const [basePrice, setBasePrice] = useState('45');
  const [baseDuration, setBaseDuration] = useState('60');
  const [automaticPackages, setAutomaticPackages] = useState<AutomaticPackage[]>(buildAutomaticPackages());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHandWash = category === 'hand_wash';
  const isAutomatic = category === 'automatic';
  const isSelfService = category === 'self_service';
  const isCreateHandWash = !isEdit && isHandWash;
  const isCreateAutomatic = !isEdit && isAutomatic;
  const isCreateSelfService = !isEdit && isSelfService;
  const showTypeSelector = isHandWash;
  const showExtrasSection = isHandWash;
  const showDurationField = true;
  const showFormatSection = isHandWash;
  const showAutomaticPackagesSection = isAutomatic;
  const effectiveServiceType: ServiceType = !isEdit && category !== 'hand_wash' ? 'exterior' : serviceType;
  const computedCreateName = `${t(`cat_${category}`)} · ${t(`type_${effectiveServiceType}`)}`;

  useEffect(() => {
    if (service) {
      setName(service.name);
      setCategory(service.category);
      setServiceType(service.service_type);
      setDescription(service.description);
      setIsActive(service.is_active);
      setEntries(buildEntries(vehicleFormats, service.vehicle_entries));
      setAutomaticPackages(buildAutomaticPackages(service.category === 'automatic' ? service.vehicle_entries : undefined));
      setSelectedFormatIds(service.vehicle_entries.filter((e) => e.is_active).map((e) => e.vehicle_format_id));
      setSelectedExtraIds((service.compatible_extras || []).map((e) => e.id));
      const firstActive = service.vehicle_entries.find((e) => e.is_active);
      setBasePrice(firstActive?.price || '45');
      setBaseDuration(String(firstActive?.duration_min || 60));
    } else {
      setName('');
      setCategory('hand_wash');
      setServiceType('exterior');
      setDescription('');
      setIsActive(true);
      setEntries(buildEntries(vehicleFormats));
      setAutomaticPackages(buildAutomaticPackages());
      setSelectedFormatIds(vehicleFormats.map((f) => f.id));
      setSelectedExtraIds([]);
      setBasePrice('45');
      setBaseDuration('60');
    }
    setError(null);
  }, [service, vehicleFormats]);

  useEffect(() => {
    if (category !== 'hand_wash') {
      setServiceType('exterior');
      setSelectedExtraIds([]);
      if (category === 'self_service') {
        setSelectedFormatIds(vehicleFormats.map((f) => f.id));
      }
      if (category === 'automatic' && automaticPackages.length === 0) {
        setAutomaticPackages(buildAutomaticPackages());
      }
    }
  }, [category, vehicleFormats, automaticPackages.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit && !name.trim()) {
      setError(t('name_required'));
      return;
    }
    setSaving(true);
    setError(null);

    const extrasByType: StationExtra[] = effectiveServiceType === 'exterior'
      ? [...availableExtras.exterior, ...availableExtras.both]
      : effectiveServiceType === 'interior'
      ? [...availableExtras.interior, ...availableExtras.both]
      : [...availableExtras.exterior, ...availableExtras.interior, ...availableExtras.both];

    const selectedExtras = extrasByType
      .filter((e) => selectedExtraIds.includes(e.id))
      .map((e) => ({ id: e.id, name: e.label }));

    const createModeEntries = vehicleFormats
      .filter((f) => selectedFormatIds.includes(f.id))
      .map((f) => ({
        vehicle_format_id: f.id,
        vehicle_label: f.label,
        price: basePrice,
        duration_min: parseInt(baseDuration, 10) || 0,
        staff_required: 0,
        is_active: true,
      }));

    const automaticModeEntries = automaticPackages
      .filter((pkg) => pkg.name.trim())
      .map((pkg) => ({
        vehicle_format_id: null,
        vehicle_label: pkg.name.trim(),
        price: pkg.price,
        duration_min: parseInt(pkg.duration, 10) || 0,
        staff_required: 0,
        is_active: pkg.is_active,
      }));

    const selfServiceEntries = [
      {
        vehicle_format_id: null,
        vehicle_label: t('cat_self_service'),
        price: basePrice,
        duration_min: parseInt(baseDuration, 10) || 0,
        staff_required: 0,
        is_active: true,
      },
    ];

    const editHandWashEntries = entries
      .filter((entry) => selectedFormatIds.includes(entry.vehicle_format_id))
      .map((entry) => ({
        vehicle_format_id: entry.vehicle_format_id,
        vehicle_label: entry.vehicle_label,
        price: entry.price,
        duration_min: Math.max(1, Number(entry.duration_min) || 1),
        staff_required: 0,
        is_active: true,
      }));

    if (isEdit && category === 'hand_wash') {
      if (editHandWashEntries.length === 0) {
        setSaving(false);
        setError(t('format_not_in_list'));
        return;
      }
      const hasInvalidPrice = editHandWashEntries.some((entry) => {
        const n = parseFloat(String(entry.price));
        return !Number.isFinite(n) || n <= 0;
      });
      if (hasInvalidPrice) {
        setSaving(false);
        setError(t('price_error_positive'));
        return;
      }
    }

    const payloadEntries = category === 'automatic'
      ? automaticModeEntries
      : category === 'self_service'
      ? selfServiceEntries
      : isEdit
      ? editHandWashEntries
      : createModeEntries;

    if (payloadEntries.length === 0) {
      setSaving(false);
      setError(t('format_not_in_list'));
      return;
    }

    const hasInvalidEntry = payloadEntries.some((entry) => {
      const label = String(entry.vehicle_label ?? '').trim();
      const price = parseFloat(String(entry.price));
      const duration = Number(entry.duration_min);
      return (
        label.length === 0 ||
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isFinite(duration) ||
        duration < 1
      );
    });
    if (hasInvalidEntry) {
      setSaving(false);
      setError(t('price_error_positive'));
      return;
    }

    const payload = {
      name: isEdit ? name.trim() : computedCreateName,
      category,
      service_type: effectiveServiceType,
      description: description.trim(),
      is_active: isActive,
      vehicle_entries: payloadEntries,
      compatible_extra_ids: selectedExtraIds,
      is_popular: service?.is_popular ?? false,
    };

    const [ok, data] = service
      ? await patchWithApi(`/station/services/${service.id}`, payload)
      : await postWithApi('/station/services', payload);

    setSaving(false);

    if (!ok) {
      const msg = (data as { message?: string })?.message;
      setError(msg || t('error_save_failed'));
      return;
    }

    const apiService = (data as { data: Service }).data;
    onSaved(apiService);
  }

  const activeEntries = category === 'automatic'
    ? automaticPackages
        .filter((pkg) => pkg.is_active)
        .map((pkg) => ({
          vehicle_format_id: `auto-${pkg.id}`,
          vehicle_label: pkg.name,
          price: pkg.price,
          duration_min: parseInt(pkg.duration, 10) || 0,
          staff_required: 0,
          is_active: pkg.is_active,
        }))
    : category === 'self_service'
    ? [
        {
          vehicle_format_id: 'self-service',
          vehicle_label: t('cat_self_service'),
          price: basePrice,
          duration_min: parseInt(baseDuration, 10) || 0,
          staff_required: 0,
          is_active: true,
        },
      ]
    : isEdit
    ? entries.filter((e) => selectedFormatIds.includes(e.vehicle_format_id))
    : vehicleFormats
        .filter((f) => selectedFormatIds.includes(f.id))
        .map((f) => ({
          vehicle_format_id: f.id,
          vehicle_label: f.label,
          price: basePrice,
          duration_min: parseInt(baseDuration, 10) || 0,
          staff_required: 0,
          is_active: true,
        }));
  const prices = activeEntries.map((e) => parseFloat(e.price || '0')).filter((p) => !Number.isNaN(p) && p > 0);
  const durations = activeEntries.map((e) => e.duration_min).filter((d) => d > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
  const minDur = durations.length > 0 ? Math.min(...durations) : null;
  const maxDur = durations.length > 0 ? Math.max(...durations) : null;
  const selectedFormats = activeEntries.map((e) => e.vehicle_label);
  const extrasByType: StationExtra[] = effectiveServiceType === 'exterior'
    ? [...availableExtras.exterior, ...availableExtras.both]
    : effectiveServiceType === 'interior'
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

  function addAutomaticPackage() {
    setAutomaticPackages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Forfait ${prev.length + 1}`,
        price: '',
        duration: '30',
        is_active: true,
      },
    ]);
  }

  function removeAutomaticPackage(id: string) {
    setAutomaticPackages((prev) => prev.filter((pkg) => pkg.id !== id));
  }

  function updateAutomaticPackage(id: string, field: 'name' | 'price' | 'duration' | 'is_active', value: string | boolean) {
    setAutomaticPackages((prev) => prev.map((pkg) => (pkg.id === id ? { ...pkg, [field]: value } : pkg)));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-[#E8E4DC] bg-white shadow-xl dark:border-[#1A2A14] dark:bg-[#182214] xl:max-w-6xl"
        onClick={(e) => e.stopPropagation()}
      >
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
          <div className="hover-scrollbar grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
            {/* Left form */}
            <div className="space-y-4">
              {isEdit && (
                <div className="rounded-[10px] border border-[#2A3A20] bg-[#1E2A18] px-3 py-2">
                  <div className="text-[14px] font-black text-[#F0EDD4]">{name || t('placeholder_name')}</div>
                  <div className="text-[11px] text-[#9A9A8A]">{t('preview_category')}: {t(`cat_${category}`)}</div>
                </div>
              )}
              {isEdit && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/55 dark:text-[#9A9A8A]">{t('field_name')}</label>
                <TextField
                  value={name}
                  onChange={setName}
                  prefixIcon={<TagIcon />}
                  placeholder={t('placeholder_name')}
                  maxLength={100}
                  required
                />
              </div>
              )}

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

              {showTypeSelector && (
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
              )}

              {!isEdit && showTypeSelector && (
              <div className="rounded-[10px] border border-[#F0EDE4] bg-[#FAFAF7] p-3 dark:border-[#243020] dark:bg-[#0F1A0C]">
                <div className="mb-1 text-[11px] font-black tracking-[.08em] text-[#C49A1E] uppercase">
                  {category === 'hand_wash' ? t('field_type_handwash') : t('field_type')}
                </div>
                <p className="text-[12px] text-foreground/55 dark:text-[#9A9A8A]">
                  {effectiveServiceType === 'exterior'
                    ? t('type_hint_exterior')
                    : effectiveServiceType === 'interior'
                    ? t('type_hint_interior')
                    : t('type_hint_complete')}
                </p>
              </div>
              )}

              {isCreateAutomatic && (
              <div className="rounded-[10px] border border-[#F0EDE4] bg-[#FAFAF7] p-3 dark:border-[#243020] dark:bg-[#0F1A0C]">
                <div className="mb-1 text-[11px] font-black tracking-[.08em] text-[#C49A1E] uppercase">{t('cat_automatic')}</div>
                <p className="text-[12px] text-foreground/55 dark:text-[#9A9A8A]">
                  {t('type_hint_exterior')}
                </p>
              </div>
              )}

              {isCreateSelfService && (
              <div className="rounded-[10px] border border-[#F0EDE4] bg-[#FAFAF7] p-3 dark:border-[#243020] dark:bg-[#0F1A0C]">
                <div className="mb-1 text-[11px] font-black tracking-[.08em] text-[#C49A1E] uppercase">{t('cat_self_service')}</div>
                <p className="text-[12px] text-foreground/55 dark:text-[#9A9A8A]">
                  {t('type_hint_exterior')}
                </p>
              </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/55 dark:text-[#9A9A8A]">{t('field_description')}</label>
                <Textarea
                  value={description}
                  onChange={setDescription}
                  placeholder={t('placeholder_description')}
                  rows={3}
                  maxLength={500}
                  showCounter
                />
              </div>

              {(category === 'hand_wash' || category === 'self_service') && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/55 dark:text-[#9A9A8A]">{t('format_field_price')}</label>
                    <NumberStepper
                      value={basePrice}
                      onChange={setBasePrice}
                      min={0}
                      step={0.5}
                      unit="$"
                    />
                  </div>
                  {showDurationField && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/55 dark:text-[#9A9A8A]">{t('vehicle_col_duration')}</label>
                    <NumberStepper
                      value={baseDuration}
                      onChange={setBaseDuration}
                      min={1}
                      step={5}
                      unit="min"
                    />
                  </div>
                  )}
                </div>
              )}

              {showAutomaticPackagesSection && (
                <div className="flex flex-col gap-2 rounded-[10px] border border-[#F0EDE4] bg-[#FAFAF7] p-3 dark:border-[#243020] dark:bg-[#0F1A0C]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black tracking-[.08em] text-[#C49A1E] uppercase">{t('automatic_packages_label')}</span>
                    <button
                      type="button"
                      onClick={addAutomaticPackage}
                      className="rounded-[8px] border border-[#C49A1E]/50 px-2.5 py-1 text-[11px] font-bold text-[#C49A1E] transition-colors hover:bg-[#FDF3D8] dark:hover:bg-[#2A1E08]"
                    >
                      {t('automatic_add_package')}
                    </button>
                  </div>
                  {automaticPackages.length === 0 ? (
                    <p className="text-[12px] text-foreground/55 dark:text-[#9A9A8A]">{t('automatic_empty_packages')}</p>
                  ) : (
                    <div className="space-y-2">
                      {automaticPackages.map((pkg) => (
                        <div key={pkg.id} className="rounded-xl border border-[#E8E4DC] bg-white p-3 dark:border-[#243020] dark:bg-[#182214]">
                          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <TextField
                              value={pkg.name}
                              onChange={(v) => updateAutomaticPackage(pkg.id, 'name', v)}
                              placeholder={t('automatic_package_name')}
                            />
                            <TextField
                              value={pkg.price}
                              onChange={(v) => updateAutomaticPackage(pkg.id, 'price', v)}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={0.5}
                              placeholder={t('field_price_cad')}
                              suffix={<span className="text-[11px] font-bold text-[#BBBBAA] dark:text-[#5A5A4A]">$</span>}
                            />
                            <TextField
                              value={pkg.duration}
                              onChange={(v) => updateAutomaticPackage(pkg.id, 'duration', v)}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              step={5}
                              placeholder={t('vehicle_col_duration')}
                              suffix={<span className="text-[11px] font-bold text-[#BBBBAA] dark:text-[#5A5A4A]">min</span>}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => removeAutomaticPackage(pkg.id)}
                              className="rounded-lg border border-[#FF2525]/30 bg-[#FF2525]/5 px-2.5 py-1 text-[11px] font-bold text-[#FF2525] transition-colors hover:bg-[#FF2525]/10"
                            >
                              {t('btn_delete')}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateAutomaticPackage(pkg.id, 'is_active', !pkg.is_active)}
                              aria-pressed={pkg.is_active}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide transition-colors ${
                                pkg.is_active
                                  ? 'border-[#22C47A]/40 bg-[#22C47A]/12 text-[#16A964] hover:bg-[#22C47A]/20'
                                  : 'border-[#888]/30 bg-[#888]/10 text-foreground/55 hover:bg-[#888]/15 dark:text-[#9A9A8A]'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${pkg.is_active ? 'bg-[#22C47A]' : 'bg-[#888]'}`} aria-hidden="true" />
                              {pkg.is_active ? t('badge_active') : t('badge_inactive')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showFormatSection && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black uppercase tracking-[1.5px] text-[#C49A1E]">
                  {t('field_vehicle_formats')}
                </label>
                {vehicleFormats.length === 0 ? (
                  <p className="text-[12px] text-[#AAAAAA] dark:text-[#5A5A4A]">
                    {t('no_formats')}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {vehicleFormats.map((format) => {
                      const selected = selectedFormatIds.includes(format.id);
                      return (
                        <button
                          key={format.id}
                          type="button"
                          onClick={() => toggleFormat(format.id)}
                          className={`flex items-center gap-2 rounded-[8px] border px-3 py-2.5 text-left text-[12px] font-semibold transition-all ${
                            selected
                              ? 'border-[#C49A1E] bg-[#FDF3D8] text-[#C49A1E] dark:bg-[#2A1E08]'
                              : 'border-[#D8D4C8] bg-[#F7F6F2] text-[#5A5A4A] dark:border-[#243020] dark:bg-[#182214] dark:text-[#9A9A8A]'
                          }`}
                        >
                          <span
                            className={`h-3.5 w-3.5 shrink-0 rounded border ${selected ? 'border-[#C49A1E] bg-[#C49A1E]' : 'border-[#AAA] bg-transparent'}`}
                            aria-hidden="true"
                          />
                          <span>{format.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {isEdit && showFormatSection && (
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
                  unavailableMessage={t('format_not_in_list')}
                />
              </div>
              )}

              {showExtrasSection && (
              <div className="flex flex-col gap-2 rounded-[10px] border border-[#F0EDE4] bg-[#FAFAF7] p-3 dark:border-[#243020] dark:bg-[#0F1A0C]">
                <span className="text-[11px] font-black tracking-[.08em] text-[#C49A1E] uppercase">
                  {t('extras_label')}
                </span>
                {extrasByType.length === 0 ? (
                  <p className="text-[12px] text-foreground/55 dark:text-[#9A9A8A]">{t('extras_empty_modal')}</p>
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
              )}

              <div className="flex items-center justify-between rounded-[10px] border border-[#2A3A20] bg-[#1E2A18] px-4 py-3">
                <span className="text-[13px] font-semibold text-[#F0EDD4]">{t('toggle_active')}</span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
                    isActive
                      ? 'border-[#2ecc71] bg-[rgba(46,204,113,.12)] text-[#2ecc71]'
                      : 'border-[#888] bg-[rgba(136,136,136,.12)] text-foreground/55'
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
                <div className="text-[15px] font-black">{isEdit ? (name || t('placeholder_name')) : computedCreateName}</div>
                <div className="mt-1 text-[11px] text-[#B7AE8A]">{t('preview_category')}: {t(`cat_${category}`)}</div>
                <div className="mt-3 space-y-2 text-[12px]">
                  <div className="flex items-center justify-between border-b border-[#5A4630] pb-1">
                    <span className="text-[#B7AE8A]">{t('preview_price')}</span>
                    <span className="font-bold text-[#C49A1E]">
                      {!isEdit ? `${basePrice || '--'}$` : (minPrice !== null ? (minPrice === maxPrice ? `${minPrice}$` : `${minPrice}$ - ${maxPrice}$`) : '--')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#5A4630] pb-1">
                    <span className="text-[#B7AE8A]">{t('preview_duration')}</span>
                    <span className="font-bold">
                      {showDurationField
                        ? (!isEdit ? `${baseDuration || '--'} min` : (minDur !== null ? (minDur === maxDur ? `${minDur} min` : `${minDur}-${maxDur} min`) : '--'))
                        : '--'}
                    </span>
                  </div>
                  {showFormatSection && (
                  <div className="pt-1">
                    <span className="text-[#B7AE8A]">{t('preview_formats')}</span>
                    <div className="mt-1 text-[11px] font-semibold">
                      {selectedFormats.length > 0 ? selectedFormats.join('; ') : '--'}
                    </div>
                  </div>
                  )}
                  {showExtrasSection && (
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
                  )}
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
              disabled={saving || (isEdit && !name.trim())}
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

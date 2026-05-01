'use client';

import { useState, useEffect } from 'react';
import { postWithApi, updateWithApi } from '@/services';
import { TextField } from '@/components/station/config/TextField';
import { NumberStepper } from '@/components/station/config/NumberStepper';
import type { StationExtra } from '@/components/station/config/StationExtrasForm';
import type { Service, VehicleFormat } from './types';

interface ExtraVehicleEntry {
  vehicle_format_id: string;
  vehicle_label: string;
  price: string;
  duration_min: string;
  staff_required: string;
  is_active: boolean;
}

interface Props {
  extra: StationExtra | null;
  vehicleFormats: VehicleFormat[];
  services: Service[];
  onClose: () => void;
  onSaved: (extra: StationExtra) => void;
}

function buildVehicleEntries(formats: VehicleFormat[], extra?: StationExtra | null): ExtraVehicleEntry[] {
  return formats.map((f) => ({
    vehicle_format_id: f.id,
    vehicle_label: f.label,
    price: extra?.price ?? '',
    duration_min: '',
    staff_required: '0',
    is_active: true,
  }));
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-[0.5px] text-[#888] dark:text-[#9A9A8A]">
      {children}
    </label>
  );
}

export function ExtraModal({ extra, vehicleFormats, services, onClose, onSaved }: Props) {
  const isEdit = extra !== null;

  // Create mode fields
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [staff, setStaff] = useState('0');

  // Edit mode fields
  const [editName, setEditName] = useState('');
  const [vehicleEntries, setVehicleEntries] = useState<ExtraVehicleEntry[]>([]);

  // Shared
  const [compatServiceIds, setCompatServiceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (extra) {
      setEditName(extra.label);
      setVehicleEntries(buildVehicleEntries(vehicleFormats, extra));
      setCompatServiceIds([]);
    } else {
      setEditName('');
      setName('');
      setPrice('');
      setDuration('');
      setStaff('0');
      setCompatServiceIds([]);
    }
    setError(null);
  }, [extra, vehicleFormats]);

  function toggleCompatService(id: string) {
    setCompatServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function updateVehicleEntry(idx: number, field: keyof ExtraVehicleEntry, value: string | boolean) {
    setVehicleEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && !name.trim()) {
      setError('Le nom est requis');
      return;
    }
    if (isEdit && !editName.trim()) {
      setError('Le nom est requis');
      return;
    }
    setSaving(true);
    setError(null);

    const payload: StationExtra = {
      id: extra?.id ?? crypto.randomUUID(),
      label: isEdit ? editName.trim() : name.trim(),
      description: '',
      price: isEdit ? (vehicleEntries[0]?.price ?? '') : price,
      is_active: extra?.is_active ?? true,
    };

    const [ok] = extra
      ? await updateWithApi(`/station/extras/${extra.id}`, payload)
      : await postWithApi('/station/extras', payload);

    setSaving(false);

    if (!ok) {
      // TODO: connect to API once endpoint is available — fallback save for now
    }
    onSaved(payload);
  }

  // Preview computed values
  const previewName = name.trim() || "Nom de l'extra";
  const previewPrice = price || '0';
  const previewDuration = duration || '0';
  const previewStaff = staff || '0';
  const compatCount = compatServiceIds.length;

  function getServiceDurationRange(svc: Service): string {
    const mins = svc.vehicle_entries.filter((e) => e.is_active).map((e) => e.duration_min);
    if (mins.length === 0) return '';
    const min = Math.min(...mins);
    const max = Math.max(...mins);
    return min === max ? `${min} min` : `${min}-${max} min`;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Modifier extra' : 'Créer un extra'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col rounded-2xl border border-[#E8E4DC] bg-white shadow-xl dark:border-[#1A2A14] dark:bg-[#182214] ${
          isEdit ? 'max-w-[680px]' : 'max-w-[540px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center border-b border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14] ${
            isEdit ? '' : 'justify-center'
          }`}
        >
          <span
            className={`text-[16px] font-black text-[#1A1A0A] dark:text-[#F0EDD4] ${isEdit ? '' : 'text-center w-full'}`}
          >
            {isEdit ? 'Modifier extra' : 'Créer un extra'}
          </span>
          {isEdit && (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-[#999] transition-colors hover:bg-[#F0EDE4] hover:text-[#333] dark:text-[#5A5A4A] dark:hover:bg-[#243020] dark:hover:text-[#F0EDD4]"
              aria-label="Fermer"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {/* CREATE MODE */}
            {!isEdit && (
              <div className="space-y-4 p-5">
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Nom de l&apos;extra</FieldLabel>
                  <TextField
                    value={name}
                    onChange={setName}
                    placeholder="Ex: Cirage premium"
                    maxLength={80}
                    required
                  />
                </div>

                {/* Price + Duration */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Prix supplémentaire (CAD)</FieldLabel>
                    <NumberStepper value={price} onChange={setPrice} min={0} step={0.5} unit="$" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Durée supplémentaire</FieldLabel>
                    <NumberStepper value={duration} onChange={setDuration} min={0} step={5} unit="min" />
                  </div>
                </div>

                {/* Staff */}
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Personnel requis</FieldLabel>
                  <NumberStepper value={staff} onChange={setStaff} min={0} step={1} />
                  <span className="text-[11px] text-[#AAAAAA] dark:text-[#5A5A4A]">
                    Laissez 0 si l&apos;extra n&apos;utilise pas de personnel supplémentaire
                  </span>
                </div>

                {/* Compatible services */}
                <CompatServicesSection
                  services={services}
                  compatServiceIds={compatServiceIds}
                  onToggle={toggleCompatService}
                  getDurationRange={getServiceDurationRange}
                />

                {/* Preview */}
                <div className="rounded-xl border border-[#C49A1E]/20 bg-[#FFFDF5] p-4 dark:border-[#C49A1E]/20 dark:bg-[#1A1808]">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-[#C49A1E]">Aperçu</div>
                  <div className="text-[13px] text-[#5A5A4A] dark:text-[#9A9A8A]">
                    <span className="font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{previewName}</span> : +
                    {previewPrice} $ · +{previewDuration} min
                  </div>
                  <div className="mt-1 text-[12px] text-[#888] dark:text-[#9A9A8A]">
                    Personnel nécessaire : {previewStaff}
                  </div>
                  <div className="text-[12px] text-[#888] dark:text-[#9A9A8A]">
                    Compatible avec {compatCount} service{compatCount !== 1 ? 's' : ''}
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-[#FF2525]/30 bg-[#FF2525]/10 px-3 py-2 text-[12px] font-semibold text-[#FF2525]">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* EDIT MODE */}
            {isEdit && (
              <div className="p-5">
                {/* Name */}
                <div className="mb-3 flex flex-col gap-1.5">
                  <FieldLabel>Nom de l&apos;extra</FieldLabel>
                  <TextField value={editName} onChange={setEditName} maxLength={80} required />
                </div>
                <div className="mb-4 h-px bg-[#F0EDE4] dark:bg-[#1A2A14]" />

                {/* Vehicle rows */}
                {vehicleEntries.length > 0 ? (
                  <div className="mb-4 space-y-2">
                    {vehicleEntries.map((entry, idx) => (
                      <div
                        key={entry.vehicle_format_id}
                        className="flex flex-wrap items-end gap-3 rounded-xl bg-[#F7F6F2] px-3 py-3 dark:bg-[#0F1A0C]"
                      >
                        <div className="w-[80px] shrink-0 self-center text-[11px] font-black uppercase tracking-[0.6px] text-[#C49A1E]">
                          {entry.vehicle_label}
                        </div>
                        <div className="min-w-[110px] flex-1">
                          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.6px] text-[#888] dark:text-[#5A5A4A]">
                            PRIX
                          </p>
                          <TextField
                            value={entry.price}
                            onChange={(v) => updateVehicleEntry(idx, 'price', v)}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.5}
                            suffix={<span className="text-[11px] font-bold text-[#BBBBAA] dark:text-[#5A5A4A]">$</span>}
                          />
                        </div>
                        <div className="min-w-[110px] flex-1">
                          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.6px] text-[#888] dark:text-[#5A5A4A]">
                            DURÉE
                          </p>
                          <TextField
                            value={entry.duration_min}
                            onChange={(v) => updateVehicleEntry(idx, 'duration_min', v)}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={5}
                            suffix={<span className="text-[11px] font-bold text-[#BBBBAA] dark:text-[#5A5A4A]">min</span>}
                          />
                        </div>
                        <div className="w-[90px] shrink-0">
                          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.6px] text-[#888] dark:text-[#5A5A4A]">
                            PERSONNEL
                          </p>
                          <TextField
                            value={entry.staff_required}
                            onChange={(v) => updateVehicleEntry(idx, 'staff_required', v)}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                          />
                        </div>
                        <div className="flex shrink-0 flex-col items-center gap-1 self-center">
                          <p className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#888] dark:text-[#5A5A4A]">
                            Actif
                          </p>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={entry.is_active}
                            aria-label={`Activer ${entry.vehicle_label}`}
                            onClick={() => updateVehicleEntry(idx, 'is_active', !entry.is_active)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              entry.is_active ? 'bg-[#C49A1E]' : 'bg-[#D8D4C8] dark:bg-[#243020]'
                            }`}
                          >
                            <span
                              className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                entry.is_active ? 'translate-x-[22px]' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mb-4 rounded-xl border border-dashed border-[#E0DCD0] py-4 text-center text-[12px] text-[#888] dark:border-[#243020] dark:text-[#5A5A4A]">
                    Aucun format véhicule configuré
                  </div>
                )}

                <CompatServicesSection
                  services={services}
                  compatServiceIds={compatServiceIds}
                  onToggle={toggleCompatService}
                  getDurationRange={getServiceDurationRange}
                />

                {error && (
                  <div className="mt-3 rounded-lg border border-[#FF2525]/30 bg-[#FF2525]/10 px-3 py-2 text-[12px] font-semibold text-[#FF2525]">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className={`border-t border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14] ${
              !isEdit ? 'flex flex-col gap-2' : 'flex items-center justify-end gap-2'
            }`}
          >
            {!isEdit ? (
              <>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-[#C49A1E] py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                  {saving ? 'Création…' : "Créer l'extra"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl border border-[#E0DCD0] py-2.5 text-[13px] font-semibold text-[#666] transition-colors hover:bg-[#F0EDE0] dark:border-[#243020] dark:text-[#9A9A8A]"
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-[#E0DCD0] px-4 py-2.5 text-[13px] font-semibold text-[#666] transition-colors hover:bg-[#F0EDE0] dark:border-[#243020] dark:text-[#9A9A8A]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#C49A1E] px-5 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

interface CompatProps {
  services: Service[];
  compatServiceIds: string[];
  onToggle: (id: string) => void;
  getDurationRange: (svc: Service) => string;
}

function CompatServicesSection({ services, compatServiceIds, onToggle, getDurationRange }: CompatProps) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-black uppercase tracking-[0.5px] text-[#C49A1E]">
        Compatible avec les services
      </div>
      <div className="mb-2 text-[12px] text-[#888] dark:text-[#9A9A8A]">
        Sélectionnez les services auxquels cet extra peut être ajouté
      </div>
      {services.length === 0 ? (
        <div className="text-[12px] text-[#AAAAAA] dark:text-[#5A5A4A]">Aucun service disponible</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {services.map((svc) => {
            const selected = compatServiceIds.includes(svc.id);
            const range = getDurationRange(svc);
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => onToggle(svc.id)}
                aria-pressed={selected}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold transition-colors ${
                  selected
                    ? 'border-[#C49A1E] bg-[#C49A1E]/12 text-[#C49A1E]'
                    : 'border-[#E0DCD0] bg-white text-[#5A5A4A] hover:border-[#C49A1E]/40 dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#9A9A8A]'
                }`}
              >
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                    selected ? 'border-[#C49A1E] bg-[#C49A1E]' : 'border-[#AAA] bg-transparent'
                  }`}
                  aria-hidden="true"
                >
                  {selected && (
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-7" stroke="#0C1209" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span>{svc.name}</span>
                {range && (
                  <span className={`text-[9px] ${selected ? 'text-[#C49A1E]/70' : 'text-[#AAAAAA] dark:text-[#5A5A4A]'}`}>
                    {range}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

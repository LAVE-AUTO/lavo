'use client';

import { useState, useEffect } from 'react';
import { postWithApi, updateWithApi } from '@/services';
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

const inputClass =
  'w-full rounded-[8px] border border-[#CCCCAA] bg-[#EDE9CC] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none transition-colors duration-150 focus:border-[#C49A1E] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]';

const vehicleInputClass =
  'w-full rounded-[6px] border border-[#CCCCAA] bg-[#EDE9CC] px-2.5 py-2 text-[13px] text-[#1A1A0A] outline-none focus:border-[#C49A1E] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]';

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
    setCompatServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
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
      price: isEdit
        ? (vehicleEntries[0]?.price ?? '')
        : price,
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
  const previewName = name.trim() || 'Nom de l\'extra';
  const previewPrice = price || '0';
  const previewDuration = duration || '0';
  const previewStaff = staff || '0';
  const compatCount = compatServiceIds.length;

  // Duration range for service chips
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
      aria-label={isEdit ? 'Modifier EXTRA' : 'Créer un extra'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col rounded-[10px] border border-[#2A3A20] bg-[#182214] shadow-xl ${isEdit ? 'max-w-[640px]' : 'max-w-[520px]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className={`flex items-center border-b border-[#2A3A20] px-5 py-[18px] ${isEdit ? '' : 'justify-center'}`}>
          <span className={`text-[17px] font-black text-[#F0EDD4] ${isEdit ? '' : 'text-center w-full'}`}>
            {isEdit ? 'Modifier EXTRA' : 'Créer un extra'}
          </span>
          {isEdit && (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-[#9A9A8A] transition-colors hover:bg-[#243020] hover:text-[#F0EDD4]"
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
            {/* ── CREATE MODE ── */}
            {!isEdit && (
              <div className="space-y-4 p-5">
                {/* Nom */}
                <div className="flex flex-col gap-1.5">
                  <label className="block text-[12px] font-bold text-[#9A9A8A]">
                    Nom de l&apos;extra
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Cirage premium"
                    maxLength={80}
                    className={inputClass}
                  />
                </div>

                {/* Prix + Durée */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-[12px] font-bold text-[#9A9A8A]">
                      Prix supplémentaire (CAD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-[12px] font-bold text-[#9A9A8A]">
                      Durée supplémentaire (min)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Personnel requis */}
                <div className="flex flex-col gap-1.5">
                  <label className="block text-[12px] font-bold text-[#9A9A8A]">
                    Personnel Requis
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={staff}
                    onChange={(e) => setStaff(e.target.value)}
                    className={inputClass}
                  />
                  <span className="text-[10px] text-[#5A5A4A]">
                    Laissez 0 si l&apos;extra n&apos;utilise pas de personnel supplémentaire
                  </span>
                </div>

                {/* Compatible avec les services */}
                <CompatServicesSection
                  services={services}
                  compatServiceIds={compatServiceIds}
                  onToggle={toggleCompatService}
                  getDurationRange={getServiceDurationRange}
                />

                {/* Aperçu */}
                <div className="rounded-[10px] bg-[#2A2010] p-3.5">
                  <div className="mb-2 text-[12px] font-black text-[#F0EDD4]">Aperçu</div>
                  <div className="mb-1 text-[12px] text-[#9A9A8A]">
                    {previewName}: +{previewPrice}$ | +{previewDuration} min
                  </div>
                  <div className="mb-1 text-[12px] text-[#9A9A8A]">
                    Personnel nécessaire : {previewStaff}
                  </div>
                  <div className="text-[12px] text-[#9A9A8A]">
                    Compatible avec {compatCount} service{compatCount !== 1 ? 's' : ''}
                  </div>
                </div>

                {error && (
                  <div className="rounded-[8px] bg-[rgba(255,37,37,.1)] px-3 py-2 text-[12px] font-semibold text-[#FF2525]">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* ── EDIT MODE ── */}
            {isEdit && (
              <div className="p-5">
                {/* Name + divider */}
                <div className="mb-3 flex flex-col gap-1.5">
                  <label className="block text-[12px] font-bold text-[#9A9A8A]">Nom de l&apos;extra</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={80}
                    className={inputClass}
                  />
                </div>
                <div className="mb-4 h-px bg-[#2A3A20]" />

                {/* Vehicle rows */}
                {vehicleEntries.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {vehicleEntries.map((entry, idx) => (
                      <div
                        key={entry.vehicle_format_id}
                        className="flex items-center gap-2 rounded-[10px] bg-[#0F1A0C] px-3.5 py-3"
                      >
                        {/* Label */}
                        <div className="w-[70px] shrink-0 text-[11px] font-black uppercase tracking-[.06em] text-[#C49A1E]">
                          {entry.vehicle_label}
                        </div>

                        {/* Prix */}
                        <div className="flex-1">
                          <div className="mb-1 text-[9px] font-bold uppercase tracking-[.06em] text-[#5A5A4A]">PRIX ($)</div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={entry.price}
                            onChange={(e) => updateVehicleEntry(idx, 'price', e.target.value)}
                            className={vehicleInputClass}
                          />
                        </div>

                        {/* Durée */}
                        <div className="flex-1">
                          <div className="mb-1 text-[9px] font-bold uppercase tracking-[.06em] text-[#5A5A4A]">DURÉE (MIN)</div>
                          <input
                            type="number"
                            min="0"
                            value={entry.duration_min}
                            onChange={(e) => updateVehicleEntry(idx, 'duration_min', e.target.value)}
                            className={vehicleInputClass}
                          />
                        </div>

                        {/* Personnel */}
                        <div className="flex-1">
                          <div className="mb-1 text-[9px] font-bold uppercase tracking-[.06em] text-[#5A5A4A]">PERSONNEL REQUIS</div>
                          <input
                            type="number"
                            min="0"
                            value={entry.staff_required}
                            onChange={(e) => updateVehicleEntry(idx, 'staff_required', e.target.value)}
                            className={vehicleInputClass}
                          />
                        </div>

                        {/* Toggle */}
                        <div className="flex shrink-0 flex-col items-center gap-1">
                          <div className="text-[9px] font-bold uppercase tracking-[.06em] text-[#5A5A4A]">Extra actif</div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={entry.is_active}
                            aria-label={`Activer ${entry.vehicle_label}`}
                            onClick={() => updateVehicleEntry(idx, 'is_active', !entry.is_active)}
                            className={`relative h-[24px] w-[44px] rounded-full transition-colors ${entry.is_active ? 'bg-[#C49A1E]' : 'bg-[#2A3A20]'}`}
                          >
                            <span
                              className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${entry.is_active ? 'translate-x-[23px]' : 'translate-x-[3px]'}`}
                            />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mb-4 rounded-[10px] border border-dashed border-[#2A3A20] py-4 text-center text-[12px] text-[#5A5A4A]">
                    Aucun format véhicule configuré
                  </div>
                )}

                {/* Compatible avec les services */}
                <CompatServicesSection
                  services={services}
                  compatServiceIds={compatServiceIds}
                  onToggle={toggleCompatService}
                  getDurationRange={getServiceDurationRange}
                />

                {error && (
                  <div className="mt-3 rounded-[8px] bg-[rgba(255,37,37,.1)] px-3 py-2 text-[12px] font-semibold text-[#FF2525]">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div
            className={`border-t border-[#2A3A20] px-5 py-3.5 ${!isEdit ? 'flex flex-col gap-2' : 'flex items-center justify-end gap-2.5'}`}
          >
            {!isEdit ? (
              <>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-[8px] bg-[#C49A1E] py-2.5 text-[13px] font-black text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {saving ? 'Création...' : 'Créer l\'extra'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-[8px] bg-[#2A3A20] py-2.5 text-center text-[13px] font-bold text-[#9A9A8A] transition-colors hover:text-[#F0EDD4]"
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[8px] bg-[#2A3A20] px-5 py-2.5 text-[13px] font-bold text-[#9A9A8A] transition-colors hover:text-[#F0EDD4]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-[8px] bg-[#C49A1E] px-5 py-2.5 text-[13px] font-black text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer le service'}
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
      <div className="mb-1 text-[10px] font-black uppercase tracking-[.1em] text-[#C49A1E]">
        COMPATIBLE AVEC LES SERVICES
      </div>
      <div className="mb-2 text-[11px] text-[#5A5A4A]">
        Sélectionnez les services auxquels cet extra peut être ajouté
      </div>
      {services.length === 0 ? (
        <div className="text-[11px] text-[#5A5A4A]">Aucun service disponible</div>
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
                className={`flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-[11px] font-bold transition-colors ${
                  selected
                    ? 'bg-[#C49A1E] text-[#1A1A0A]'
                    : 'bg-[#0F1A0C] text-[#9A9A8A] hover:text-[#F0EDD4]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  readOnly
                  tabIndex={-1}
                  className="pointer-events-none h-3 w-3 accent-[#C49A1E]"
                  aria-hidden="true"
                />
                <span>{svc.name}</span>
                {range && (
                  <span className={`text-[9px] ${selected ? 'text-[rgba(26,26,10,.6)]' : 'text-[#555]'}`}>
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

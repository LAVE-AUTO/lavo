'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { patchWithApi } from '@/services';
import { TextField } from './TextField';

export interface StationLocation {
  address: string;
  city: string;
  latitude: string | null;
  longitude: string | null;
}

interface Props {
  location: StationLocation;
  onSaved: (location: StationLocation) => void;
  locked?: boolean;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/55 dark:text-[#B0BFB1]">
        {label}
      </label>
      {children}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-[#C8C4B4] dark:text-[#2E3C2A]">{label}</p>
      <p className="text-[13px] font-semibold text-[#001201] dark:text-[#FFF9EC]">{value || '-'}</p>
    </div>
  );
}

const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="9" y1="22" x2="9" y2="18" />
    <line x1="15" y1="22" x2="15" y2="18" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="16" y2="14" />
  </svg>
);

const GeoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
  </svg>
);

function validateCoord(val: string, min: number, max: number) {
  if (!val) return true;
  const n = parseFloat(val);
  return !isNaN(n) && n >= min && n <= max;
}

export function StationLocationForm({ location, onSaved, locked = false }: Props) {
  const t = useTranslations('station_config');
  const { success, error: showError } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [address, setAddress] = useState(location.address);
  const [city, setCity] = useState(location.city);
  const [lat, setLat] = useState(location.latitude ?? '');
  const [lng, setLng] = useState(location.longitude ?? '');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  async function reverseGeocode(latitude: number, longitude: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { 'Accept-Language': 'fr' } },
      );
      const data = await res.json();
      if (data?.address) {
        const { house_number, road, city: c, town, village, suburb } = data.address;
        const street = [house_number, road].filter(Boolean).join(' ');
        if (street) setAddress(street);
        const cityName = c || town || village || suburb || '';
        if (cityName) setCity(cityName);
      }
    } catch {
      // Reverse geocoding failed - coordinates remain set
    }
  }

  function handleGeolocate() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude.toFixed(7));
        setLng(longitude.toFixed(7));
        await reverseGeocode(latitude, longitude);
        setGeoLoading(false);
      },
      () => {
        setGeoError(true);
        setGeoLoading(false);
      },
    );
  }

  function handleCancel() {
    setAddress(location.address);
    setCity(location.city);
    setLat(location.latitude ?? '');
    setLng(location.longitude ?? '');
    setGeoError(false);
    setErrors({});
    setIsEditing(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, boolean> = {};
    if (!address.trim()) next.address = true;
    if (!city.trim()) next.city = true;
    if (lat && !validateCoord(lat, -90, 90)) next.lat = true;
    if (lng && !validateCoord(lng, -180, 180)) next.lng = true;

    if (Object.keys(next).length > 0) {
      setErrors(next);
      if (next.address) showError(t('error_address_empty'));
      else if (next.city) showError(t('error_city_empty'));
      else if (next.lat) showError(t('geo_invalid_lat'));
      else if (next.lng) showError(t('geo_invalid_lng'));
      return;
    }

    setErrors({});
    setSaving(true);

    const payload = {
      address: address.trim(),
      city: city.trim(),
      latitude: lat.trim() ? Number(lat) : null,
      longitude: lng.trim() ? Number(lng) : null,
    };

    const [ok, data] = await patchWithApi('/station/me', payload);

    if (ok) {
      const station = (data as {
        data?: {
          address?: string;
          city?: string;
          latitude?: number | string | null;
          longitude?: number | string | null;
        };
      })?.data;

      const nextLocation: StationLocation = {
        address: station?.address ?? payload.address,
        city: station?.city ?? payload.city,
        latitude:
          station?.latitude !== undefined
            ? (station.latitude == null ? null : String(station.latitude))
            : (payload.latitude == null ? null : String(payload.latitude)),
        longitude:
          station?.longitude !== undefined
            ? (station.longitude == null ? null : String(station.longitude))
            : (payload.longitude == null ? null : String(payload.longitude)),
      };

      onSaved(nextLocation);
      setAddress(nextLocation.address);
      setCity(nextLocation.city);
      setLat(nextLocation.latitude ?? '');
      setLng(nextLocation.longitude ?? '');
      success(t('location_save_success'));
      setIsEditing(false);
    } else {
      showError(t('location_save_error'));
    }

    setSaving(false);
  }

  return (
    <section className="rounded-2xl border border-[#FFF9EC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
      <div className="flex items-center gap-2.5 border-b border-[#F0EDE4] px-5 py-3.5 dark:border-[#1A2A14]">
        <span className="h-4 w-[3px] rounded-full bg-[#DDAF3B]" />
        <span className="flex-1 text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{t('section_location')}</span>
        {!isEditing && !locked && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 rounded-[8px] border border-[#DDAF3B]/40 px-3 py-1 text-[13px] font-semibold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/8"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            {t('btn_edit')}
          </button>
        )}
      </div>

      <div className="p-5">
        {!isEditing ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4 rounded-xl bg-[#FFF9EC] px-4 py-3.5 dark:bg-[#001201]">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#DDAF3B]/15 text-[#DDAF3B]">
                <PinIcon />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">{t('field_address')}</p>
                <p className="text-[14px] font-bold text-[#001201] dark:text-[#FFF9EC]">{location.address || '-'}</p>
                <p className="text-[13px] font-semibold text-foreground/55 dark:text-[#B0BFB1]">{location.city || '-'}</p>
              </div>
            </div>
            {(location.latitude || location.longitude) && (
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C8C4B4] dark:text-[#2E3C2A]">{t('field_latitude')} / {t('field_longitude')}</p>
                  <p className="font-mono text-[13px] font-semibold text-foreground/55 dark:text-[#B0BFB1]">
                    {[location.latitude, location.longitude].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label={t('field_address')}>
                  <TextField
                    value={address}
                    onChange={(v) => {
                      setAddress(v);
                      if (errors.address && v.trim()) setErrors((p) => ({ ...p, address: false }));
                    }}
                    prefixIcon={<PinIcon />}
                    required
                    maxLength={200}
                    invalid={errors.address}
                    autoComplete="street-address"
                  />
                </Field>
              </div>
              <Field label={t('field_city')}>
                <TextField
                  value={city}
                  onChange={(v) => {
                    setCity(v);
                    if (errors.city && v.trim()) setErrors((p) => ({ ...p, city: false }));
                  }}
                  prefixIcon={<BuildingIcon />}
                  required
                  maxLength={100}
                  invalid={errors.city}
                  autoComplete="address-level2"
                />
              </Field>
              <div />
              <Field label={t('field_latitude')}>
                <TextField
                  value={lat}
                  onChange={(v) => {
                    setLat(v);
                    if (errors.lat) setErrors((p) => ({ ...p, lat: false }));
                  }}
                  prefixBadge="LAT"
                  inputMode="decimal"
                  inputClassName="font-mono"
                  placeholder="45.5017000"
                  maxLength={20}
                  invalid={errors.lat}
                />
              </Field>
              <Field label={t('field_longitude')}>
                <TextField
                  value={lng}
                  onChange={(v) => {
                    setLng(v);
                    if (errors.lng) setErrors((p) => ({ ...p, lng: false }));
                  }}
                  prefixBadge="LNG"
                  inputMode="decimal"
                  inputClassName="font-mono"
                  placeholder="-73.5673000"
                  maxLength={20}
                  invalid={errors.lng}
                />
              </Field>
              <div className="col-span-2 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleGeolocate}
                  disabled={geoLoading}
                  className="flex w-fit items-center gap-2 rounded-xl border border-[#DDAF3B] px-4 py-2 text-[13px] font-semibold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B] hover:text-[#001201] disabled:opacity-50"
                >
                  <GeoIcon />
                  {geoLoading ? t('geolocating') : t('btn_geolocate')}
                </button>
                {geoError && <p className="text-[12px] font-semibold text-[#EF4444]">{t('geo_error')}</p>}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="rounded-xl border border-[#FFF9EC] px-4 py-2.5 text-[13px] font-semibold text-foreground/65 transition-colors hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-[#001A05] dark:text-[#B0BFB1]"
              >
                {t('btn_cancel_edit')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#DDAF3B] px-6 py-2.5 text-[13px] font-bold text-[#001201] transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {saving ? t('btn_saving') : t('btn_save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

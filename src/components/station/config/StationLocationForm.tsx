'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

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

const inputClass =
  'w-full rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none transition-colors duration-150 placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] dark:focus:border-[#C49A1E] dark:focus:bg-[#182214]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{label}</label>
      {children}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#C8C4B4] dark:text-[#2E3C2A]">{label}</p>
      <p className="text-[13px] font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{value || '—'}</p>
    </div>
  );
}

const GeoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
  </svg>
);

export function StationLocationForm({ location, onSaved, locked = false }: Props) {
  const t = useTranslations('station_config');

  const [isEditing, setIsEditing] = useState(false);
  const [address, setAddress]     = useState(location.address);
  const [city, setCity]           = useState(location.city);
  const [lat, setLat]             = useState(location.latitude ?? '');
  const [lng, setLng]             = useState(location.longitude ?? '');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [feedback, setFeedback]     = useState<{ ok: boolean; msg: string } | null>(null);

  async function reverseGeocode(latitude: number, longitude: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { 'Accept-Language': 'fr' } }
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
      // Reverse geocoding failed — coordinates remain set
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
      }
    );
  }

  function handleCancel() {
    setAddress(location.address);
    setCity(location.city);
    setLat(location.latitude ?? '');
    setLng(location.longitude ?? '');
    setGeoError(false);
    setFeedback(null);
    setIsEditing(false);
  }

  function validateCoord(val: string, min: number, max: number) {
    if (!val) return true;
    const n = parseFloat(val);
    return !isNaN(n) && n >= min && n <= max;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lat && !validateCoord(lat, -90, 90)) {
      setFeedback({ ok: false, msg: t('geo_invalid_lat') });
      return;
    }
    if (lng && !validateCoord(lng, -180, 180)) {
      setFeedback({ ok: false, msg: t('geo_invalid_lng') });
      return;
    }
    // TODO: connect to API once endpoint is available — PATCH /station/me does not exist yet
    setFeedback({ ok: false, msg: t('location_save_error') });
  }

  return (
    <section className="rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[#F0EDE4] px-5 py-3.5 dark:border-[#1A2A14]">
        <span className="h-4 w-[3px] rounded-full bg-[#C49A1E]" />
        <span className="flex-1 text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('section_location')}</span>
        {!isEditing && !locked && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 rounded-[8px] border border-[#C49A1E]/40 px-3 py-1 text-[12px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/8"
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
          /* ── Read-only view ── */
          <div className="flex flex-col gap-4">
            {/* Address card */}
            <div className="flex items-start gap-4 rounded-[10px] bg-[#F7F6F2] px-4 py-3.5 dark:bg-[#0F1A0C]">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#C49A1E]/15">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">{t('field_address')}</p>
                <p className="text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{location.address || '—'}</p>
                <p className="text-[12px] font-semibold text-[#888] dark:text-[#6A6A5A]">{location.city || '—'}</p>
              </div>
            </div>
            {(location.latitude || location.longitude) && (
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#C8C4B4] dark:text-[#2E3C2A]">{t('field_latitude')} / {t('field_longitude')}</p>
                  <p className="font-mono text-[12px] font-semibold text-[#888] dark:text-[#6A6A5A]">
                    {[location.latitude, location.longitude].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            )}
            {feedback && (
              <p className="text-[12px] font-semibold" style={{ color: feedback.ok ? '#00C851' : '#EF4444' }}>
                {feedback.msg}
              </p>
            )}
          </div>
        ) : (
          /* ── Edit form ── */
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label={t('field_address')}>
                  <input type="text" className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} required maxLength={200} />
                </Field>
              </div>
              <Field label={t('field_city')}>
                <input type="text" className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} required maxLength={100} />
              </Field>
              <div />
              <Field label={t('field_latitude')}>
                <input type="text" inputMode="decimal" className={inputClass + ' font-mono'} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="45.5017000" maxLength={20} />
              </Field>
              <Field label={t('field_longitude')}>
                <input type="text" inputMode="decimal" className={inputClass + ' font-mono'} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-73.5673000" maxLength={20} />
              </Field>
              <div className="col-span-2 flex flex-col gap-1">
                <button type="button" onClick={handleGeolocate} disabled={geoLoading}
                  className="flex w-fit items-center gap-2 rounded-[8px] border border-[#C49A1E] px-4 py-2 text-[12px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E] hover:text-[#0C1209] disabled:opacity-50">
                  <GeoIcon />
                  {geoLoading ? t('geolocating') : t('btn_geolocate')}
                </button>
                {geoError && <p className="text-[11px] font-semibold text-[#EF4444]">{t('geo_error')}</p>}
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              {feedback ? (
                <span className="text-[12px] font-semibold" style={{ color: feedback.ok ? '#00C851' : '#EF4444' }}>{feedback.msg}</span>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleCancel} disabled={saving}
                  className="rounded-[10px] border border-[#E0DCD0] px-4 py-2.5 text-[13px] font-semibold text-[#666] transition-colors hover:bg-[#F0EDE0] disabled:opacity-50 dark:border-[#243020] dark:text-[#9A9A8A]">
                  {t('btn_cancel_edit')}
                </button>
                <button type="submit" disabled={saving}
                  className="rounded-[10px] bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50">
                  {saving ? t('btn_saving') : t('btn_save')}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

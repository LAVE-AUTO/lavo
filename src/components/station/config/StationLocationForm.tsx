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
}

const inputClass =
  'w-full rounded-lg border border-[#E0DCD0] bg-white px-3 py-2 text-[13px] text-[#1A1A0A] outline-none focus:border-[#C49A1E] dark:border-[#1A2A14] dark:bg-[#182214] dark:text-[#F0EDD4]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-[#888] dark:text-[#8A8A7A]">
        {label}
      </label>
      {children}
    </div>
  );
}

const GeoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
  </svg>
);

export function StationLocationForm({ location, onSaved }: Props) {
  const t = useTranslations('station_config');

  const [address, setAddress] = useState(location.address);
  const [city, setCity] = useState(location.city);
  const [lat, setLat] = useState(location.latitude ?? '');
  const [lng, setLng] = useState(location.longitude ?? '');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleGeolocate() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setGeoLoading(false);
      },
      () => {
        setGeoError(true);
        setGeoLoading(false);
      }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    // TODO: connect to API once endpoint is available — PATCH /station/me does not exist yet
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);

    onSaved({ address, city, latitude: lat || null, longitude: lng || null });
    setFeedback({ ok: true, msg: t('location_save_success') });
  }

  return (
    <form onSubmit={handleSubmit}>
      <section className="rounded-xl border border-[#E0DCD0] bg-white p-5 dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="mb-4 text-[13px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
          {t('section_location')}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label={t('field_address')}>
              <input
                type="text"
                className={inputClass}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
          </div>
          <Field label={t('field_city')}>
            <input
              type="text"
              className={inputClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </Field>
          <div />
          <Field label={t('field_latitude')}>
            <input
              type="text"
              className={inputClass}
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="45.5017000"
            />
          </Field>
          <Field label={t('field_longitude')}>
            <input
              type="text"
              className={inputClass}
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="-73.5673000"
            />
          </Field>
          <div className="col-span-2 flex flex-col gap-1">
            <button
              type="button"
              onClick={handleGeolocate}
              disabled={geoLoading}
              className="flex w-fit items-center gap-2 rounded-lg border border-[#C49A1E] px-4 py-2 text-[12px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E] hover:text-[#0C1209] disabled:opacity-50"
            >
              <GeoIcon />
              {geoLoading ? t('geolocating') : t('btn_geolocate')}
            </button>
            {geoError && (
              <p className="text-[11px] font-semibold" style={{ color: '#EF4444' }}>
                {t('geo_error')}
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between">
          {feedback && (
            <span
              className="text-[12px] font-semibold"
              style={{ color: feedback.ok ? '#2ECC71' : '#EF4444' }}
            >
              {feedback.msg}
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="ml-auto rounded-lg bg-[#C49A1E] px-6 py-2.5 text-[13px] font-black text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {saving ? t('btn_saving') : t('btn_save')}
          </button>
        </div>
      </section>
    </form>
  );
}

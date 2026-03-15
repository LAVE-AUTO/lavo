'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/auth-context';

export interface StationProfile {
  name: string;
  description: string | null;
  service_scope: string | null;
}

interface Props {
  profile: StationProfile;
  onSaved: (profile: StationProfile) => void;
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

export function StationProfileForm({ profile, onSaved }: Props) {
  const t = useTranslations('station_config');
  const { user } = useAuth();

  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description ?? '');
  const [serviceScope, setServiceScope] = useState(profile.service_scope ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    // TODO: connect to API once endpoint is available — PATCH /station/me does not exist yet
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);

    onSaved({ name, description: description || null, service_scope: serviceScope || null });
    setFeedback({ ok: true, msg: t('profile_save_success') });
  }

  return (
    <form onSubmit={handleSubmit}>
      <section className="rounded-xl border border-[#E0DCD0] bg-white p-5 dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="mb-4 text-[13px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
          {t('section_profile')}
        </div>
        <div className="grid grid-cols-1 gap-4">
          {user?.email && (
            <Field label={t('field_email')}>
              <div className="w-full rounded-lg border border-[#E0DCD0] bg-[#F5F5EE] px-3 py-2 text-[13px] text-[#666] dark:border-[#1A2A14] dark:bg-[#0C1209] dark:text-[#8A8A7A]">
                {user.email}
              </div>
            </Field>
          )}
          <Field label={t('field_station_name')}>
            <input
              type="text"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label={t('field_description')}>
            <textarea
              rows={3}
              className={inputClass + ' resize-none'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label={t('field_service_scope')}>
            <select
              className={inputClass}
              value={serviceScope}
              onChange={(e) => setServiceScope(e.target.value)}
            >
              <option value="">—</option>
              <option value="exterior">{t('service_scope_exterior')}</option>
              <option value="interior">{t('service_scope_interior')}</option>
              <option value="both">{t('service_scope_both')}</option>
            </select>
          </Field>
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

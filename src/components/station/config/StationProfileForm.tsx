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
  'w-full rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none transition-colors duration-150 placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] dark:focus:border-[#C49A1E] dark:focus:bg-[#182214]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{label}</label>
      {children}
    </div>
  );
}

const ChevronDown = () => (
  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#C49A1E]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

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
      <section className="rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="flex items-center gap-2.5 border-b border-[#F0EDE4] px-5 py-3.5 dark:border-[#1A2A14]">
          <span className="h-4 w-[3px] rounded-full bg-[#C49A1E]" />
          <span className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('section_profile')}</span>
        </div>
        <div className="p-5">
          <div className="flex flex-col gap-4">
            {user?.email && (
              <Field label={t('field_email')}>
                <div className="w-full cursor-default rounded-[8px] border border-[#D8D4C8] bg-[#EEECEA] px-3 py-2.5 text-[13px] text-[#999] dark:border-[#243020] dark:bg-[#0A1208] dark:text-[#5A5A4A]">
                  {user.email}
                </div>
              </Field>
            )}
            <Field label={t('field_station_name')}>
              <input type="text" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label={t('field_description')}>
              <textarea rows={3} className={inputClass + ' resize-none leading-relaxed'} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label={t('field_service_scope')}>
              <div className="relative">
                <select
                  className={inputClass + ' cursor-pointer appearance-none pr-9'}
                  value={serviceScope}
                  onChange={(e) => setServiceScope(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="exterior">{t('service_scope_exterior')}</option>
                  <option value="interior">{t('service_scope_interior')}</option>
                  <option value="both">{t('service_scope_both')}</option>
                </select>
                <ChevronDown />
              </div>
            </Field>
          </div>
          <div className="mt-5 flex items-center justify-between">
            {feedback && (
              <span className="text-[12px] font-semibold" style={{ color: feedback.ok ? '#00C851' : '#EF4444' }}>
                {feedback.msg}
              </span>
            )}
            <button type="submit" disabled={saving} className="ml-auto rounded-[10px] bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50">
              {saving ? t('btn_saving') : t('btn_save')}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}

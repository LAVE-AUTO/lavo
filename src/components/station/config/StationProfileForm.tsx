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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{label}</label>
        {hint && <span className="text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const SCOPE_VALUES = ['exterior', 'interior', 'both'] as const;
type ScopeValue = (typeof SCOPE_VALUES)[number];

export function StationProfileForm({ profile, onSaved }: Props) {
  const t = useTranslations('station_config');
  const { user } = useAuth();

  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description ?? '');
  const [serviceScope, setServiceScope] = useState<ScopeValue | ''>(
    (profile.service_scope as ScopeValue) ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const scopeLabels: Record<ScopeValue, string> = {
    exterior: t('extras_tab_exterior'),
    interior: t('extras_tab_interior'),
    both: t('extras_tab_both'),
  };

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
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {/* Email — full width, read-only */}
            {user?.email && (
              <div className="col-span-2">
                <Field label={t('field_email')}>
                  <div className="flex items-center gap-2.5 rounded-[8px] border border-[#D8D4C8] bg-[#F0EFEB] px-3 py-2.5 dark:border-[#243020] dark:bg-[#0A1208]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#BBBBAA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <polyline points="3 7 12 13 21 7" />
                    </svg>
                    <span className="text-[13px] text-[#999] dark:text-[#5A5A4A]">{user.email}</span>
                    <span className="ml-auto rounded-full bg-[#E8E4DC] px-2 py-0.5 text-[10px] font-semibold text-[#AAAAAA] dark:bg-[#1A2A14] dark:text-[#4A4A3A]">
                      {t('field_email_readonly')}
                    </span>
                  </div>
                </Field>
              </div>
            )}

            {/* Station name */}
            <div className="col-span-2">
              <Field label={t('field_station_name')}>
                <input type="text" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
            </div>

            {/* Service scope — segmented control, full width */}
            <div className="col-span-2">
              <Field label={t('field_service_scope')}>
                <div className="flex gap-1 rounded-[10px] border border-[#D8D4C8] bg-[#F7F6F2] p-1 dark:border-[#243020] dark:bg-[#0F1A0C]">
                  <button
                    type="button"
                    onClick={() => setServiceScope('')}
                    className={`rounded-[7px] px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                      !serviceScope
                        ? 'bg-white text-[#5A5A4A] shadow-sm dark:bg-[#182214] dark:text-[#9A9A8A]'
                        : 'text-[#BBBBAA] hover:text-[#888] dark:text-[#3A3A2A] dark:hover:text-[#6A6A5A]'
                    }`}
                  >
                    —
                  </button>
                  {SCOPE_VALUES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setServiceScope(v)}
                      className={`flex-1 rounded-[7px] py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                        serviceScope === v
                          ? 'bg-[#C49A1E] text-[#0C1209] shadow-sm'
                          : 'text-[#AAAAAA] hover:text-[#5A5A4A] dark:text-[#4A4A3A] dark:hover:text-[#9A9A8A]'
                      }`}
                    >
                      {scopeLabels[v]}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {/* Description — full width, optional */}
            <div className="col-span-2">
              <Field label={t('field_description')} hint={t('field_optional')}>
                <textarea
                  rows={3}
                  className={inputClass + ' resize-none leading-relaxed'}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('field_description_placeholder')}
                />
              </Field>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            {feedback ? (
              <span className="text-[12px] font-semibold" style={{ color: feedback.ok ? '#00C851' : '#EF4444' }}>
                {feedback.msg}
              </span>
            ) : <span />}
            <button type="submit" disabled={saving} className="rounded-[10px] bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50">
              {saving ? t('btn_saving') : t('btn_save')}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}

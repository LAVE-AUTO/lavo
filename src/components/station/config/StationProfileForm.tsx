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
  locked?: boolean;
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

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#C8C4B4] dark:text-[#2E3C2A]">{label}</p>
      <p className="text-[13px] font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{value || '—'}</p>
    </div>
  );
}

const SCOPE_VALUES = ['exterior', 'interior', 'both'] as const;
type ScopeValue = (typeof SCOPE_VALUES)[number];

export function StationProfileForm({ profile, onSaved, locked = false }: Props) {
  const t = useTranslations('station_config');
  const { user } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
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

  function handleCancel() {
    setName(profile.name);
    setDescription(profile.description ?? '');
    setServiceScope((profile.service_scope as ScopeValue) ?? '');
    setFeedback(null);
    setIsEditing(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // TODO: connect to API once endpoint is available — PATCH /station/me does not exist yet
    setFeedback({ ok: false, msg: t('profile_save_error') });
    setSaving(false);
  }

  return (
    <section className="rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[#F0EDE4] px-5 py-3.5 dark:border-[#1A2A14]">
        <span className="h-4 w-[3px] rounded-full bg-[#C49A1E]" />
        <span className="flex-1 text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('section_profile')}</span>
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
            {/* Avatar + name row */}
            <div className="flex items-center gap-4">
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#C49A1E]/20 to-[#C49A1E]/8 text-[15px] font-black text-[#C49A1E] ring-1 ring-[#C49A1E]/15 dark:from-[#C49A1E]/15 dark:to-[#C49A1E]/5">
                {profile.name ? profile.name.substring(0, 2).toUpperCase() : '—'}
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-[16px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{profile.name || '—'}</p>
                {profile.service_scope && (
                  <span className="w-fit rounded-full bg-[#FDF3D8] px-2.5 py-0.5 text-[11px] font-semibold text-[#C49A1E] dark:bg-[#2A1E08]">
                    {scopeLabels[profile.service_scope as ScopeValue] ?? profile.service_scope}
                  </span>
                )}
              </div>
            </div>
            <div className="h-px bg-[#F0EDE4] dark:bg-[#1A2A14]" />
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {user?.email && (
                <div className="col-span-2">
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#C8C4B4] dark:text-[#2E3C2A]">{t('field_email')}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{user.email}</span>
                    <span className="rounded-full bg-[#E8E4DC] px-2 py-0.5 text-[10px] font-semibold text-[#AAAAAA] dark:bg-[#1A2A14] dark:text-[#4A4A3A]">
                      {t('field_email_readonly')}
                    </span>
                  </div>
                </div>
              )}
              {profile.description && (
                <div className="col-span-2">
                  <ReadField label={t('field_description')} value={profile.description} />
                </div>
              )}
              {feedback && (
                <p className="col-span-2 text-[12px] font-semibold" style={{ color: feedback.ok ? '#00C851' : '#EF4444' }}>
                  {feedback.msg}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* ── Edit form ── */
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {user?.email && (
                <div className="col-span-2">
                  <Field label={t('field_email')}>
                    <div className="flex items-center gap-2.5 rounded-[8px] border border-[#D8D4C8] bg-[#F0EFEB] px-3 py-2.5 dark:border-[#243020] dark:bg-[#0A1208]">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#BBBBAA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
              <div className="col-span-2">
                <Field label={t('field_station_name')}>
                  <input type="text" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label={t('field_service_scope')}>
                  <div className="flex gap-1 rounded-[10px] border border-[#D8D4C8] bg-[#F7F6F2] p-1 dark:border-[#243020] dark:bg-[#0F1A0C]">
                    <button type="button" onClick={() => setServiceScope('')}
                      className={`rounded-[7px] px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 ${!serviceScope ? 'bg-white text-[#5A5A4A] shadow-sm dark:bg-[#182214] dark:text-[#9A9A8A]' : 'text-[#BBBBAA] hover:text-[#888] dark:text-[#3A3A2A] dark:hover:text-[#6A6A5A]'}`}>
                      —
                    </button>
                    {SCOPE_VALUES.map((v) => (
                      <button key={v} type="button" onClick={() => setServiceScope(v)}
                        className={`flex-1 rounded-[7px] py-1.5 text-[12px] font-semibold transition-all duration-150 ${serviceScope === v ? 'bg-[#C49A1E] text-[#0C1209] shadow-sm' : 'text-[#AAAAAA] hover:text-[#5A5A4A] dark:text-[#4A4A3A] dark:hover:text-[#9A9A8A]'}`}>
                        {scopeLabels[v]}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="col-span-2">
                <Field label={t('field_description')} hint={t('field_optional')}>
                  <textarea rows={3} className={inputClass + ' resize-none leading-relaxed'} value={description}
                    onChange={(e) => setDescription(e.target.value)} placeholder={t('field_description_placeholder')} maxLength={500} />
                </Field>
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

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { patchWithApi } from '@/services';

export interface StationConfig {
  id: string;
  opening_time: string | null;
  closing_time: string | null;
  break_start: string | null;
  break_end: string | null;
  wash_duration_minutes: number | null;
  late_tolerance_minutes: number | null;
  cancellation_delay_minutes: number | null;
  max_concurrent_posts: number | null;
  margin_before_minutes: number | null;
  margin_after_minutes: number | null;
  reservation_surcharge: string | null;
}

export interface StationPost {
  id: string;
  position: number;
  is_active: boolean;
}

interface StationConfigFormProps {
  config: StationConfig;
  posts: StationPost[];
  onSaved: (config: StationConfig, posts: StationPost[]) => void;
  locked?: boolean;
}

const inputClass =
  'w-full rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none transition-colors duration-150 placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] dark:focus:border-[#C49A1E] dark:focus:bg-[#182214]';

const EditIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  const v = value !== null && value !== '' ? String(value) : '—';
  return (
    <div className="flex flex-col gap-1 rounded-[10px] bg-[#F7F6F2] px-4 py-3 dark:bg-[#0F1A0C]">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[20px] font-black tabular-nums leading-none text-[#1A1A0A] dark:text-[#F0EDD4]">{v}</span>
        {unit && v !== '—' && <span className="text-[11px] font-semibold text-[#C8C4B4] dark:text-[#4A4A3A]">{unit}</span>}
      </div>
    </div>
  );
}

function NumberInput({ value, onChange, min, step, unit }: {
  value: string | number;
  onChange: (v: string) => void;
  min?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass + (unit ? ' pr-12' : '')}
      />
      {unit && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none text-[11px] font-semibold text-[#BBBBAA] dark:text-[#4A4A3A]">
          {unit}
        </span>
      )}
    </div>
  );
}

function initForm(config: StationConfig) {
  return {
    opening_time: config.opening_time ?? '',
    closing_time: config.closing_time ?? '',
    break_start: config.break_start ?? '',
    break_end: config.break_end ?? '',
    wash_duration_minutes: config.wash_duration_minutes ?? '',
    late_tolerance_minutes: config.late_tolerance_minutes ?? '',
    cancellation_delay_minutes: config.cancellation_delay_minutes ?? '',
    max_concurrent_posts: config.max_concurrent_posts ?? '',
    margin_before_minutes: config.margin_before_minutes ?? '',
    margin_after_minutes: config.margin_after_minutes ?? '',
    reservation_surcharge: config.reservation_surcharge ?? '',
  };
}

export function StationConfigForm({ config, posts, onSaved, locked = false }: StationConfigFormProps) {
  const t = useTranslations('station_config');

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(() => initForm(config));
  const [postStates, setPostStates] = useState<Record<string, boolean>>(
    Object.fromEntries(posts.map((p) => [p.id, p.is_active]))
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => { setForm(initForm(config)); }, [config]);
  useEffect(() => { setPostStates(Object.fromEntries(posts.map((p) => [p.id, p.is_active]))); }, [posts]);

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCancel() {
    setForm(initForm(config));
    setPostStates(Object.fromEntries(posts.map((p) => [p.id, p.is_active])));
    setFeedback(null);
    setIsEditing(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const payload: Record<string, unknown> = {};
    if (form.opening_time) payload.opening_time = form.opening_time;
    if (form.closing_time) payload.closing_time = form.closing_time;
    if (form.break_start) payload.break_start = form.break_start;
    if (form.break_end) payload.break_end = form.break_end;
    if (form.wash_duration_minutes !== '') payload.wash_duration_minutes = Number(form.wash_duration_minutes);
    if (form.late_tolerance_minutes !== '') payload.late_tolerance_minutes = Number(form.late_tolerance_minutes);
    if (form.cancellation_delay_minutes !== '') payload.cancellation_delay_minutes = Number(form.cancellation_delay_minutes);
    if (form.max_concurrent_posts !== '') payload.max_concurrent_posts = Number(form.max_concurrent_posts);
    if (form.margin_before_minutes !== '') payload.margin_before_minutes = Number(form.margin_before_minutes);
    if (form.margin_after_minutes !== '') payload.margin_after_minutes = Number(form.margin_after_minutes);
    if (form.reservation_surcharge !== '') payload.reservation_surcharge = form.reservation_surcharge;
    payload.posts = posts.map((p) => ({ id: p.id, is_active: postStates[p.id] ?? p.is_active }));

    const [ok, data] = await patchWithApi('/station/config', payload);
    setSaving(false);

    if (ok) {
      const res = data as { data: { config: StationConfig; posts: StationPost[] } };
      onSaved(res.data.config, res.data.posts);
      setFeedback({ ok: true, msg: t('save_success') });
      setIsEditing(false);
    } else {
      setFeedback({ ok: false, msg: t('save_error') });
    }
  }

  const editBtn = !isEditing && !locked && (
    <button type="button" onClick={() => setIsEditing(true)}
      className="flex items-center gap-1.5 rounded-[8px] border border-[#C49A1E]/40 px-3 py-1 text-[12px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/8">
      <EditIcon />{t('btn_edit')}
    </button>
  );

  const cardHeader = (title: string, showEdit = false) => (
    <div className="flex items-center gap-2.5 border-b border-[#F0EDE4] px-5 py-3.5 dark:border-[#1A2A14]">
      <span className="h-4 w-[3px] rounded-full bg-[#C49A1E]" />
      <span className="flex-1 text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{title}</span>
      {showEdit && editBtn}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Hours */}
      <section className="rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        {cardHeader(t('section_hours'), true)}
        <div className="p-5">
          {!isEditing ? (
            <div className="flex flex-wrap items-center gap-5 rounded-[10px] bg-[#F7F6F2] px-5 py-4 dark:bg-[#0F1A0C]">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">{t('field_opening_time')}</span>
                <span className="text-[22px] font-black tabular-nums leading-none text-[#1A1A0A] dark:text-[#F0EDD4]">{config.opening_time || '—'}</span>
              </div>
              <span className="text-[20px] font-light text-[#C49A1E]">→</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">{t('field_closing_time')}</span>
                <span className="text-[22px] font-black tabular-nums leading-none text-[#1A1A0A] dark:text-[#F0EDD4]">{config.closing_time || '—'}</span>
              </div>
              {(config.break_start || config.break_end) && (
                <>
                  <span className="h-8 w-px bg-[#E0DCD0] dark:bg-[#243020]" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">{t('field_break_start')}</span>
                    <span className="text-[15px] font-bold tabular-nums text-[#888] dark:text-[#6A6A5A]">{config.break_start} – {config.break_end}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label={t('field_opening_time')}>
                <input type="time" className={inputClass} value={form.opening_time} onChange={(e) => set('opening_time', e.target.value)} />
              </Field>
              <Field label={t('field_closing_time')}>
                <input type="time" className={inputClass} value={form.closing_time} onChange={(e) => set('closing_time', e.target.value)} />
              </Field>
              <Field label={t('field_break_start')}>
                <input type="time" className={inputClass} value={form.break_start} onChange={(e) => set('break_start', e.target.value)} />
              </Field>
              <Field label={t('field_break_end')}>
                <input type="time" className={inputClass} value={form.break_end} onChange={(e) => set('break_end', e.target.value)} />
              </Field>
            </div>
          )}
        </div>
      </section>

      {/* Wash & delays */}
      <section className="rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        {cardHeader(t('section_wash'))}
        <div className="p-5">
          {!isEditing ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label={t('field_wash_duration')} value={config.wash_duration_minutes} unit="min" />
              <StatCard label={t('field_late_tolerance')} value={config.late_tolerance_minutes} unit="min" />
              <StatCard label={t('field_cancellation_delay')} value={config.cancellation_delay_minutes} unit="min" />
              <StatCard label={t('field_max_concurrent')} value={config.max_concurrent_posts} unit={t('unit_posts')} />
              <StatCard label={t('field_margin_before')} value={config.margin_before_minutes} unit="min" />
              <StatCard label={t('field_margin_after')} value={config.margin_after_minutes} unit="min" />
              <StatCard label={t('field_surcharge')} value={config.reservation_surcharge} unit="$" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label={t('field_wash_duration')}>
                <NumberInput value={form.wash_duration_minutes} onChange={(v) => set('wash_duration_minutes', v)} min={1} unit="min" />
              </Field>
              <Field label={t('field_late_tolerance')}>
                <NumberInput value={form.late_tolerance_minutes} onChange={(v) => set('late_tolerance_minutes', v)} min={0} unit="min" />
              </Field>
              <Field label={t('field_cancellation_delay')}>
                <NumberInput value={form.cancellation_delay_minutes} onChange={(v) => set('cancellation_delay_minutes', v)} min={0} unit="min" />
              </Field>
              <Field label={t('field_margin_before')}>
                <NumberInput value={form.margin_before_minutes} onChange={(v) => set('margin_before_minutes', v)} min={0} unit="min" />
              </Field>
              <Field label={t('field_margin_after')}>
                <NumberInput value={form.margin_after_minutes} onChange={(v) => set('margin_after_minutes', v)} min={0} unit="min" />
              </Field>
              <Field label={t('field_max_concurrent')}>
                <NumberInput value={form.max_concurrent_posts} onChange={(v) => set('max_concurrent_posts', v)} min={1} unit={t('unit_posts')} />
              </Field>
              <Field label={t('field_surcharge')}>
                <NumberInput value={form.reservation_surcharge} onChange={(v) => set('reservation_surcharge', v)} min={0} step={0.01} unit="$" />
              </Field>
            </div>
          )}
        </div>
      </section>

      {/* Posts */}
      <section className="rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        {cardHeader(t('section_posts'))}
        <div className="p-5">
          <div className="flex flex-wrap gap-2.5">
            {posts.map((post) => {
              const active = postStates[post.id] ?? post.is_active;
              return (
                <button
                  key={post.id}
                  type="button"
                  disabled={!isEditing}
                  onClick={() => setPostStates((prev) => ({ ...prev, [post.id]: !(prev[post.id] ?? post.is_active) }))}
                  className={`flex items-center gap-2.5 rounded-[10px] border px-4 py-2.5 text-[12px] font-semibold transition-all duration-150 ${
                    active
                      ? 'border-[#C49A1E] bg-[#C49A1E] text-[#0C1209] shadow-sm'
                      : 'border-[#D8D4C8] bg-[#F7F6F2] text-[#888] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#6A6A5A]'
                  } ${!isEditing ? 'cursor-default' : 'hover:opacity-80'}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full transition-colors ${active ? 'bg-[#0C1209]' : 'bg-[#D0D0C0] dark:bg-[#3A3A2A]'}`} />
                  {t('post_label', { n: post.position })}
                  <span className={`text-[10px] ${active ? 'opacity-60' : 'opacity-50'}`}>
                    {active ? t('post_active') : t('post_inactive')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Actions */}
      {isEditing ? (
        <div className="flex items-center justify-between">
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
      ) : (
        feedback && (
          <p className="text-[12px] font-semibold" style={{ color: feedback.ok ? '#00C851' : '#EF4444' }}>{feedback.msg}</p>
        )
      )}
    </form>
  );
}

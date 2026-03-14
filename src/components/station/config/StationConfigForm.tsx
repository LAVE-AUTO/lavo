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
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-[#888] dark:text-[#8A8A7A]">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-[#E0DCD0] bg-white px-3 py-2 text-[13px] text-[#1A1A0A] outline-none focus:border-[#C49A1E] dark:border-[#1A2A14] dark:bg-[#182214] dark:text-[#F0EDD4]';

export function StationConfigForm({ config, posts, onSaved }: StationConfigFormProps) {
  const t = useTranslations('station_config');

  const [form, setForm] = useState({
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
  });

  const [postStates, setPostStates] = useState<Record<string, boolean>>(
    Object.fromEntries(posts.map((p) => [p.id, p.is_active]))
  );

  useEffect(() => {
    setPostStates(Object.fromEntries(posts.map((p) => [p.id, p.is_active])));
  }, [posts]);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function togglePost(id: string) {
    setPostStates((prev) => ({ ...prev, [id]: !prev[id] }));
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
    } else {
      setFeedback({ ok: false, msg: t('save_error') });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Hours */}
      <section className="rounded-xl border border-[#E0DCD0] bg-white p-5 dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="mb-4 text-[13px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
          {t('section_hours')}
        </div>
        <div className="grid grid-cols-2 gap-4">
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
      </section>

      {/* Wash & delays */}
      <section className="rounded-xl border border-[#E0DCD0] bg-white p-5 dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="mb-4 text-[13px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
          {t('section_wash')}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('field_wash_duration')}>
            <input type="number" min={1} className={inputClass} value={form.wash_duration_minutes} onChange={(e) => set('wash_duration_minutes', e.target.value)} />
          </Field>
          <Field label={t('field_max_concurrent')}>
            <input type="number" min={1} className={inputClass} value={form.max_concurrent_posts} onChange={(e) => set('max_concurrent_posts', e.target.value)} />
          </Field>
          <Field label={t('field_margin_before')}>
            <input type="number" min={0} className={inputClass} value={form.margin_before_minutes} onChange={(e) => set('margin_before_minutes', e.target.value)} />
          </Field>
          <Field label={t('field_margin_after')}>
            <input type="number" min={0} className={inputClass} value={form.margin_after_minutes} onChange={(e) => set('margin_after_minutes', e.target.value)} />
          </Field>
          <Field label={t('field_late_tolerance')}>
            <input type="number" min={0} className={inputClass} value={form.late_tolerance_minutes} onChange={(e) => set('late_tolerance_minutes', e.target.value)} />
          </Field>
          <Field label={t('field_cancellation_delay')}>
            <input type="number" min={0} className={inputClass} value={form.cancellation_delay_minutes} onChange={(e) => set('cancellation_delay_minutes', e.target.value)} />
          </Field>
          <Field label={t('field_surcharge')}>
            <input type="number" min={0} step={0.01} className={inputClass} value={form.reservation_surcharge} onChange={(e) => set('reservation_surcharge', e.target.value)} />
          </Field>
        </div>
      </section>

      {/* Posts */}
      <section className="rounded-xl border border-[#E0DCD0] bg-white p-5 dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="mb-4 text-[13px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
          {t('section_posts')}
        </div>
        <div className="flex flex-wrap gap-3">
          {posts.map((post) => {
            const active = postStates[post.id] ?? post.is_active;
            return (
              <button
                key={post.id}
                type="button"
                onClick={() => togglePost(post.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-bold transition-colors ${
                  active
                    ? 'bg-[#C49A1E] text-[#0C1209]'
                    : 'border border-[#E0DCD0] bg-[#F5F5EE] text-[#888] dark:border-[#1A2A14] dark:bg-[#0C1209] dark:text-[#8A8A7A]'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: active ? '#0C1209' : '#888' }}
                />
                {t('post_label', { n: post.position })}
                <span className="text-[10px]">
                  {active ? t('post_active') : t('post_inactive')}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between">
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
    </form>
  );
}

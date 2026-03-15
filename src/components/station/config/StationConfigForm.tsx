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

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[#F0EDE4] px-5 py-3.5 dark:border-[#1A2A14]">
      <span className="h-4 w-[3px] rounded-full bg-[#C49A1E]" />
      <span className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{title}</span>
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Hours */}
      <section className="rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        <SectionHeader title={t('section_hours')} />
        <div className="p-5">
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
        </div>
      </section>

      {/* Wash & delays */}
      <section className="rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        <SectionHeader title={t('section_wash')} />
        <div className="p-5">
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
        </div>
      </section>

      {/* Posts */}
      <section className="rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        <SectionHeader title={t('section_posts')} />
        <div className="p-5">
          <div className="flex flex-wrap gap-2.5">
            {posts.map((post) => {
              const active = postStates[post.id] ?? post.is_active;
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setPostStates((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                  className={`group flex items-center gap-2.5 rounded-[10px] border px-4 py-2.5 text-[12px] font-semibold transition-all duration-150 ${
                    active
                      ? 'border-[#C49A1E] bg-[#C49A1E] text-[#0C1209] shadow-sm'
                      : 'border-[#D8D4C8] bg-[#F7F6F2] text-[#888] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#6A6A5A]'
                  }`}
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
      <div className="flex items-center justify-between">
        {feedback ? (
          <span className="text-[12px] font-semibold" style={{ color: feedback.ok ? '#00C851' : '#EF4444' }}>
            {feedback.msg}
          </span>
        ) : <span />}
        <button type="submit" disabled={saving} className="rounded-[10px] bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50">
          {saving ? t('btn_saving') : t('btn_save')}
        </button>
      </div>
    </form>
  );
}

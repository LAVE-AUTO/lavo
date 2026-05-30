'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { patchWithApi } from '@/services';
import { useToast } from '@/context/toast-context';
import type { StationConfig, StationPost } from '../types';
import { NumberStepper } from '../NumberStepper';
import { BookingMarkupCard } from './BookingMarkupCard';

interface Props {
  config: StationConfig;
  posts: StationPost[];
  locked: boolean;
  onSaved: (config: StationConfig, posts: StationPost[]) => void;
}

const MAX_BAYS = 20;
const MIN_BAYS = 1;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/55 dark:text-[#B0BFB1]">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] leading-snug text-[#AAAAAA] dark:text-[#5A5A4A]">{hint}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#FFF9EC] bg-white p-6 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
      <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[1.5px] text-[#DDAF3B]">{title}</h3>
      {children}
    </section>
  );
}

function initForm(config: StationConfig, postCount: number) {
  const surchargeNumeric = config.reservation_surcharge != null ? Number(config.reservation_surcharge) : NaN;
  const surchargeEnabled = Number.isFinite(surchargeNumeric) && surchargeNumeric > 0;
  return {
    wash_duration_minutes: config.wash_duration_minutes ?? '',
    wash_post_count: config.wash_post_count ?? postCount,
    late_tolerance_minutes: config.late_tolerance_minutes ?? '',
    cancellation_delay_minutes: config.cancellation_delay_minutes ?? '',
    max_concurrent_posts: config.max_concurrent_posts ?? '',
    margin_before_minutes: config.margin_before_minutes ?? '',
    margin_after_minutes: config.margin_after_minutes ?? '',
    surcharge_enabled: surchargeEnabled,
    surcharge_amount: surchargeEnabled ? surchargeNumeric.toFixed(2) : '0',
  };
}

function safeInt(v: string | number): number | undefined {
  const n = Number(v);
  return !isNaN(n) && v !== '' ? Math.max(0, Math.floor(n)) : undefined;
}

function clampBays(v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return MIN_BAYS;
  return Math.max(MIN_BAYS, Math.min(MAX_BAYS, Math.floor(n)));
}

export function CapacityTab({ config, posts, locked, onSaved }: Props) {
  const t = useTranslations('station_config');
  const { success, error: showError } = useToast();

  const [form, setForm] = useState(() => initForm(config, posts.length));
  // Per-position is_active map. Indexed by 1-based position so it survives bay-count changes.
  const [postActive, setPostActive] = useState<Record<number, boolean>>(
    Object.fromEntries(posts.map((p) => [p.position, p.is_active])),
  );
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => setForm(initForm(config, posts.length)), [config, posts.length]);
  useEffect(
    () => setPostActive(Object.fromEntries(posts.map((p) => [p.position, p.is_active]))),
    [posts],
  );

  function set<K extends keyof ReturnType<typeof initForm>>(
    key: K,
    value: ReturnType<typeof initForm>[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function togglePost(position: number) {
    setPostActive((prev) => ({ ...prev, [position]: !(prev[position] ?? true) }));
  }

  const totalBays = clampBays(String(form.wash_post_count));

  // Virtual posts list driven by wash_post_count input. Existing positions keep their is_active;
  // new positions default to active. Positions above the new total are dropped on save.
  const visiblePositions = Array.from({ length: totalBays }, (_, i) => i + 1);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    setSaving(true);

    const payload: Record<string, unknown> = {};
    const wd = safeInt(form.wash_duration_minutes);
    if (wd !== undefined) payload.wash_duration_minutes = wd;
    const lt = safeInt(form.late_tolerance_minutes);
    if (lt !== undefined) payload.late_tolerance_minutes = lt;
    const cd = safeInt(form.cancellation_delay_minutes);
    if (cd !== undefined) payload.cancellation_delay_minutes = cd;
    const mp = safeInt(form.max_concurrent_posts);
    if (mp !== undefined) payload.max_concurrent_posts = mp;
    const mb = safeInt(form.margin_before_minutes);
    if (mb !== undefined) payload.margin_before_minutes = mb;
    const ma = safeInt(form.margin_after_minutes);
    if (ma !== undefined) payload.margin_after_minutes = ma;

    payload.wash_post_count = totalBays;

    // Reservation surcharge: enabled with positive amount → number; otherwise null (no surcharge)
    const surchargeAmount = Number(form.surcharge_amount);
    payload.reservation_surcharge =
      form.surcharge_enabled && Number.isFinite(surchargeAmount) && surchargeAmount > 0
        ? Number(surchargeAmount.toFixed(2))
        : null;
    // Send the full target list of positions. The backend's upsertPosts will
    // create missing positions and delete any not present, keeping post_active in sync.
    payload.posts = visiblePositions.map((position) => ({
      position,
      is_active: postActive[position] ?? true,
    }));

    const [ok, data] = await patchWithApi('/station/config', payload);
    if (!mountedRef.current) return;
    setSaving(false);

    if (ok) {
      const res = data as { data: { config: StationConfig; posts: StationPost[] } };
      onSaved(res.data.config, res.data.posts);
      success(t('save_success'));
    } else {
      showError(t('save_error'));
    }
  }

  const activeCount = visiblePositions.filter((p) => postActive[p] ?? true).length;

  // Cap max_concurrent_posts at the total bay count to keep the UI consistent
  const maxConcurrentMax = Math.max(MIN_BAYS, totalBays);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <BookingMarkupCard
        enabled={form.surcharge_enabled}
        amount={form.surcharge_amount}
        onEnabledChange={(next) => set('surcharge_enabled', next)}
        onAmountChange={(next) => set('surcharge_amount', next)}
        disabled={locked || saving}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <Card title={t('capacity_card_bays')}>
          <div className="flex flex-col gap-4">
            <Field label={t('capacity_total_bays')} hint={t('capacity_total_bays_hint')}>
              <NumberStepper
                value={form.wash_post_count}
                onChange={(v) => set('wash_post_count', clampBays(v))}
                min={MIN_BAYS}
                max={MAX_BAYS}
                unit={t('unit_posts')}
                disabled={locked || saving}
              />
            </Field>
            <Field label={t('field_max_concurrent')} hint={t('capacity_max_concurrent_hint')}>
              <NumberStepper
                value={form.max_concurrent_posts}
                onChange={(v) => set('max_concurrent_posts', v)}
                min={1}
                max={maxConcurrentMax}
                unit={t('unit_posts')}
                disabled={locked || saving}
              />
            </Field>
          </div>
        </Card>

        <Card title={t('capacity_card_delay_tolerance')}>
          <div className="flex flex-col gap-4">
            <Field label={t('field_late_tolerance')} hint={t('capacity_late_tolerance_hint')}>
              <NumberStepper
                value={form.late_tolerance_minutes}
                onChange={(v) => set('late_tolerance_minutes', v)}
                min={0}
                max={30}
                unit="min"
                disabled={locked || saving}
              />
            </Field>
            <Field label={t('field_cancellation_delay')} hint={t('capacity_cancellation_hint')}>
              <NumberStepper
                value={form.cancellation_delay_minutes}
                onChange={(v) => set('cancellation_delay_minutes', v)}
                min={0}
                unit="min"
                disabled={locked || saving}
              />
            </Field>
          </div>
        </Card>
      </div>

      <Card title={t('capacity_card_wash_settings')}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t('field_wash_duration')}>
            <NumberStepper
              value={form.wash_duration_minutes}
              onChange={(v) => set('wash_duration_minutes', v)}
              min={1}
              unit="min"
              disabled={locked || saving}
            />
          </Field>
          <Field label={t('field_margin_before')}>
            <NumberStepper
              value={form.margin_before_minutes}
              onChange={(v) => set('margin_before_minutes', v)}
              min={0}
              unit="min"
              disabled={locked || saving}
            />
          </Field>
          <Field label={t('field_margin_after')}>
            <NumberStepper
              value={form.margin_after_minutes}
              onChange={(v) => set('margin_after_minutes', v)}
              min={0}
              unit="min"
              disabled={locked || saving}
            />
          </Field>
        </div>
      </Card>

      <Card title={t('capacity_card_bay_status')}>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[12px] text-foreground/55 dark:text-[#B0BFB1]">{t('capacity_bay_status_hint')}</p>
          <p className="text-[12px] font-semibold text-[#DDAF3B]">
            {t('capacity_bays_active', { active: activeCount, total: totalBays })}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visiblePositions.map((position) => {
            const active = postActive[position] ?? true;
            const isNew = !posts.some((p) => p.position === position);
            return (
              <button
                key={position}
                type="button"
                onClick={() => togglePost(position)}
                disabled={locked || saving}
                aria-pressed={active}
                className={`group relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? 'border-[#DDAF3B]/40 bg-[#DDAF3B]/8 hover:border-[#DDAF3B]'
                    : 'border-[#FFF9EC] bg-[#FFF9EC] hover:border-[#C8C4B4] dark:border-[#001A05] dark:bg-dark-bg'
                }`}
              >
                {isNew && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-[#DDAF3B] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#001201]">
                    {t('capacity_bay_new')}
                  </span>
                )}
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    active
                      ? 'bg-[#DDAF3B]/20 text-[#DDAF3B]'
                      : 'bg-[#FFF9EC] text-[#AAAAAA] dark:bg-[#1A2A14] dark:text-[#4A4A3A]'
                  }`}
                  aria-hidden="true"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </div>
                <span className="text-[12px] font-bold text-[#001201] dark:text-[#FFF9EC]">
                  {t('post_label', { n: position })}
                </span>
                <span className={`text-[11px] font-semibold ${active ? 'text-[#00A040]' : 'text-[#EF4444]'}`}>
                  {active ? t('post_active') : t('post_inactive')}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-4">
        <button
          type="submit"
          disabled={locked || saving}
          className="flex items-center gap-2 rounded-xl bg-[#DDAF3B] px-6 py-2.5 text-[13px] font-bold text-[#001201] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t('btn_saving') : t('capacity_btn_save')}
        </button>
      </div>
    </form>
  );
}

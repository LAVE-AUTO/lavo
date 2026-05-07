'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi, patchWithApi, postWithApi, deleteWithApi } from '@/services';
import type { StationConfig } from '../types';
import { HoursDayRow } from './HoursDayRow';
import { HoursExceptions, type HourException } from './HoursExceptions';
import { PageLoader } from '@/components/ui/PageLoader';

interface HourDay {
  day_of_week: number;
  is_open: boolean;
  morning_start: string | null;
  morning_end: string | null;
  afternoon_start: string | null;
  afternoon_end: string | null;
}

interface HourTemplate {
  morning_start: string;
  morning_end: string;
  afternoon_start: string;
  afternoon_end: string;
}

interface Props {
  config: StationConfig;
  locked: boolean;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function buildDefaultDays(): HourDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    day_of_week: d,
    is_open: false,
    morning_start: null,
    morning_end: null,
    afternoon_start: null,
    afternoon_end: null,
  }));
}

const timeInputClass =
  'w-full rounded-lg border border-[#E0DCD0] bg-white px-2.5 py-1.5 text-center font-mono text-[12px] tabular-nums text-[#1A1A0A] outline-none transition-all duration-150 placeholder:text-[#BBBBAA] hover:border-[#D0C8B0] focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] dark:hover:border-[#2E3C2A]';

export function HoursTab({ config, locked }: Props) {
  const t = useTranslations('station_config');
  const { success, error: showError } = useToast();

  const [template, setTemplate] = useState<HourTemplate>({
    morning_start: config.opening_time ?? '',
    morning_end: config.break_start ?? '',
    afternoon_start: config.break_end ?? '',
    afternoon_end: config.closing_time ?? '',
  });

  const [days, setDays] = useState<HourDay[]>(buildDefaultDays());
  const [exceptions, setExceptions] = useState<HourException[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const [[hoursOk, hoursData], [exceptionsOk, exceptionsData]] = await Promise.all([
      getFromApi('/station/hours'),
      getFromApi('/station/hour-exceptions'),
    ]);

    if (hoursOk) {
      const rows = (hoursData as { data: HourDay[] }).data;
      if (Array.isArray(rows) && rows.length > 0) {
        const merged = buildDefaultDays().map((def) => {
          const found = rows.find((r) => r.day_of_week === def.day_of_week);
          return found ?? def;
        });
        setDays(merged);
      }
    } else {
      showError(t('hours_load_error'));
    }

    if (exceptionsOk) {
      setExceptions((exceptionsData as { data: HourException[] }).data ?? []);
    }

    setLoading(false);
  }, [showError, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateDay(dayOfWeek: number, patch: Partial<HourDay>) {
    setDays((prev) =>
      prev.map((d) => (d.day_of_week === dayOfWeek ? { ...d, ...patch } : d)),
    );
  }

  function applyTemplateToAllDays() {
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        is_open: true,
        morning_start: template.morning_start || null,
        morning_end: template.morning_end || null,
        afternoon_start: template.afternoon_start || null,
        afternoon_end: template.afternoon_end || null,
      })),
    );
  }

  async function handleSave() {
    setSaving(true);

    const configPayload = {
      opening_time: template.morning_start || null,
      break_start: template.morning_end || null,
      break_end: template.afternoon_start || null,
      closing_time: template.afternoon_end || null,
    };

    const [[configOk], [hoursOk]] = await Promise.all([
      patchWithApi('/station/config', configPayload),
      patchWithApi('/station/hours', { days }),
    ]);

    if (configOk && hoursOk) {
      success(t('hours_save_success'));
    } else {
      showError(t('hours_save_error'));
    }

    setSaving(false);
  }

  async function handleAddException(exception_date: string, reason: string) {
    const [ok, data] = await postWithApi('/station/hour-exceptions', { exception_date, reason });
    if (ok) {
      const created = (data as { data: HourException }).data;
      setExceptions((prev) => [...prev, created]);
      success(t('hours_exceptions_save_success'));
    } else {
      showError(t('hours_exceptions_save_error'));
    }
  }

  async function handleDeleteException(id: string) {
    const [ok] = await deleteWithApi(`/station/hour-exceptions/${id}`);
    if (ok) {
      setExceptions((prev) => prev.filter((e) => e.id !== id));
      success(t('hours_exceptions_delete_success'));
    } else {
      showError(t('hours_exceptions_delete_error'));
    }
  }

  if (loading) {
    return <PageLoader label={t('loading')} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Global template — defines default hours applied to all days */}
      <section className="rounded-2xl border border-[#E8E4DC] bg-white p-6 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[1.5px] text-[#C49A1E]">
          {t('hours_template_title')}
        </h3>
        <p className="mb-4 text-[12px] leading-snug text-[#888] dark:text-[#9A9A8A]">
          {t('hours_template_hint')}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Morning slot */}
          <div className="rounded-xl bg-[#F7F6F2] p-4 dark:bg-[#0F1A0C]">
            <span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.5px] text-[#AAAAAA] dark:text-[#5A5A4A]">
              {t('hours_morning')}
            </span>
            <div className="flex items-center gap-2">
              <input
                className={timeInputClass}
                type="time"
                value={template.morning_start}
                disabled={locked || saving}
                onChange={(e) => setTemplate((p) => ({ ...p, morning_start: e.target.value }))}
                aria-label={t('hours_morning_start')}
              />
              <span className="shrink-0 text-[12px] font-bold text-[#C49A1E]" aria-hidden="true">→</span>
              <input
                className={timeInputClass}
                type="time"
                value={template.morning_end}
                disabled={locked || saving}
                onChange={(e) => setTemplate((p) => ({ ...p, morning_end: e.target.value }))}
                aria-label={t('hours_morning_end')}
              />
            </div>
          </div>

          {/* Afternoon slot */}
          <div className="rounded-xl bg-[#F7F6F2] p-4 dark:bg-[#0F1A0C]">
            <span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.5px] text-[#AAAAAA] dark:text-[#5A5A4A]">
              {t('hours_afternoon')}
            </span>
            <div className="flex items-center gap-2">
              <input
                className={timeInputClass}
                type="time"
                value={template.afternoon_start}
                disabled={locked || saving}
                onChange={(e) => setTemplate((p) => ({ ...p, afternoon_start: e.target.value }))}
                aria-label={t('hours_afternoon_start')}
              />
              <span className="shrink-0 text-[12px] font-bold text-[#C49A1E]" aria-hidden="true">→</span>
              <input
                className={timeInputClass}
                type="time"
                value={template.afternoon_end}
                disabled={locked || saving}
                onChange={(e) => setTemplate((p) => ({ ...p, afternoon_end: e.target.value }))}
                aria-label={t('hours_afternoon_end')}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={applyTemplateToAllDays}
            disabled={locked || saving}
            className="rounded-xl border border-[#C49A1E] px-4 py-2 text-[12px] font-bold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('hours_apply_to_all')}
          </button>
        </div>
      </section>

      {/* Per-day schedule */}
      <section className="rounded-2xl border border-[#E8E4DC] bg-white p-6 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[1.5px] text-[#C49A1E]">
          {t('hours_per_day_title')}
        </h3>
        <p className="mb-4 text-[12px] leading-snug text-[#888] dark:text-[#9A9A8A]">
          {t('hours_per_day_hint')}
        </p>
        <div className="grid grid-cols-[100px_44px_1fr] gap-3 border-b border-[#E0DCD0] pb-2 text-[10px] font-bold uppercase tracking-[0.5px] text-[#AAAAAA] dark:border-[#243020] dark:text-[#5A5A4A]">
          <span />
          <span />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <span>{t('hours_morning')}</span>
            <span>{t('hours_afternoon')}</span>
          </div>
        </div>
        <div className="flex flex-col">
          {DAY_KEYS.map((key, i) => {
            const day = days[i];
            return (
              <HoursDayRow
                key={key}
                dayLabel={t(`hours_day_${key}`)}
                enabled={day.is_open}
                morningStart={day.morning_start ?? ''}
                morningEnd={day.morning_end ?? ''}
                afternoonStart={day.afternoon_start ?? ''}
                afternoonEnd={day.afternoon_end ?? ''}
                disabled={locked || saving}
                onToggle={(v) => updateDay(day.day_of_week, { is_open: v })}
                onMorningStartChange={(v) => updateDay(day.day_of_week, { morning_start: v || null })}
                onMorningEndChange={(v) => updateDay(day.day_of_week, { morning_end: v || null })}
                onAfternoonStartChange={(v) => updateDay(day.day_of_week, { afternoon_start: v || null })}
                onAfternoonEndChange={(v) => updateDay(day.day_of_week, { afternoon_end: v || null })}
              />
            );
          })}
        </div>
      </section>

      <HoursExceptions
        exceptions={exceptions}
        saving={saving}
        onAdd={handleAddException}
        onDelete={handleDeleteException}
        disabled={locked}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={locked || saving}
          className="flex items-center gap-2 rounded-xl bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          ) : null}
          {t('hours_btn_save')}
        </button>
      </div>
    </div>
  );
}

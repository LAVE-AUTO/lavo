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

export function HoursTab({ config, locked }: Props) {
  const t = useTranslations('station_config');
  const { success, error: showError } = useToast();

  const hasSingleHours = Boolean(config.opening_time || config.closing_time);

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

  async function handleSave() {
    setSaving(true);
    const [ok] = await patchWithApi('/station/hours', { days });
    if (ok) {
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
      {hasSingleHours && (
        <section className="rounded-2xl border border-[#E8E4DC] bg-white p-6 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[1.5px] text-[#C49A1E]">
            {t('hours_current_title')}
          </h3>
          <p className="mb-4 text-[12px] leading-snug text-[#888] dark:text-[#9A9A8A]">
            {t('hours_current_hint')}
          </p>
          <div className="flex flex-wrap items-center gap-5 rounded-xl bg-[#F7F6F2] px-5 py-4 dark:bg-[#0F1A0C]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">
                {t('field_opening_time')}
              </span>
              <span className="text-[20px] font-black tabular-nums leading-none text-[#1A1A0A] dark:text-[#F0EDD4]">
                {config.opening_time || '—'}
              </span>
            </div>
            <span className="text-[18px] font-light text-[#C49A1E]">→</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">
                {t('field_closing_time')}
              </span>
              <span className="text-[20px] font-black tabular-nums leading-none text-[#1A1A0A] dark:text-[#F0EDD4]">
                {config.closing_time || '—'}
              </span>
            </div>
            {(config.break_start || config.break_end) && (
              <>
                <span className="h-7 w-px bg-[#E0DCD0] dark:bg-[#243020]" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#4A4A3A]">
                    {t('hours_break')}
                  </span>
                  <span className="text-[14px] font-bold tabular-nums text-[#888] dark:text-[#9A9A8A]">
                    {config.break_start || '—'} – {config.break_end || '—'}
                  </span>
                </div>
              </>
            )}
          </div>
        </section>
      )}

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

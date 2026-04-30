'use client';

import { useTranslations } from 'next-intl';
import type { StationConfig } from '../types';
import { BackendMissingBanner } from '../BackendMissingBanner';
import { HoursDayRow } from './HoursDayRow';
import { HoursExceptions } from './HoursExceptions';

interface Props {
  config: StationConfig;
  locked: boolean;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function HoursTab({ config, locked }: Props) {
  const t = useTranslations('station_config');

  // Backend currently exposes a single opening/closing pair on /station/config.
  // We surface the values as a read-only summary above the (disabled) per-day grid
  // so the merchant sees what's actually persisted today.
  const hasSingleHours = Boolean(config.opening_time || config.closing_time);

  return (
    <div className="flex flex-col gap-5">
      <BackendMissingBanner
        endpoints={[
          'GET /station/hours',
          'PATCH /station/hours { day_of_week, is_open, morning, afternoon }',
          'GET /station/hour-exceptions',
          'POST /station/hour-exceptions { date, reason }',
          'DELETE /station/hour-exceptions/:id',
        ]}
      />

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
          {DAY_KEYS.map((day) => (
            <HoursDayRow
              key={day}
              dayLabel={t(`hours_day_${day}`)}
              enabled={false}
              morningStart=""
              morningEnd=""
              afternoonStart=""
              afternoonEnd=""
              disabled={true}
            />
          ))}
        </div>
      </section>

      <HoursExceptions disabled={true} />

      <div className="flex justify-end">
        <button
          type="button"
          disabled
          title={t('backend_missing_save_disabled')}
          className="flex items-center gap-2 rounded-xl bg-[#C49A1E] px-6 py-2.5 text-[13px] font-bold text-[#0C1209] opacity-40 cursor-not-allowed"
        >
          {t('hours_btn_save')}
        </button>
      </div>

      {/* locked prop is reserved for pending-approval state; UI is already disabled here */}
      {locked && <span className="sr-only" aria-hidden="true" />}
    </div>
  );
}

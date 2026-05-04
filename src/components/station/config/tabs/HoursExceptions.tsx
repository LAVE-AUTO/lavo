'use client';

import { useTranslations } from 'next-intl';

interface Props {
  disabled: boolean;
}

export function HoursExceptions({ disabled }: Props) {
  const t = useTranslations('station_config');

  return (
    <section className="rounded-2xl border border-[#E8E4DC] bg-white p-6 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#C49A1E]">
          {t('hours_exceptions_title')}
        </h3>
        <button
          type="button"
          disabled={disabled}
          aria-label={t('hours_exceptions_add')}
          className="flex items-center gap-1.5 rounded-[8px] border border-[#C49A1E]/40 px-3 py-1.5 text-[12px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/8 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('hours_exceptions_add')}
        </button>
      </div>

      <p className="mb-4 text-[12px] leading-snug text-[#888] dark:text-[#9A9A8A]">
        {t('hours_exceptions_hint')}
      </p>

      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#D8D4C8] bg-[#F7F6F2] px-4 py-8 dark:border-[#243020] dark:bg-[#0F1A0C]">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#BBBBAA"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <p className="text-[12px] font-semibold text-[#888] dark:text-[#9A9A8A]">
          {t('hours_exceptions_empty')}
        </p>
      </div>
    </section>
  );
}

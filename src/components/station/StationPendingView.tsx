'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/context';

interface Props {
  stationName: string;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function Step({
  index, label, desc, status,
}: {
  index: number;
  label: string;
  desc: string;
  status: 'done' | 'active' | 'upcoming';
}) {
  const isDone     = status === 'done';
  const isActive   = status === 'active';
  const isUpcoming = status === 'upcoming';

  return (
    <div className="flex gap-4">
      {/* Icon column */}
      <div className="flex flex-col items-center">
        <div className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-black transition-all',
          isDone
            ? 'bg-[#00C851]/12 text-[#00C851]'
            : isActive
            ? 'bg-[#C49A1E]/12 text-[#C49A1E] ring-2 ring-[#C49A1E]/30'
            : 'bg-[#F0EDE0] text-[#CCC] dark:bg-[#1E2A1A] dark:text-[#3A3A2A]',
        ].join(' ')}>
          {isDone ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : isActive ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C49A1E] opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#C49A1E]" />
            </span>
          ) : (
            <span>{index}</span>
          )}
        </div>
        {/* Connector line */}
        {index < 3 && (
          <div className={[
            'mt-1 w-px flex-1',
            isDone ? 'bg-[#00C851]/20' : 'bg-[#E8E4D8] dark:bg-[#1E2A1A]',
          ].join(' ')} style={{ minHeight: 24 }} />
        )}
      </div>

      {/* Text column */}
      <div className="pb-6 pt-1.5">
        <p className={[
          'text-[13px] font-black',
          isDone
            ? 'text-[#00C851]'
            : isActive
            ? 'text-[#C49A1E]'
            : 'text-[#CCC] dark:text-[#3A3A2A]',
        ].join(' ')}>
          {label}
        </p>
        <p className={[
          'mt-0.5 text-[11px] leading-relaxed',
          isDone || isActive
            ? 'text-[#666] dark:text-[#7A7A6A]'
            : 'text-[#CCC] dark:text-[#2A2A1A]',
        ].join(' ')}>
          {desc}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StationPendingView({ stationName }: Props) {
  const t      = useTranslations('station_pending');
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5EE] dark:bg-[#0C1209]">

      {/* Minimal top bar */}
      <div className="flex items-center justify-between border-b border-[#E0DCD0] bg-white px-6 py-3.5 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <span className="text-[14px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">Slowtime</span>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1.5 rounded-[8px] border border-[#E0DCD0] px-3 py-1.5 text-[12px] font-semibold text-[#888] transition-colors hover:bg-[#F0EDE0] dark:border-[#243020] dark:text-[#6A6A5A] dark:hover:bg-[#1A2416]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t('btn_logout')}
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 items-start justify-center px-6 py-10">
        <div className="w-full max-w-lg">

          {/* Status card */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">

            {/* Gold top bar */}
            <div className="h-1 w-full bg-gradient-to-r from-[#C49A1E] via-[#E0BC4A] to-[#C49A1E]" />

            <div className="px-7 pt-7 pb-6">
              {/* Icon + title */}
              <div className="mb-5 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#C49A1E]/10">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-[18px] font-black leading-tight text-[#1A1A0A] dark:text-[#F0EDD4]">
                    {t('title')}
                  </h1>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#888] dark:text-[#6A6A5A]">
                    {t('subtitle', { name: stationName })}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="mb-6 border-t border-[#F0EDE0] dark:border-[#243020]" />

              {/* Steps */}
              <Step index={1} label={t('step1_label')} desc={t('step1_desc')} status="done"     />
              <Step index={2} label={t('step2_label')} desc={t('step2_desc')} status="active"   />
              <Step index={3} label={t('step3_label')} desc={t('step3_desc')} status="upcoming" />
            </div>

            {/* Notice footer */}
            <div className="border-t border-[#F0EDE0] bg-[#FAFAF5] px-7 py-4 dark:border-[#1E2A1A] dark:bg-[#141D11]">
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#AAA] dark:text-[#4A4A3A]">
                <svg width="13" height="13" className="mt-px shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {t('notice')}
              </p>
            </div>
          </div>

          {/* Support link */}
          <p className="mt-4 text-center text-[11px] text-[#BBBBAA] dark:text-[#3A3A2A]">
            {t('or_contact_support')}
          </p>

        </div>
      </div>
    </div>
  );
}

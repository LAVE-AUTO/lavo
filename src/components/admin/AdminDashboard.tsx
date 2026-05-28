'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AdminKpiRow } from './dashboard/AdminKpiRow';
import { AdminAnalyticsCharts } from './dashboard/AdminAnalyticsCharts';
import { AdminAlertsSection } from './dashboard/AdminAlertsSection';

const KPI_MASK_STORAGE_KEY = 'lavo_admin_dashboard_kpi_masked';

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.79 19.79 0 0 1 5.17-6.13" />
    <path d="M9.9 5.08A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.81 19.81 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

function StatusDot() {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-[#00C851]/30 bg-[#00C851]/10 px-3 py-1">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00C851] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00C851]" />
      </span>
      <span className="text-[11px] font-black uppercase tracking-wider text-[#00A041]">
        Opérationnel
      </span>
    </span>
  );
}

export function AdminDashboard() {
  const t = useTranslations('admin_dashboard');
  const locale = useLocale();
  const [masked, setMasked] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(KPI_MASK_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  function toggleMasked() {
    setMasked((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(KPI_MASK_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  const today = new Date().toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-[#F5F5EE] dark:bg-[#0C1209]">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="border-b border-[#E8E4D8] bg-white px-7 py-5 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-black leading-tight text-[#0F1A0C] dark:text-[#FFF9EC]">
              {t('page_title')}
            </h1>
            <p className="mt-0.5 text-[12px] capitalize text-[#999] dark:text-[#A0A090]">{today}</p>
          </div>
          <StatusDot />
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-6 px-7 py-6">

        {/* KPI section */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#DDAF3B]">
              {t('section_performance')}
            </span>
            <span className="h-px flex-1 bg-[#E8E4D8] dark:bg-[#1A2A14]" />
            <span className="rounded-full bg-[#DDAF3B]/10 px-3 py-0.5 text-[11px] font-bold text-[#DDAF3B]">
              {t('kpi_period')}
            </span>
            <button
              type="button"
              onClick={toggleMasked}
              aria-pressed={masked}
              aria-label={masked ? t('kpi_reveal') : t('kpi_hide_aria')}
              title={masked ? t('kpi_reveal') : t('kpi_hide_aria')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#E8E4D8] text-foreground/65 transition-colors hover:bg-[#DDD8C4] hover:text-[#001201] dark:bg-[#1A2A14] dark:text-[#A0A090] dark:hover:bg-[#001A05] dark:hover:text-[#FFF9EC]"
            >
              {masked ? <EyeOffIcon /> : <EyeIcon />}
            </button>
            {masked && (
              <span className="text-[10px] font-bold text-[#999] dark:text-[#5A5A4A]">
                {t('kpi_masked')}
              </span>
            )}
          </div>
          <AdminKpiRow masked={masked} />
        </section>

        {/* Analytics charts */}
        <section>
          <AdminAnalyticsCharts />
        </section>

        {/* Alerts section */}
        <section className="flex flex-1 flex-col">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#DDAF3B]">
              {t('alerts_title')}
            </span>
            <span className="h-px flex-1 bg-[#E8E4D8] dark:bg-[#1A2A14]" />
          </div>
          <AdminAlertsSection />
        </section>

      </div>
    </div>
  );
}

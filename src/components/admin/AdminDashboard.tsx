'use client';

import { useTranslations, useLocale } from 'next-intl';
import { AdminKpiRow } from './dashboard/AdminKpiRow';
import { AdminAnalyticsCharts } from './dashboard/AdminAnalyticsCharts';
import { AdminAlertsSection } from './dashboard/AdminAlertsSection';

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
  const t      = useTranslations('admin_dashboard');
  const locale = useLocale();

  const today = new Date().toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-[#F5F5EE] dark:bg-[#0C1209]">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="border-b border-[#E8E4D8] bg-white px-7 py-5 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-black leading-tight text-[#0F1A0C] dark:text-[#F0EDD4]">
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
            <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#C49A1E]">
              {t('section_performance')}
            </span>
            <span className="h-px flex-1 bg-[#E8E4D8] dark:bg-[#1A2A14]" />
            <span className="rounded-full bg-[#C49A1E]/10 px-3 py-0.5 text-[11px] font-bold text-[#C49A1E]">
              {t('kpi_period')}
            </span>
          </div>
          <AdminKpiRow />
        </section>

        {/* Analytics charts */}
        <section>
          <AdminAnalyticsCharts />
        </section>

        {/* Alerts section */}
        <section className="flex flex-1 flex-col">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#C49A1E]">
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

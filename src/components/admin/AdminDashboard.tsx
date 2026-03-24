'use client';

import { useTranslations, useLocale } from 'next-intl';
import { AdminKpiRow } from './dashboard/AdminKpiRow';
import { AdminAlertsSection } from './dashboard/AdminAlertsSection';

export function AdminDashboard() {
  const t      = useTranslations('admin_dashboard');
  const locale = useLocale();

  const today = new Date().toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Page header */}
      <div className="border-b border-[#DDD9CC] bg-[#F0EDE0] px-5 py-4 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <h1 className="text-[18px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
        <p className="mt-0.5 text-[11px] capitalize text-[#888] dark:text-[#6A6A5A]">{today}</p>
      </div>

      {/* KPI row */}
      <AdminKpiRow />

      {/* Section label */}
      <div className="px-5 pt-5">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#C49A1E]">{t('alerts_title')}</span>
      </div>

      {/* Alerts */}
      <AdminAlertsSection />
    </div>
  );
}

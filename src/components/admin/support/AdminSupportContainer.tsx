'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MOCK_TICKETS } from '@/components/support/support-mock';
import { AdminSupportList } from './AdminSupportList';
import { AdminSupportSettings } from './AdminSupportSettings';

const STAT_CARDS = [
  { key: 'open',        labelKey: 'status_open',        color: '#F97316', bg: 'bg-[#FFF4EC] dark:bg-[#F97316]/8',  ring: 'ring-[#F97316]/20', text: 'text-[#C2410C] dark:text-[#F97316]' },
  { key: 'in_progress', labelKey: 'status_in_progress', color: '#3B82F6', bg: 'bg-[#EFF6FF] dark:bg-[#3B82F6]/8',  ring: 'ring-[#3B82F6]/20', text: 'text-[#1D4ED8] dark:text-[#60A5FA]' },
  { key: 'resolved',    labelKey: 'status_resolved',    color: '#22C55E', bg: 'bg-[#F0FDF4] dark:bg-[#22C55E]/8',  ring: 'ring-[#22C55E]/20', text: 'text-[#15803D] dark:text-[#4ADE80]' },
  { key: 'closed',      labelKey: 'status_closed',      color: '#94A3B8', bg: 'bg-[#F8FAFC] dark:bg-[#94A3B8]/8',  ring: 'ring-[#94A3B8]/20', text: 'text-[#64748B] dark:text-[#94A3B8]' },
] as const;

export function AdminSupportContainer() {
  const t     = useTranslations('admin_support');
  const [query, setQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // TODO: replace with getFromApi('/admin/support/tickets') once endpoint is available
  const tickets = MOCK_TICKETS;

  const counts = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
  for (const tk of tickets) counts[tk.status as keyof typeof counts]++;

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 pb-5 pt-6 dark:border-[#1A2A14] dark:bg-[#0C1209]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
            <p className="mt-0.5 text-[12px] text-[#888] dark:text-[#9A9A8A]">{t('page_subtitle')}</p>
          </div>

          {/* Search + settings toggle */}
          <div className="flex items-center gap-2 mt-1">
            <button type="button" onClick={() => setShowSettings((v) => !v)}
              className={[
                'flex items-center gap-1.5 rounded-[8px] border px-3 py-2 text-[12px] font-semibold transition-colors',
                showSettings
                  ? 'border-[#C49A1E]/40 bg-[#C49A1E]/10 text-[#C49A1E]'
                  : 'border-[#D8D4C8] text-[#888] hover:border-[#C49A1E]/40 hover:text-[#C49A1E] dark:border-[#243020] dark:text-[#9A9A8A]',
              ].join(' ')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
              {t('btn_settings')}
            </button>
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#BBBBAA] dark:text-[#A0A090]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search_placeholder')}
                className="w-[220px] rounded-[8px] border border-[#D8D4C8] bg-white py-2 pl-8 pr-3 text-[12px] text-[#1A1A0A] outline-none transition-all focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]"
              />
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STAT_CARDS.map(({ key, labelKey, bg, ring, text }) => (
            <div key={key} className={`flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ${bg} ${ring}`}>
              <span className={`text-[22px] font-black leading-none ${text}`}>
                {counts[key as keyof typeof counts]}
              </span>
              <span className={`text-[11px] font-bold leading-tight ${text} opacity-80`}>
                {t(labelKey)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#F5F5EE] p-6 dark:bg-[#0C1209]">
        {showSettings && (
          <div className="mb-6">
            <AdminSupportSettings />
          </div>
        )}
        <AdminSupportList tickets={tickets} query={query} />
      </div>
    </div>
  );
}

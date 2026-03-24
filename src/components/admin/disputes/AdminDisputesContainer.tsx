'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MOCK_DISPUTES } from './disputes-mock';
import { AdminDisputesList } from './AdminDisputesList';

export function AdminDisputesContainer() {
  const t       = useTranslations('admin_disputes');
  const [query, setQuery] = useState('');

  // TODO: replace with getFromApi('/admin/disputes') once endpoint is available
  const disputes = MOCK_DISPUTES;
  const open     = disputes.filter((d) => d.status === 'open').length;

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 pb-0 pt-6 dark:border-[#1A2A14] dark:bg-[#0C1209]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
            <p className="mt-1 text-[12px] text-[#888] dark:text-[#6A6A5A]">{t('page_subtitle')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <span className="flex items-center gap-1.5 rounded-full border border-[#F97316]/20 bg-[#F97316]/8 px-3 py-1 text-[11px] font-bold text-[#F97316]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]" />{open} {t('chip_open')}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-[#D8D4C8] bg-[#F0EDE6] px-3 py-1 text-[11px] font-bold text-[#888] dark:border-[#243020] dark:bg-[#1A2A14] dark:text-[#6A6A5A]">
              {disputes.length} {t('chip_total')}
            </span>
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-5 flex items-end justify-end pb-0">
          <div className="relative mb-2.5">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#BBBBAA]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search_placeholder')}
              className="w-[220px] rounded-[8px] border border-[#D8D4C8] bg-white py-1.5 pl-8 pr-3 text-[12px] text-[#1A1A0A] outline-none transition-all focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] focus:ring-0 dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#F5F5EE] p-6 dark:bg-[#0C1209]">
        <AdminDisputesList disputes={disputes} query={query} />
      </div>
    </div>
  );
}

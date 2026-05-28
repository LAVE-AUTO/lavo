'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services/axios-service';
import type { ApiTicketListItem, DisplayStatus } from '@/types/support';
import { STATUS_MAP } from '@/types/support';
import { AdminSupportList } from './AdminSupportList';
import { AdminSupportSettings } from './AdminSupportSettings';

type FilterKey = DisplayStatus | 'all';

export function AdminSupportContainer() {
  const t = useTranslations('admin_support');
  const [query, setQuery]               = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [tickets, setTickets]           = useState<ApiTicketListItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(false);
  const [filter, setFilter]             = useState<FilterKey>('all');

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    setLoading(true);
    setError(false);
    getFromApi<{ data: { items: ApiTicketListItem[] } }>('/support?limit=100').then(([ok, res]) => {
      if (!mountedRef.current) return;
      if (ok && res && typeof res === 'object' && 'data' in res) {
        const items = (res as { data?: { items?: ApiTicketListItem[] } }).data?.items ?? [];
        setTickets(items);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  const counts = { all: tickets.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
  for (const tk of tickets) {
    const key = STATUS_MAP[tk.status];
    counts[key as keyof typeof counts]++;
  }

  const metrics = [
    { label: t('status_open'),        value: loading ? '…' : String(counts.open),        accent: '#F97316' },
    { label: t('status_in_progress'), value: loading ? '…' : String(counts.in_progress), accent: '#1E40AF' },
    { label: t('status_resolved'),    value: loading ? '…' : String(counts.resolved),    accent: '#22C55E' },
    { label: t('status_closed'),      value: loading ? '…' : String(counts.closed),      accent: '#94A3B8' },
  ];

  const FILTERS: Array<{ key: FilterKey; label: string; color?: string }> = [
    { key: 'all',         label: t('filter_all') },
    { key: 'open',        label: t('status_open'),        color: '#F97316' },
    { key: 'in_progress', label: t('status_in_progress'), color: '#1E40AF' },
    { key: 'resolved',    label: t('status_resolved'),    color: '#22C55E' },
    { key: 'closed',      label: t('status_closed'),      color: '#94A3B8' },
  ];

  const pillCls = (active: boolean) => [
    'relative flex items-center gap-2 rounded-[14px] px-3.5 py-2 text-[12.5px] font-bold transition-colors duration-150',
    active
      ? 'bg-[#001201] text-[#FFF9EC] shadow-[0_10px_20px_rgba(26,26,10,0.18)] dark:bg-[#FFF9EC] dark:text-[#001201]'
      : 'text-[#847E70] hover:bg-[#EFE8D7] hover:text-[#001201] dark:text-[#B0BFB1] dark:hover:bg-[#182214] dark:hover:text-[#FFF9EC]',
  ].join(' ');

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(221, 175, 59,0.12),_transparent_36%),linear-gradient(180deg,#faf8f2_0%,#f2efe7_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(221, 175, 59,0.12),_transparent_32%),linear-gradient(180deg,#001201_0%,#091009_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col gap-5 overflow-y-auto scrollbar-none px-3 py-4 sm:px-4 lg:px-6 lg:py-6">

        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.08)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#DDAF3B]/18 bg-[#DDAF3B]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#9A7A13] dark:border-[#DDAF3B]/25 dark:bg-[#DDAF3B]/12 dark:text-[#F0D98C]">
                {t('badge_support')}
              </span>
              <h1 className="mt-4 text-[clamp(28px,3vw,42px)] font-black leading-[1.04] text-[#001201] dark:text-[#FFF9EC]">
                {t('page_title')}
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#6F6B5F] dark:text-[#A6A091]">
                {t('page_subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:w-[640px] 2xl:w-[720px]">
              {metrics.map((metric) => (
                <div key={metric.label} className="group relative overflow-hidden rounded-[24px] border border-[#E9E4D8] bg-[#FBFAF7] px-5 py-4 shadow-[0_10px_30px_rgba(26,26,10,0.05)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-[#1E2E18] dark:bg-[#0C150B]">
                  <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: metric.accent }} />
                  <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-3xl opacity-15 transition-opacity duration-200 group-hover:opacity-25" style={{ background: metric.accent }} />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]">{metric.label}</div>
                    <div className="mt-3 text-[28px] font-black leading-none text-[#001201] dark:text-[#FFF9EC]">{metric.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters + search + settings toggle */}
          <div className="mt-5 rounded-[24px] border border-[#E7E1D5] bg-[#F8F6F1]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur dark:border-[#1E2E18] dark:bg-[#0C150B]/85">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">

              <div className="inline-flex flex-wrap gap-1.5 rounded-[18px] bg-white/65 p-1.5 dark:bg-[#111A0E]/80">
                {FILTERS.map(({ key, label, color }) => (
                  <button key={key} type="button" onClick={() => setFilter(key)} className={pillCls(filter === key)}>
                    {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: filter === key ? color : '#CCCCCC' }} />}
                    {label}
                    <span className={[
                      'min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-black',
                      filter === key ? 'bg-[#DDAF3B] text-[#001201]' : 'bg-[#E1DBCF] text-[#7E796B] dark:bg-[#1E2E18] dark:text-[#B0BFB1]',
                    ].join(' ')}>{counts[key as keyof typeof counts]}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:min-w-[360px] xl:justify-end">
                <label className="relative min-w-[200px] flex-1 xl:max-w-[280px]">
                  <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#BBB6A7]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('search_placeholder')}
                    className="w-full rounded-[16px] border border-[#D8D4C8] bg-white/95 py-2.5 pl-9 pr-4 text-[13px] font-medium text-[#001201] outline-none transition-all focus:border-[#DDAF3B] focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.12)] focus:ring-0 dark:border-[#001A05] dark:bg-[#0D170B] dark:text-[#FFF9EC] dark:focus:border-[#DDAF3B]"
                  />
                </label>

                <button type="button" onClick={() => setShowSettings((v) => !v)}
                  className={[
                    'inline-flex items-center justify-center gap-1.5 rounded-[16px] border px-3.5 py-2.5 text-[12.5px] font-bold transition-colors',
                    showSettings
                      ? 'border-[#DDAF3B]/40 bg-[#DDAF3B]/12 text-[#9A7A13] dark:bg-[#DDAF3B]/15 dark:text-[#F0D98C]'
                      : 'border-[#D8D4C8] bg-white text-[#5A554B] hover:border-[#DDAF3B]/40 hover:bg-[#FCF6E5] hover:text-[#9A7A13] dark:border-[#1E2E18] dark:bg-[#0E170C] dark:text-[#A6A091] dark:hover:bg-[#1A2410] dark:hover:text-[#F0D98C]',
                  ].join(' ')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
                  {t('btn_settings')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {showSettings && (
          <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.07)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <AdminSupportSettings />
          </section>
        )}

        <section className="flex flex-col gap-4 rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.07)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <p className="text-[13px] font-semibold text-[#999]">{t('load_error')}</p>
            </div>
          ) : (
            <AdminSupportList tickets={tickets} query={query} loading={loading} filter={filter} />
          )}
        </section>
      </div>
    </div>
  );
}

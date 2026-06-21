'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getFromApi } from '@/services/axios-service';

interface ApiStation {
  id: string;
  name: string;
  city: string;
  address: string;
  wash_post_count: number | null;
  service_scope: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  rejection_reason: string | null;
  rejection_count: number;
  documents?: { id: string }[];
}

interface ApiResponse {
  data: {
    stations: ApiStation[];
    meta: { total: number; page: number; per_page: number; total_pages: number };
  };
}

type Tab = 'all' | 'pending' | 'approved' | 'rejected';

function initials(name: string): string {
  return name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
}

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string; border: string; barColor: string }> = {
  pending_admin_validation: { dot: '#DDAF3B', bg: 'rgba(221, 175, 59,0.08)', text: '#DDAF3B', border: 'rgba(221, 175, 59,0.2)', barColor: '#DDAF3B' },
  active:                   { dot: '#00C851', bg: 'rgba(0,200,81,0.07)',   text: '#00C851', border: 'rgba(0,200,81,0.2)',   barColor: '#00C851' },
  rejected:                 { dot: '#EF4444', bg: 'rgba(239,68,68,0.07)',  text: '#EF4444', border: 'rgba(239,68,68,0.2)',  barColor: '#EF4444' },
  suspended:                { dot: '#AAAAAA', bg: 'rgba(170,170,170,0.07)',text: '#888',    border: 'rgba(170,170,170,0.2)',barColor: '#AAAAAA' },
};

function StationCard({ s, locale, t }: { s: ApiStation; locale: string; t: ReturnType<typeof useTranslations<'admin_stations'>> }) {
  const style     = STATUS_STYLES[s.status] ?? STATUS_STYLES['suspended'];
  const isPending  = s.status === 'pending_admin_validation';
  const isApproved = s.status === 'active';
  const isRejected = s.status === 'rejected';

  const dateLabel = isApproved
    ? formatDate(s.approved_at, locale)
    : formatDate(s.updated_at ?? s.created_at, locale);

  const datePrefixLabel = isPending
    ? t('label_submitted_on')
    : isApproved
      ? t('label_approved_on')
      : isRejected
        ? t('label_rejected_on')
        : t('label_updated_on');

  const statusLabel = isPending
    ? t('status_pending')
    : isApproved
      ? t('status_active')
      : isRejected
        ? t('status_rejected')
        : t('status_suspended');

  const docCount = s.documents?.length ?? 0;

  return (
    <div className="group relative flex items-stretch overflow-hidden rounded-2xl border border-separator/25 bg-card-surface shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] transition-all duration-200 hover:-translate-y-px hover:shadow-md dark:bg-[#161F13] dark:border-white/[0.06]">
      <div className="w-[4px] shrink-0 rounded-l-2xl transition-all duration-200 group-hover:w-[5px]" style={{ background: style.barColor }} />

      <div className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4">
        <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl text-[14px] font-black"
          style={{ background: style.bg, color: style.dot, boxShadow: `0 0 0 1px ${style.border}` }}>
          {initials(s.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[14px] font-black text-[#001201] dark:text-[#FFF9EC]">{s.name}</p>
            <span className="shrink-0 rounded-[5px] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest"
              style={{ background: style.bg, color: style.dot }}>
              {statusLabel}
            </span>
          </div>

          <p className="mt-0.5 truncate text-[12px] text-[#AAA] dark:text-foreground/70">
            {[s.city, s.address].filter(Boolean).join(' · ')}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#999] dark:text-[#B0BFB1]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-[#BBBBAA] dark:text-[#7E8A75]">{datePrefixLabel}</span>
              {dateLabel}
            </span>

            {isPending && docCount > 0 && <span className="text-[#DDD] dark:text-[#3A4A33]">·</span>}

            {isPending && docCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#999] dark:text-[#B0BFB1]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                {t('label_docs_count', { n: docCount })}
              </span>
            )}

            {s.rejection_count > 0 && (
              <>
                <span className="text-[#DDD] dark:text-[#3A4A33]">·</span>
                <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#EF4444' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {t('label_rejection_count', { n: s.rejection_count })}
                </span>
              </>
            )}
          </div>

          {isRejected && s.rejection_reason && (
            <p className="mt-2 line-clamp-1 rounded-[6px] bg-[#FEF2F2] px-2 py-1 text-[11px] italic leading-relaxed text-[#EF4444]/80 dark:bg-[#1E0A0A] dark:text-[#EF4444]/60">
              {s.rejection_reason}
            </p>
          )}
        </div>

        <Link href={`/admin/stations/${s.id}` as Parameters<typeof Link>[0]['href']}
          className="flex shrink-0 items-center gap-1.5 self-center rounded-[10px] px-3.5 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-80"
          style={{ background: style.dot }}>
          {t('btn_review')}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

export function PendingStationsList() {
  const t      = useTranslations('admin_stations');
  const locale = useLocale();

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [allStations, setAllStations] = useState<ApiStation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState(false);
  const [activeTab, setActiveTab]     = useState<Tab>('pending');

  const loadStations = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const [ok, data] = await getFromApi(`/admin/stations?status=all&per_page=100`);
    if (!mountedRef.current) return;
    if (!ok) { setLoadError(true); setLoading(false); return; }
    const payload = (data as ApiResponse)?.data;
    setAllStations(payload?.stations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadStations(); }, [loadStations]);

  const counts = {
    all:      allStations.length,
    pending:  allStations.filter((s) => s.status === 'pending_admin_validation').length,
    approved: allStations.filter((s) => s.status === 'active' || s.status === 'suspended').length,
    rejected: allStations.filter((s) => s.status === 'rejected').length,
  };

  const filtered = allStations.filter((s) => {
    if (activeTab === 'all')      return true;
    if (activeTab === 'pending')  return s.status === 'pending_admin_validation';
    if (activeTab === 'approved') return s.status === 'active' || s.status === 'suspended';
    if (activeTab === 'rejected') return s.status === 'rejected';
    return true;
  });

  const emptyKey = activeTab === 'approved' ? 'empty_approved'
    : activeTab === 'rejected' ? 'empty_rejected'
      : activeTab === 'all'      ? 'empty_all'
        : 'empty_title';

  const TABS: Array<{ key: Tab; label: string; color: string }> = [
    { key: 'pending',  label: t('tab_pending'),  color: '#DDAF3B' },
    { key: 'approved', label: t('tab_approved'), color: '#00C851' },
    { key: 'rejected', label: t('tab_rejected'), color: '#EF4444' },
    { key: 'all',      label: t('tab_all'),      color: '#DDAF3B' },
  ];

  const metrics = [
    { label: t('tab_pending'),  value: loading ? '…' : String(counts.pending),  accent: '#DDAF3B' },
    { label: t('tab_approved'), value: loading ? '…' : String(counts.approved), accent: '#00C851' },
    { label: t('tab_rejected'), value: loading ? '…' : String(counts.rejected), accent: '#EF4444' },
    { label: t('tab_all'),      value: loading ? '…' : String(counts.all),      accent: '#94A3B8' },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(221, 175, 59,0.12),_transparent_36%),linear-gradient(180deg,#faf8f2_0%,#f2efe7_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(221, 175, 59,0.12),_transparent_32%),linear-gradient(180deg,#001201_0%,#091009_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col gap-5 overflow-y-auto scrollbar-none px-3 py-4 sm:px-4 lg:px-6 lg:py-6">

        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.08)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#DDAF3B]/18 bg-[#DDAF3B]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#9A7A13] dark:border-[#DDAF3B]/25 dark:bg-[#DDAF3B]/12 dark:text-[#F0D98C]">
                {t('badge_verification')}
              </span>
              <h1 className="mt-4 text-[clamp(28px,3vw,42px)] font-black leading-[1.04] text-[#001201] dark:text-[#FFF9EC]">
                {t('page_title_history')}
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#6F6B5F] dark:text-[#A6A091]">
                {t('page_subtitle_history')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:w-[640px] 2xl:w-[720px]">
              {metrics.map((metric) => (
                <div key={metric.label} className="group relative overflow-hidden rounded-[24px] border border-[#E9E4D8] bg-[#FBFAF7] px-5 py-4 shadow-[0_10px_30px_rgba(26,26,10,0.05)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-[#1E2E18] dark:bg-[#0C150B]">
                  <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: metric.accent }} />
                  <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-3xl opacity-15 transition-opacity duration-200 group-hover:opacity-25" style={{ background: metric.accent }} />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]">{metric.label}</div>
                    <div className="mt-3 text-[30px] font-black leading-none text-[#001201] dark:text-[#FFF9EC]">{metric.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 rounded-[24px] border border-[#E7E1D5] bg-[#F8F6F1]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur dark:border-[#1E2E18] dark:bg-[#0C150B]/85">
            <div className="flex flex-wrap gap-2">
              {TABS.map(({ key, label, color }) => {
                const isActive = activeTab === key;
                return (
                  <button key={key} type="button" onClick={() => setActiveTab(key)}
                    className={[
                      'relative flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-[13px] font-bold transition-colors duration-150',
                      isActive ? 'bg-dark-bg text-[#FFF9EC] shadow-[0_10px_20px_rgba(26,26,10,0.18)] dark:bg-[#FFF9EC] dark:text-[#001201]' : 'text-[#847E70] hover:bg-[#EFE8D7] hover:text-[#001201] dark:text-[#B0BFB1] dark:hover:bg-[#182214] dark:hover:text-[#FFF9EC]',
                    ].join(' ')}>
                    <span className="h-2 w-2 rounded-full" style={{ background: isActive ? color : '#CCCCCC' }} />
                    {label}
                    <span className={[
                      'min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-black',
                      isActive ? 'bg-[#DDAF3B] text-[#001201]' : 'bg-[#E1DBCF] text-[#7E796B] dark:bg-[#1E2E18] dark:text-[#B0BFB1]',
                    ].join(' ')}>{counts[key]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Body */}
        <section className="flex flex-col rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.07)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          {loading && (
            <div className="flex flex-1 items-center justify-center py-24">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#DDAF3B] border-t-transparent" />
            </div>
          )}

          {!loading && loadError && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
              <p className="text-[13px] font-semibold text-foreground/55 dark:text-[#B0BFB1]">{t('error_load')}</p>
              <button type="button" onClick={loadStations}
                className="rounded-xl border border-[#DDAF3B]/40 px-4 py-2 text-[13px] font-bold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/8">
                {t('btn_retry')}
              </button>
            </div>
          )}

          {!loading && !loadError && filtered.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-[#001A05] dark:ring-white/[0.06]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <p className="text-[14px] font-bold text-[#001201] dark:text-[#FFF9EC]">{t(emptyKey)}</p>
            </div>
          )}

          {!loading && !loadError && filtered.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {filtered.map((s) => (
                <StationCard key={s.id} s={s} locale={locale} t={t} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

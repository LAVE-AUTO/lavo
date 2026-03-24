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

type Tab = 'all' | 'pending' | 'approved' | 'rejected';

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-CA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  pending_admin_validation: {
    dot: '#C49A1E', bg: '#C49A1E14', text: '#C49A1E', border: '#C49A1E33',
  },
  active: {
    dot: '#00C851', bg: '#00C85114', text: '#00C851', border: '#00C85133',
  },
  rejected: {
    dot: '#EF4444', bg: '#EF444414', text: '#EF4444', border: '#EF444433',
  },
  suspended: {
    dot: '#AAAAAA', bg: '#AAAAAA14', text: '#888888', border: '#AAAAAA33',
  },
};

// ─── Tab pill ────────────────────────────────────────────────────────────────

function TabPill({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-bold transition-colors duration-150',
        active
          ? 'bg-[#C49A1E] text-white shadow-sm'
          : 'bg-white text-[#888] ring-1 ring-black/[0.06] hover:bg-[#F5F3ED] dark:bg-[#1A2416] dark:text-[#6A6A5A] dark:ring-white/[0.06] dark:hover:bg-[#243020]',
      ].join(' ')}
    >
      {label}
      <span className={[
        'flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-black',
        active ? 'bg-white/20 text-white' : 'bg-[#F0EDE0] text-[#888] dark:bg-[#243020] dark:text-[#6A6A5A]',
      ].join(' ')}>
        {count}
      </span>
    </button>
  );
}

// ─── Station card ─────────────────────────────────────────────────────────────

function StationCard({ s, locale, t }: { s: ApiStation; locale: string; t: ReturnType<typeof useTranslations<'admin_stations'>> }) {
  const style = STATUS_STYLES[s.status] ?? STATUS_STYLES['suspended'];
  const isPending = s.status === 'pending_admin_validation';
  const isApproved = s.status === 'active';
  const isRejected = s.status === 'rejected';

  const dateLabel = isPending
    ? formatDate(s.created_at, locale)
    : isApproved
    ? formatDate(s.approved_at, locale)
    : isRejected
    ? formatDate(s.updated_at, locale)
    : formatDate(s.updated_at, locale);

  const statusLabel = isPending
    ? t('status_pending')
    : isApproved
    ? t('status_active')
    : isRejected
    ? t('status_rejected')
    : t('status_suspended');

  const docCount = s.documents?.length ?? 0;

  return (
    <div className="group relative flex items-start gap-5 overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] transition-all hover:-translate-y-0.5 hover:shadow-lg dark:bg-[#1A2416] dark:ring-white/[0.06]"
      style={{ '--hover-border': style.dot } as React.CSSProperties}>
      {/* Left accent */}
      <div className="absolute left-0 top-0 h-full w-[3px] rounded-l-2xl opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: style.dot }} />

      {/* Avatar */}
      <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl text-[15px] font-black ring-1"
        style={{ background: style.bg, color: style.dot, borderColor: style.border }}>
        {initials(s.name)}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[15px] font-black text-[#0F1A0C] dark:text-[#F0EDD4]">{s.name}</p>
          {/* Status badge */}
          <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={{ background: style.bg, color: style.dot }}>
            {statusLabel}
          </span>
        </div>

        <p className="mt-0.5 truncate text-[11px] text-[#999] dark:text-[#5A5A4A]">
          {s.city}{s.address ? ` · ${s.address}` : ''}
        </p>

        {/* Chips row */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {/* Date chip */}
          <span className="flex items-center gap-1 rounded-md bg-[#F5F3ED] px-2 py-0.5 text-[10px] font-semibold text-[#888] dark:bg-[#1E2A1A] dark:text-[#6A6A5A]">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {dateLabel}
          </span>

          {/* Docs chip (pending only) */}
          {isPending && docCount > 0 && (
            <span className="flex items-center gap-1 rounded-md bg-[#F5F3ED] px-2 py-0.5 text-[10px] font-semibold text-[#888] dark:bg-[#1E2A1A] dark:text-[#6A6A5A]">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
              {docCount}
            </span>
          )}

          {/* Rejection count chip */}
          {(isRejected || s.rejection_count > 0) && (
            <span className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: '#EF444418', color: '#EF4444' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {t('label_rejection_count', { n: s.rejection_count })}
            </span>
          )}
        </div>

        {/* Rejection reason snippet */}
        {isRejected && s.rejection_reason && (
          <p className="mt-2 line-clamp-1 text-[11px] italic text-[#EF4444]/70">
            {s.rejection_reason}
          </p>
        )}
      </div>

      {/* CTA */}
      <Link
        href={`/admin/stations/${s.id}` as Parameters<typeof Link>[0]['href']}
        className="flex shrink-0 items-center gap-1.5 self-center rounded-xl px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition-all hover:opacity-80"
        style={{ background: style.dot }}
      >
        {t('btn_review')}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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
    const [ok, data] = await getFromApi('/admin/stations?status=all');
    if (!mountedRef.current) return;
    if (!ok) { setLoadError(true); setLoading(false); return; }
    setAllStations((data as { data: ApiStation[] }).data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadStations(); }, [loadStations]);

  const filtered = allStations.filter((s) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return s.status === 'pending_admin_validation';
    if (activeTab === 'approved') return s.status === 'active' || s.status === 'suspended';
    if (activeTab === 'rejected') return s.status === 'rejected';
    return true;
  });

  const counts = {
    all: allStations.length,
    pending: allStations.filter((s) => s.status === 'pending_admin_validation').length,
    approved: allStations.filter((s) => s.status === 'active' || s.status === 'suspended').length,
    rejected: allStations.filter((s) => s.status === 'rejected').length,
  };

  const emptyKey = activeTab === 'all'
    ? 'empty_all'
    : activeTab === 'pending'
    ? 'empty_title'
    : activeTab === 'approved'
    ? 'empty_approved'
    : 'empty_rejected';

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-[#F5F5EE] dark:bg-[#0C1209]">

      {/* ── Header ── */}
      <div className="relative overflow-hidden border-b border-[#E8E4D8] bg-white px-7 py-6 dark:border-[#1A2A14] dark:bg-[#111A0E]">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-72 bg-gradient-to-l from-[#C49A1E]/5 to-transparent" />
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[21px] font-black text-[#0F1A0C] dark:text-[#F0EDD4]">{t('page_title_history')}</h1>
              {!loading && !loadError && counts.pending > 0 && (
                <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#C49A1E] px-2 text-[11px] font-black text-white shadow-sm">
                  {counts.pending}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-[#999] dark:text-[#5A5A4A]">{t('page_subtitle_history')}</p>
          </div>
          {!loading && counts.pending > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-[#C49A1E]/25 bg-[#C49A1E]/8 px-3.5 py-1.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C49A1E] opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C49A1E]" />
              </span>
              <span className="text-[11px] font-black uppercase tracking-wider text-[#C49A1E]">KYC</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        {!loading && !loadError && (
          <div className="flex flex-wrap gap-2">
            <TabPill label={t('tab_pending')}  count={counts.pending}  active={activeTab === 'pending'}  onClick={() => setActiveTab('pending')}  />
            <TabPill label={t('tab_approved')} count={counts.approved} active={activeTab === 'approved'} onClick={() => setActiveTab('approved')} />
            <TabPill label={t('tab_rejected')} count={counts.rejected} active={activeTab === 'rejected'} onClick={() => setActiveTab('rejected')} />
            <TabPill label={t('tab_all')}      count={counts.all}      active={activeTab === 'all'}      onClick={() => setActiveTab('all')}      />
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col gap-3 px-7 py-6">

        {/* Loading */}
        {loading && (
          <div className="flex flex-1 items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
          </div>
        )}

        {/* Error */}
        {!loading && loadError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
            <p className="text-[14px] font-semibold text-[#555] dark:text-[#B0B0A0]">{t('error_load')}</p>
            <button type="button" onClick={loadStations}
              className="rounded-xl border border-[#C49A1E]/50 px-4 py-2 text-[13px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/10">
              {t('btn_retry')}
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !loadError && filtered.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <p className="text-[15px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t(emptyKey)}</p>
          </div>
        )}

        {/* Cards */}
        {!loading && !loadError && filtered.map((s) => (
          <StationCard key={s.id} s={s} locale={locale} t={t} />
        ))}
      </div>
    </div>
  );
}

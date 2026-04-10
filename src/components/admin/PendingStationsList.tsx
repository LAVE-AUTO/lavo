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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string; border: string; barColor: string }> = {
  pending_admin_validation: {
    dot: '#C49A1E', bg: 'rgba(196,154,30,0.08)', text: '#C49A1E', border: 'rgba(196,154,30,0.2)', barColor: '#C49A1E',
  },
  active: {
    dot: '#00C851', bg: 'rgba(0,200,81,0.07)', text: '#00C851', border: 'rgba(0,200,81,0.2)', barColor: '#00C851',
  },
  rejected: {
    dot: '#EF4444', bg: 'rgba(239,68,68,0.07)', text: '#EF4444', border: 'rgba(239,68,68,0.2)', barColor: '#EF4444',
  },
  suspended: {
    dot: '#AAAAAA', bg: 'rgba(170,170,170,0.07)', text: '#888', border: 'rgba(170,170,170,0.2)', barColor: '#AAAAAA',
  },
};

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({
  label, count, active, color, onClick,
}: { label: string; count: number; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center gap-0.5 px-4 py-2.5 text-[12px] font-bold transition-colors duration-150 focus:outline-none"
      style={{ color: active ? (color ?? '#C49A1E') : undefined }}
    >
      <span className={active ? '' : 'text-[#888] dark:text-[#5A5A5A]'}>{label}</span>
      <span className={[
        'text-[18px] font-black leading-none',
        active ? '' : 'text-[#333] dark:text-[#B0B0A0]',
      ].join(' ')} style={{ color: active ? (color ?? '#C49A1E') : undefined }}>
        {count}
      </span>
      {/* Active underline */}
      <span className={[
        'absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full transition-opacity duration-150',
        active ? 'opacity-100' : 'opacity-0',
      ].join(' ')} style={{ background: color ?? '#C49A1E' }} />
    </button>
  );
}

// ─── Station card ─────────────────────────────────────────────────────────────

function StationCard({
  s, locale, t,
}: { s: ApiStation; locale: string; t: ReturnType<typeof useTranslations<'admin_stations'>> }) {
  const style     = STATUS_STYLES[s.status] ?? STATUS_STYLES['suspended'];
  const isPending = s.status === 'pending_admin_validation';
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
    <div className="group relative flex items-stretch overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.05] transition-all duration-200 hover:-translate-y-px hover:shadow-md hover:ring-black/[0.08] dark:bg-[#161F13] dark:ring-white/[0.06] dark:hover:ring-white/[0.10]">

      {/* Colored left bar — always visible */}
      <div className="w-[4px] shrink-0 rounded-l-2xl transition-all duration-200 group-hover:w-[5px]"
        style={{ background: style.barColor }} />

      {/* Card body */}
      <div className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4">

        {/* Avatar */}
        <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl text-[14px] font-black"
          style={{ background: style.bg, color: style.dot, boxShadow: `0 0 0 1px ${style.border}` }}>
          {initials(s.name)}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          {/* Name + badge */}
          <div className="flex items-center gap-2">
            <p className="truncate text-[14px] font-black text-[#0F1A0C] dark:text-[#F0EDD4]">{s.name}</p>
            <span className="shrink-0 rounded-[5px] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest"
              style={{ background: style.bg, color: style.dot }}>
              {statusLabel}
            </span>
          </div>

          {/* Location */}
          <p className="mt-0.5 truncate text-[11px] text-[#AAA] dark:text-[#555]">
            {[s.city, s.address].filter(Boolean).join(' · ')}
          </p>

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Date */}
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[#999] dark:text-[#A0A090]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-[#BBBB]">{datePrefixLabel}</span>
              {dateLabel}
            </span>

            {/* Separator */}
            {isPending && docCount > 0 && <span className="text-[#DDD] dark:text-[#9A9A8A]">·</span>}

            {/* Docs count */}
            {isPending && docCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-[#999] dark:text-[#A0A090]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                {docCount} doc{docCount > 1 ? 's' : ''}
              </span>
            )}

            {/* Rejection count */}
            {s.rejection_count > 0 && (
              <>
                <span className="text-[#DDD] dark:text-[#9A9A8A]">·</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#EF4444' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {t('label_rejection_count', { n: s.rejection_count })}
                </span>
              </>
            )}
          </div>

          {/* Rejection reason */}
          {isRejected && s.rejection_reason && (
            <p className="mt-2 line-clamp-1 rounded-[6px] bg-[#FEF2F2] px-2 py-1 text-[10px] italic leading-relaxed text-[#EF4444]/80 dark:bg-[#1E0A0A] dark:text-[#EF4444]/60">
              {s.rejection_reason}
            </p>
          )}
        </div>

        {/* CTA */}
        <Link
          href={`/admin/stations/${s.id}` as Parameters<typeof Link>[0]['href']}
          className="flex shrink-0 items-center gap-1.5 self-center rounded-[10px] px-3.5 py-2 text-[11px] font-bold text-white transition-opacity hover:opacity-80"
          style={{ background: style.dot }}
        >
          {t('btn_review')}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
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

  return (
    /* Outer: no scroll — header stays fixed, only body scrolls */
    <div className="flex h-full flex-col overflow-hidden bg-[#F5F5EE] dark:bg-[#0C1209]">

      {/* ── Sticky header ── */}
      <div className="shrink-0 border-b border-[#E8E4D8] bg-white dark:border-[#1A2A14] dark:bg-[#111A0E]">

        {/* Title row */}
        <div className="relative overflow-hidden px-7 pt-6 pb-0">
          <div className="pointer-events-none absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-[#C49A1E]/4 to-transparent" />
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[20px] font-black tracking-tight text-[#0F1A0C] dark:text-[#F0EDD4]">
                  {t('page_title_history')}
                </h1>
                {!loading && counts.pending > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C49A1E] px-1.5 text-[10px] font-black text-white">
                    {counts.pending}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-[#AAA] dark:text-[#A0A090]">
                {t('page_subtitle_history')}
              </p>
            </div>

            {/* Live KYC indicator */}
            {!loading && counts.pending > 0 && (
              <div className="flex items-center gap-2 rounded-full border border-[#C49A1E]/20 bg-[#C49A1E]/6 px-3 py-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C49A1E] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C49A1E]" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#C49A1E]">KYC</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-end border-b border-[#F0EDE0] px-5 dark:border-[#1A2A14]">
          {!loading && !loadError && (
            <>
              <TabButton label={t('tab_pending')}  count={counts.pending}  active={activeTab === 'pending'}  color="#C49A1E" onClick={() => setActiveTab('pending')}  />
              <TabButton label={t('tab_approved')} count={counts.approved} active={activeTab === 'approved'} color="#00C851" onClick={() => setActiveTab('approved')} />
              <TabButton label={t('tab_rejected')} count={counts.rejected} active={activeTab === 'rejected'} color="#EF4444" onClick={() => setActiveTab('rejected')} />
              <TabButton label={t('tab_all')}      count={counts.all}      active={activeTab === 'all'}      color="#C49A1E" onClick={() => setActiveTab('all')}      />
            </>
          )}
          {/* Skeleton tabs while loading */}
          {loading && (
            <div className="flex gap-1 py-2.5 px-2">
              {[80, 90, 80, 60].map((w, i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-[#F0EDE0] dark:bg-[#1A2416]" style={{ width: w }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex flex-1 flex-col overflow-y-auto">

        {/* Loading spinner */}
        {loading && (
          <div className="flex flex-1 items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
          </div>
        )}

        {/* Error */}
        {!loading && loadError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
            <p className="text-[13px] font-semibold text-[#888] dark:text-[#9A9A8A]">{t('error_load')}</p>
            <button type="button" onClick={loadStations}
              className="rounded-xl border border-[#C49A1E]/40 px-4 py-2 text-[12px] font-bold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/8">
              {t('btn_retry')}
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !loadError && filtered.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-[#1A2416] dark:ring-white/[0.06]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <p className="text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t(emptyKey)}</p>
          </div>
        )}

        {/* Cards list */}
        {!loading && !loadError && filtered.length > 0 && (
          <div className="flex flex-col gap-2.5 px-7 py-5">
            {filtered.map((s) => (
              <StationCard key={s.id} s={s} locale={locale} t={t} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

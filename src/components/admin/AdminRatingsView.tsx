'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi, patchWithApi } from '@/services/axios-service';
import { AdminPagination } from './ui/AdminPagination';

interface RatingItem {
  id: string;
  score: number;
  comment: string | null;
  is_visible: boolean;
  created_at: string;
  reservation_id: string;
  user:    { id: string; first_name: string; last_name: string };
  station: { id: string; name: string };
}

interface PaginationMeta {
  total:       number;
  page:        number;
  limit:       number;
  total_pages: number;
}

type VisibilityFilter = 'all' | 'visible' | 'hidden';
type ScoreFilter = 0 | 1 | 2 | 3 | 4 | 5;

const PER_PAGE = 20;

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function initials(first: string, last: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

function StarRow({ score, ariaLabel }: { score: number; ariaLabel: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={n <= score ? '#C49A1E' : 'none'}
            stroke="#C49A1E"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}

export function AdminRatingsView() {
  const t = useTranslations('admin_ratings');
  const { success: toastSuccess, error: toastError } = useToast();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [items, setItems]                       = useState<RatingItem[]>([]);
  const [meta, setMeta]                         = useState<PaginationMeta | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [loadError, setLoadError]               = useState(false);
  const [page, setPage]                         = useState(1);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [scoreFilter, setScoreFilter]           = useState<ScoreFilter>(0);
  const [stationSearch, setStationSearch]       = useState('');
  const [stationDebounced, setStationDebounced] = useState('');
  const [togglingId, setTogglingId]             = useState<string | null>(null);

  /* Debounce station search by 300 ms */
  useEffect(() => {
    const timer = setTimeout(() => setStationDebounced(stationSearch), 300);
    return () => clearTimeout(timer);
  }, [stationSearch]);

  const loadData = useCallback(async (p: number, vis: VisibilityFilter, sc: ScoreFilter, station: string) => {
    setLoading(true);
    setLoadError(false);

    const params = new URLSearchParams({ page: String(p), limit: String(PER_PAGE) });
    if (vis !== 'all') params.set('is_visible', vis === 'visible' ? 'true' : 'false');
    if (sc > 0) { params.set('score_min', String(sc)); params.set('score_max', String(sc)); }
    if (station.trim()) params.set('station_name', station.trim());

    const [ok, data] = await getFromApi(`/admin/ratings?${params.toString()}`);
    if (!mountedRef.current) return;

    if (!ok) { setLoadError(true); setLoading(false); return; }

    const payload = (data as { data: { items: RatingItem[]; meta: PaginationMeta } }).data;
    setItems(payload.items ?? []);
    setMeta(payload.meta ?? null);
    setPage(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(1, visibilityFilter, scoreFilter, stationDebounced);
  }, [visibilityFilter, scoreFilter, stationDebounced, loadData]);

  async function handleToggle(item: RatingItem) {
    if (togglingId === item.id) return;
    setTogglingId(item.id);
    const newVisible = !item.is_visible;
    const [ok] = await patchWithApi(`/admin/ratings/${item.id}`, { is_visible: newVisible });
    if (!mountedRef.current) return;
    setTogglingId(null);
    if (ok) {
      setItems((prev) => prev.map((r) => r.id === item.id ? { ...r, is_visible: newVisible } : r));
      toastSuccess(newVisible ? t('badge_visible') : t('badge_hidden'));
    } else {
      toastError(t('toggle_error'));
    }
  }

  const SCORE_FILTERS: { value: ScoreFilter; label: string }[] = [
    { value: 0, label: t('filter_all') },
    { value: 5, label: t('filter_5stars') },
    { value: 4, label: t('filter_4stars') },
    { value: 3, label: t('filter_3stars') },
    { value: 2, label: t('filter_2stars') },
    { value: 1, label: t('filter_1star') },
  ];

  const VIS_FILTERS: { value: VisibilityFilter; label: string }[] = [
    { value: 'all',     label: t('filter_all') },
    { value: 'visible', label: t('filter_visible') },
    { value: 'hidden',  label: t('filter_hidden') },
  ];

  const stats = useMemo(() => {
    const totalScore   = items.reduce((s, r) => s + r.score, 0);
    const avg          = items.length ? totalScore / items.length : 0;
    const visibleCount = items.filter((r) => r.is_visible).length;
    const hiddenCount  = items.length - visibleCount;
    return { avg, visibleCount, hiddenCount };
  }, [items]);

  const metrics = [
    { label: t('metric_total'),  value: loading ? '…' : String(meta?.total ?? 0),               accent: '#C49A1E' },
    { label: t('metric_avg'),    value: loading || items.length === 0 ? '…' : `${stats.avg.toFixed(1)}/5`, accent: '#22C55E' },
    { label: t('metric_visible'),value: loading ? '…' : String(stats.visibleCount),             accent: '#3B82F6' },
    { label: t('metric_hidden'), value: loading ? '…' : String(stats.hiddenCount),              accent: '#94A3B8' },
  ];

  const pillCls = (active: boolean) => [
    'rounded-[14px] px-3.5 py-2 text-[12.5px] font-bold transition-colors duration-150',
    active
      ? 'bg-[#1A1A0A] text-[#F0EDD4] shadow-[0_10px_20px_rgba(26,26,10,0.18)] dark:bg-[#F0EDD4] dark:text-[#1A1A0A]'
      : 'text-[#847E70] hover:bg-[#EFE8D7] hover:text-[#1A1A0A] dark:text-[#A0A090] dark:hover:bg-[#182214] dark:hover:text-[#F0EDD4]',
  ].join(' ');

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_36%),linear-gradient(180deg,#faf8f2_0%,#f2efe7_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_32%),linear-gradient(180deg,#0C1209_0%,#091009_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col gap-5 overflow-y-auto scrollbar-none px-3 py-4 sm:px-4 lg:px-6 lg:py-6">

        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.08)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#C49A1E]/18 bg-[#C49A1E]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#9A7A13] dark:border-[#C49A1E]/25 dark:bg-[#C49A1E]/12 dark:text-[#F0D98C]">
                {t('badge_moderation')}
              </span>
              <h1 className="mt-4 text-[clamp(28px,3vw,42px)] font-black leading-[1.04] text-[#1A1A0A] dark:text-[#F0EDD4]">
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
                    <div className="mt-3 text-[28px] font-black leading-none text-[#1A1A0A] dark:text-[#F0EDD4]">{metric.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="mt-5 flex flex-col gap-3 rounded-[24px] border border-[#E7E1D5] bg-[#F8F6F1]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur dark:border-[#1E2E18] dark:bg-[#0C150B]/85">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex flex-wrap gap-1.5 rounded-[18px] bg-white/65 p-1.5 dark:bg-[#111A0E]/80">
                {VIS_FILTERS.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => setVisibilityFilter(value)} className={pillCls(visibilityFilter === value)}>
                    {label}
                  </button>
                ))}
              </div>

              <label className="relative w-full max-w-[320px]">
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#BBB6A7]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                <input
                  type="text"
                  value={stationSearch}
                  onChange={(e) => setStationSearch(e.target.value)}
                  placeholder={t('search_station_placeholder')}
                  className="w-full rounded-[16px] border border-[#D8D4C8] bg-white/95 py-2.5 pl-9 pr-9 text-[13px] font-medium text-[#1A1A0A] outline-none transition-all focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] focus:ring-0 dark:border-[#243020] dark:bg-[#0D170B] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]"
                />
                {stationSearch && (
                  <button type="button" onClick={() => setStationSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#BBBBAA] hover:text-[#666] dark:hover:text-[#CCC]"
                    aria-label={t('search_clear')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SCORE_FILTERS.map((sf) => (
                <button key={sf.value} type="button" onClick={() => setScoreFilter(sf.value)} className={pillCls(scoreFilter === sf.value)}>
                  {sf.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-1 min-h-0 flex-col gap-4 rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.07)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">

          {loading && (
            <div className="flex flex-1 items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
            </div>
          )}

          {!loading && loadError && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-[14px] font-semibold text-[#888] dark:text-[#A0A090]">{t('error_load')}</p>
              <button
                type="button"
                onClick={() => loadData(page, visibilityFilter, scoreFilter, stationDebounced)}
                className="rounded-xl border border-[#C49A1E]/40 px-4 py-2 text-[13px] font-bold text-[#C49A1E] hover:bg-[#C49A1E]/8 transition-colors"
              >
                {t('btn_retry')}
              </button>
            </div>
          )}

          {!loading && !loadError && items.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EDE6] dark:bg-[#1A2A14]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <p className="text-[14px] font-semibold text-[#9B9588] dark:text-[#7E8A75]">{t('no_results')}</p>
            </div>
          )}

          {!loading && !loadError && items.length > 0 && (
            <div className="overflow-hidden rounded-[18px] border border-[#E8E3D7] bg-white shadow-[0_4px_12px_rgba(26,26,10,0.04)] dark:border-[#1E2E18] dark:bg-[#0E170C]">
              <div className="hidden md:grid grid-cols-[1.4fr_1fr_120px_2fr_120px_130px_120px] gap-4 border-b border-[#E9E4D8] bg-[#FCFBF8] px-5 py-3 dark:border-[#1E2E18] dark:bg-[#0D150B]">
                {[t('col_station'), t('col_client'), t('col_score'), t('col_comment'), t('col_date'), t('col_visibility'), ''].map((h, i) => (
                  <span key={i} className="text-[11px] font-black uppercase tracking-[0.18em] text-[#AAA395] dark:text-[#8F998A]">{h}</span>
                ))}
              </div>

              <div className="divide-y divide-[#F2EFE8] dark:divide-[#1A2A14]">
                {items.map((item) => {
                  const isToggling = togglingId === item.id;
                  return (
                    <div key={item.id} className="block md:grid md:grid-cols-[1.4fr_1fr_120px_2fr_120px_130px_120px] md:items-center md:gap-4 p-4 md:px-5 md:py-4 transition-colors hover:bg-[#FCFBF6] dark:hover:bg-[#161F12]">

                      {/* Station */}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{item.station.name}</p>
                        <p className="mt-0.5 text-[11px] text-[#A8A293] dark:text-[#7E8A75] md:hidden">{formatDate(item.created_at)}</p>
                      </div>

                      {/* Client */}
                      <div className="mt-2 flex items-center gap-2 md:mt-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-[#1A1A0A]/5 text-[10.5px] font-black text-[#1A1A0A] ring-1 ring-inset ring-[#1A1A0A]/8 dark:bg-[#F0EDD4]/8 dark:text-[#F0EDD4] dark:ring-[#F0EDD4]/10">
                          {initials(item.user.first_name, item.user.last_name)}
                        </div>
                        <p className="truncate text-[12.5px] text-[#5A554B] dark:text-[#A6A091]">{item.user.first_name} {item.user.last_name}</p>
                      </div>

                      {/* Score */}
                      <div className="mt-2 md:mt-0">
                        <StarRow score={item.score} ariaLabel={t('star_row_label', { score: item.score })} />
                      </div>

                      {/* Comment */}
                      <div className="mt-2 md:mt-0">
                        {item.comment
                          ? <p className="line-clamp-2 text-[12.5px] leading-snug text-[#5A554B] dark:text-[#A6A091]">{item.comment}</p>
                          : <p className="italic text-[12px] text-[#BBB6A7] dark:text-[#7E8A75]">{t('no_comment')}</p>}
                      </div>

                      {/* Date (desktop) */}
                      <p className="hidden whitespace-nowrap text-[12.5px] text-[#A8A293] dark:text-[#A0A090] md:block">{formatDate(item.created_at)}</p>

                      {/* Visibility */}
                      <div className="mt-2 md:mt-0">
                        <span className={[
                          'inline-flex items-center gap-1.5 rounded-full bg-[#F4F1E8] px-2.5 py-1 text-[11.5px] font-bold dark:bg-[#171F12]',
                          item.is_visible
                            ? 'text-[#166534] dark:text-[#86EFAC]'
                            : 'text-[#9F1239] dark:text-[#FDA4AF]',
                        ].join(' ')}>
                          <span className={`h-1.5 w-1.5 rounded-full ${item.is_visible ? 'bg-[#22C55E]' : 'bg-[#F43F5E]'}`} />
                          {item.is_visible ? t('badge_visible') : t('badge_hidden')}
                        </span>
                      </div>

                      {/* Action */}
                      <div className="mt-3 md:mt-0 md:text-right">
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => handleToggle(item)}
                          className="inline-flex items-center gap-1 rounded-[12px] border border-[#E1DBCF] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#5A554B] transition-all hover:border-[#C49A1E]/40 hover:bg-[#FCF6E5] hover:text-[#9A7A13] disabled:cursor-wait disabled:opacity-50 dark:border-[#1E2E18] dark:bg-[#0E170C] dark:text-[#A6A091] dark:hover:bg-[#1A2410] dark:hover:text-[#F0D98C]"
                        >
                          {isToggling
                            ? t('toggling')
                            : item.is_visible ? t('btn_hide') : t('btn_show')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {meta && (
            <AdminPagination
              page={page}
              totalPages={meta.total_pages}
              total={meta.total}
              perPage={PER_PAGE}
              onPageChange={(p) => loadData(p, visibilityFilter, scoreFilter, stationDebounced)}
              loading={loading}
            />
          )}
        </section>
      </div>
    </div>
  );
}

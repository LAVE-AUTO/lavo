'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/context/toast-context';
import { getFromApi, patchWithApi } from '@/services/axios-service';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

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
  total: number;
  page:  number;
  limit: number;
}

type VisibilityFilter = 'all' | 'visible' | 'hidden';
type ScoreFilter = 0 | 1 | 2 | 3 | 4 | 5;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function StarRow({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${score} étoiles`}>
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

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

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
  const [togglingId, setTogglingId]             = useState<string | null>(null);

  const loadData = useCallback(async (p: number, vis: VisibilityFilter, sc: ScoreFilter) => {
    setLoading(true);
    setLoadError(false);

    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (vis !== 'all') params.set('is_visible', vis === 'visible' ? 'true' : 'false');
    if (sc > 0) { params.set('score_min', String(sc)); params.set('score_max', String(sc)); }

    const [ok, data] = await getFromApi(`/admin/ratings?${params.toString()}`);
    if (!mountedRef.current) return;

    if (!ok) { setLoadError(true); setLoading(false); return; }

    const payload = (data as { data: { items: RatingItem[]; meta: PaginationMeta } }).data;
    setItems(payload.items ?? []);
    setMeta(payload.meta ?? null);
    setPage(p);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(1, visibilityFilter, scoreFilter); }, [visibilityFilter, scoreFilter, loadData]);

  async function handleToggle(item: RatingItem) {
    if (togglingId) return;
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

  /* ---- Score filter pills ---- */
  const SCORE_FILTERS: { value: ScoreFilter; label: string }[] = [
    { value: 0, label: t('filter_all') },
    { value: 5, label: t('filter_5stars') },
    { value: 4, label: t('filter_4stars') },
    { value: 3, label: t('filter_3stars') },
    { value: 2, label: t('filter_2stars') },
    { value: 1, label: t('filter_1star') },
  ];

  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;

  return (
    <div className="flex min-h-full flex-col">

      {/* Header */}
      <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 py-5 dark:border-[#1A2A14] dark:bg-[#0C1209]">
        <h1 className="text-[22px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
        <p className="mt-1 text-[13px] text-[#888] dark:text-[#5A5A4A]">{t('page_subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-[#E0DCD0] bg-[#FAFAF5] px-6 py-3 dark:border-[#1A2A14] dark:bg-[#0A1208]">

        {/* Visibility toggle */}
        {(['all', 'visible', 'hidden'] as VisibilityFilter[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVisibilityFilter(v)}
            className={[
              'rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors',
              visibilityFilter === v
                ? 'bg-[#C49A1E] text-[#0C1209]'
                : 'bg-[#F0EDE6] text-[#666] hover:bg-[#E8E4DC] dark:bg-[#1A2A14] dark:text-[#9A9A8A] dark:hover:bg-[#1E2E18]',
            ].join(' ')}
          >
            {v === 'all' ? t('filter_all') : v === 'visible' ? t('filter_visible') : t('filter_hidden')}
          </button>
        ))}

        <div className="h-4 w-px bg-[#D8D4CC] dark:bg-[#1A2A14]" />

        {/* Score pills */}
        {SCORE_FILTERS.map((sf) => (
          <button
            key={sf.value}
            type="button"
            onClick={() => setScoreFilter(sf.value)}
            className={[
              'rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors',
              scoreFilter === sf.value
                ? 'bg-[#1A1A0A] text-[#F0EDD4] dark:bg-[#F0EDD4] dark:text-[#0C1209]'
                : 'bg-[#F0EDE6] text-[#666] hover:bg-[#E8E4DC] dark:bg-[#1A2A14] dark:text-[#9A9A8A] dark:hover:bg-[#1E2E18]',
            ].join(' ')}
          >
            {sf.label}
          </button>
        ))}

        {meta && (
          <span className="ml-auto text-[12px] text-[#AAA] dark:text-[#5A5A4A]">
            {t('meta_total', { count: meta.total })}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">

        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C49A1E] border-t-transparent" />
          </div>
        )}

        {!loading && loadError && (
          <div className="flex flex-col items-center gap-3 py-20">
            <p className="text-[14px] text-[#888] dark:text-[#5A5A4A]">{t('error_load')}</p>
            <button
              type="button"
              onClick={() => loadData(page, visibilityFilter, scoreFilter)}
              className="rounded-lg border border-[#C49A1E]/50 px-4 py-2 text-[13px] font-semibold text-[#C49A1E] hover:bg-[#C49A1E]/10 transition-colors"
            >
              {t('btn_retry')}
            </button>
          </div>
        )}

        {!loading && !loadError && items.length === 0 && (
          <div className="flex justify-center py-20">
            <p className="text-[14px] text-[#AAA] dark:text-[#5A5A4A]">{t('no_results')}</p>
          </div>
        )}

        {!loading && !loadError && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-[#E0DCD0] dark:border-[#1A2A14]">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#E0DCD0] bg-[#F5F5EE] dark:border-[#1A2A14] dark:bg-[#0E1A0C]">
                  {[t('col_station'), t('col_client'), t('col_score'), t('col_comment'), t('col_date'), t('col_visibility'), ''].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={[
                      'border-b border-[#E8E4DC] transition-colors dark:border-[#1E2E18]',
                      idx % 2 === 0 ? 'bg-white dark:bg-[#0C1209]' : 'bg-[#FAFAF5] dark:bg-[#0A1208]',
                    ].join(' ')}
                  >
                    {/* Station */}
                    <td className="px-4 py-3 font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">
                      {item.station.name}
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3 text-[#555] dark:text-[#9A9A8A]">
                      {item.user.first_name} {item.user.last_name}
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3">
                      <StarRow score={item.score} />
                    </td>

                    {/* Comment */}
                    <td className="max-w-[220px] px-4 py-3 text-[#666] dark:text-[#7A7A6A]">
                      {item.comment
                        ? <span className="line-clamp-2 leading-relaxed">{item.comment}</span>
                        : <span className="italic text-[#BBB] dark:text-[#4A4A3A]">{t('no_comment')}</span>
                      }
                    </td>

                    {/* Date */}
                    <td className="whitespace-nowrap px-4 py-3 text-[#999] dark:text-[#5A5A4A]">
                      {formatDate(item.created_at)}
                    </td>

                    {/* Visibility badge */}
                    <td className="px-4 py-3">
                      <span className={[
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                        item.is_visible
                          ? 'bg-[#F0FDF4] text-[#15803D] ring-1 ring-[#22C55E]/20 dark:bg-[#0A2010] dark:text-[#4ADE80]'
                          : 'bg-[#FFF1F2] text-[#BE123C] ring-1 ring-[#FB7185]/20 dark:bg-[#200A10] dark:text-[#F87171]',
                      ].join(' ')}>
                        <span className={`h-1.5 w-1.5 rounded-full ${item.is_visible ? 'bg-[#22C55E]' : 'bg-[#F43F5E]'}`} />
                        {item.is_visible ? t('badge_visible') : t('badge_hidden')}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={togglingId === item.id}
                        onClick={() => handleToggle(item)}
                        className={[
                          'rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all',
                          togglingId === item.id
                            ? 'cursor-wait opacity-50'
                            : item.is_visible
                              ? 'bg-[#FFF1F2] text-[#BE123C] hover:bg-[#FFE4E6] dark:bg-[#200A10] dark:text-[#F87171] dark:hover:bg-[#2A0E14]'
                              : 'bg-[#F0FDF4] text-[#15803D] hover:bg-[#DCFCE7] dark:bg-[#0A2010] dark:text-[#4ADE80] dark:hover:bg-[#0D2A16]',
                        ].join(' ')}
                      >
                        {togglingId === item.id
                          ? t('toggling')
                          : item.is_visible ? t('btn_hide') : t('btn_show')
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !loadError && totalPages > 1 && (
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              aria-label="Page précédente"
              disabled={page === 1}
              onClick={() => loadData(page - 1, visibilityFilter, scoreFilter)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D8D4CC] text-[#888] transition-colors hover:border-[#C49A1E] hover:text-[#C49A1E] disabled:opacity-40 dark:border-[#1A2A14] dark:text-[#5A5A4A]"
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => loadData(p, visibilityFilter, scoreFilter)}
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-bold transition-colors',
                  p === page
                    ? 'bg-[#C49A1E] text-[#0C1209]'
                    : 'border border-[#D8D4CC] text-[#888] hover:border-[#C49A1E] hover:text-[#C49A1E] dark:border-[#1A2A14] dark:text-[#5A5A4A]',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              aria-label="Page suivante"
              disabled={page === totalPages}
              onClick={() => loadData(page + 1, visibilityFilter, scoreFilter)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D8D4CC] text-[#888] transition-colors hover:border-[#C49A1E] hover:text-[#C49A1E] disabled:opacity-40 dark:border-[#1A2A14] dark:text-[#5A5A4A]"
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

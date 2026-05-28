'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

/**
 * Builds a windowed page list: 1 … (p-1) p (p+1) … N.
 * Always shows first + last; trims to 7 visible slots max.
 */
function buildPageWindow(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const items: Array<number | 'ellipsis'> = [1];

  const left  = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);

  if (left > 2) items.push('ellipsis');
  for (let p = left; p <= right; p++) items.push(p);
  if (right < totalPages - 1) items.push('ellipsis');

  items.push(totalPages);
  return items;
}

export function AdminPagination({ page, totalPages, total, perPage, onPageChange, loading }: Props) {
  const t = useTranslations('admin_pagination');

  const window = useMemo(() => buildPageWindow(page, totalPages), [page, totalPages]);

  if (totalPages <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total);
  const disabled = !!loading;

  const navBtn = [
    'flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#E1DBCF] bg-white text-[#5A554B]',
    'transition-all duration-150',
    'hover:border-[#DDAF3B]/40 hover:bg-[#FCF6E5] hover:text-[#9A7A13]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAF3B]/40',
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E1DBCF] disabled:hover:bg-white disabled:hover:text-[#5A554B]',
    'dark:border-[#1E2E18] dark:bg-[#0E170C] dark:text-[#A6A091]',
    'dark:hover:border-[#DDAF3B]/30 dark:hover:bg-[#1A2410] dark:hover:text-[#F0D98C]',
  ].join(' ');

  const pageBtn = (isActive: boolean) => [
    'min-w-[36px] h-9 px-2 rounded-[12px] text-[12.5px] font-bold transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAF3B]/40',
    isActive
      ? 'bg-dark-bg text-[#FFF9EC] shadow-[0_8px_18px_rgba(26,26,10,0.18)] dark:bg-[#FFF9EC] dark:text-[#001201]'
      : 'border border-[#E1DBCF] bg-white text-[#5A554B] hover:border-[#DDAF3B]/40 hover:bg-[#FCF6E5] hover:text-[#9A7A13] dark:border-[#1E2E18] dark:bg-[#0E170C] dark:text-[#A6A091] dark:hover:border-[#DDAF3B]/30 dark:hover:bg-[#1A2410] dark:hover:text-[#F0D98C]',
  ].join(' ');

  return (
    <nav
      className="flex flex-col gap-3 rounded-[18px] border border-[#E7E1D5] bg-[#FCFBF8]/85 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-[#1E2E18] dark:bg-[#0C150B]/80"
      aria-label={t('aria_label')}
    >
      <p className="text-[12px] font-semibold text-[#7E796B] dark:text-[#B0BFB1]">
        {t('range', { from, to, total })}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-label={t('first')}
          onClick={() => onPageChange(1)}
          disabled={disabled || page <= 1}
          className={navBtn}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={t('previous')}
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
          className={navBtn}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="flex items-center gap-1">
          {window.map((item, idx) =>
            item === 'ellipsis' ? (
              <span key={`e${idx}`} className="px-1 text-[12px] font-bold text-[#BBB6A7] dark:text-[#7E8A75]" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                disabled={disabled}
                aria-current={item === page ? 'page' : undefined}
                aria-label={t('page_n', { n: item })}
                className={pageBtn(item === page)}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          aria-label={t('next')}
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= totalPages}
          className={navBtn}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={t('last')}
          onClick={() => onPageChange(totalPages)}
          disabled={disabled || page >= totalPages}
          className={navBtn}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

'use client';

import { useTranslations, useLocale } from 'next-intl';
import { groupBlocks, formatDates } from './blocks-helpers';
import type { AvailabilityBlock } from './types';

interface Props {
  blocks: AvailabilityBlock[];
  onDelete: (ids: string[]) => void;
  onEdit: (block: AvailabilityBlock) => void;
  onCreateClick: () => void;
}

export function BlocksPanel({ blocks, onDelete, onEdit, onCreateClick }: Props) {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();

  function formatBays(bayIds: string[]): string {
    if (bayIds.length === 0 || bayIds.includes('all')) return t('availability_all_postes_short');
    return bayIds.map((b) => `${t('availability_poste_short')}${b}`).join(', ');
  }

  const grouped = groupBlocks(blocks);

  return (
    <div className="flex w-full shrink-0 flex-col border-b border-[#DDAF3B]/20 bg-[#F0EDE0] dark:border-[#DDAF3B]/10 dark:bg-[#1A2210] md:w-72 md:border-b-0 md:border-r">
      {/* Title */}
      <div className="px-4 pt-5 pb-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/65 dark:text-[#B0BFB1]">
          {t('availability_blocks_title')}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-card-surface/60 px-4 py-10 text-center dark:bg-[#001A05]/60">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="mb-2 text-[#B0BFB1]"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <p className="text-xs text-foreground/65 dark:text-[#B0BFB1]">
              {t('availability_block_no_blocks')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {grouped.map((group) => (
              <div
                key={(group.ids ?? [group.id]).join('|')}
                className="rounded-xl border border-separator/25 bg-card-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:bg-[#001A05]"
              >
                {/* Postes badge */}
                <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#DDAF3B]/15 px-3 py-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#DDAF3B]">
                    {t('availability_block_postes')}
                  </span>
                  <span className="text-[11px] font-bold text-[#001201] dark:text-[#FFF9EC]">
                    {formatBays(group.bayIds)}
                  </span>
                </div>

                {/* Condensed date ranges */}
                <p className="mb-1 text-[13px] font-bold leading-snug text-[#001201] dark:text-[#FFF9EC]">
                  {formatDates(group.dates, locale)}
                </p>

                {/* Time range — large and prominent */}
                <p className="mb-3 text-[20px] font-black leading-tight text-[#DDAF3B]">
                  {group.startTime} – {group.endTime}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDelete(group.ids ?? [group.id])}
                    className="cursor-pointer inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#FF2525] bg-transparent px-3 py-1.5 text-[11px] font-bold text-[#FF2525] transition-colors hover:bg-[#FF2525]/10"
                    aria-label={`${t('availability_block_delete')} - ${formatDates(group.dates, locale)}`}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    {t('availability_block_delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(group)}
                    className="cursor-pointer inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#DDAF3B] px-3 py-1.5 text-[11px] font-bold text-[#001201] transition-colors hover:bg-[#A07818]"
                    aria-label={`${t('availability_block_edit')} - ${formatDates(group.dates, locale)}`}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    {t('availability_block_edit')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create button pinned to bottom */}
      <div className="border-t border-[#DDAF3B]/20 p-3 dark:border-[#DDAF3B]/10">
        <button
          type="button"
          onClick={onCreateClick}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#DDAF3B] px-4 py-3 text-sm font-black text-[#001201] transition-colors hover:bg-[#A07818] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAF3B] focus-visible:ring-offset-2"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('availability_create_block')}
        </button>
      </div>
    </div>
  );
}

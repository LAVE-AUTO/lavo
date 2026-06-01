'use client';

import { useTranslations } from 'next-intl';
import type { AvailabilityBlock } from './types';

interface Props {
  blocks: AvailabilityBlock[];
  onDelete: (id: string) => void;
  onEdit: (block: AvailabilityBlock) => void;
  onCreateClick: () => void;
}

/** Group consecutive ISO dates into ranges, then format the ranges compactly.
 *  e.g. ["2026-02-10","2026-02-11","2026-02-15","2026-03-01","2026-03-02"]
 *       → "10-11 févr. & 15 févr. & 1-2 mars 2026"
 */
function formatDates(dates: string[]): string {
  if (dates.length === 0) return '';

  const sorted = [...dates].sort();

  // Build consecutive ranges
  const ranges: { start: string; end: string }[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(rangeEnd + 'T00:00:00');
    const curr = new Date(sorted[i] + 'T00:00:00');
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      rangeEnd = sorted[i];
    } else {
      ranges.push({ start: rangeStart, end: rangeEnd });
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }
  ranges.push({ start: rangeStart, end: rangeEnd });

  // Format each range
  const year = new Date(sorted[sorted.length - 1] + 'T00:00:00').getFullYear();

  const parts = ranges.map(({ start, end }) => {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    const sDay = s.getDate();
    const eDay = e.getDate();
    const sMonth = s.toLocaleDateString('fr-FR', { month: 'short' });
    const eMonth = e.toLocaleDateString('fr-FR', { month: 'short' });

    if (start === end) {
      return `${sDay} ${sMonth}`;
    }
    if (sMonth === eMonth) {
      return `${sDay}-${eDay} ${sMonth}`;
    }
    return `${sDay} ${sMonth}-${eDay} ${eMonth}`;
  });

  return `${parts.join(' & ')} ${year}`;
}

export function BlocksPanel({ blocks, onDelete, onEdit, onCreateClick }: Props) {
  const t = useTranslations('station_dashboard');

  function formatBays(bayIds: string[]): string {
    if (bayIds.length === 0 || bayIds.includes('all')) return t('availability_all_postes_short');
    return bayIds.map((b) => `${t('availability_poste_short')}${b}`).join(', ');
  }

  return (
    <div className="flex w-full max-h-72 shrink-0 flex-col border-b border-[#DDAF3B]/20 bg-[#F0EDE0] dark:border-[#DDAF3B]/10 dark:bg-[#1A2210] md:max-h-none md:w-72 md:border-b-0 md:border-r">
      {/* Title */}
      <div className="px-4 pt-5 pb-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/65 dark:text-[#B0BFB1]">
          {t('availability_blocks_title')}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-white/60 px-4 py-10 text-center dark:bg-[#001A05]/60">
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
            {blocks.map((block) => (
              <div
                key={block.id}
                className="rounded-xl bg-white p-3 shadow-sm dark:bg-[#001A05]"
              >
                {/* Postes badge */}
                <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-[#DDAF3B]/15 px-2.5 py-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#DDAF3B]">
                    {t('availability_block_postes')}
                  </span>
                  <span className="text-[10px] font-bold text-[#001201] dark:text-[#FFF9EC]">
                    {formatBays(block.bayIds)}
                  </span>
                </div>

                {/* Condensed date ranges */}
                <p className="mb-1 text-[12px] font-bold leading-snug text-[#001201] dark:text-[#FFF9EC]">
                  {formatDates(block.dates)}
                </p>

                {/* Time range */}
                <p className="mb-2.5 text-[13px] font-black text-[#DDAF3B]">
                  {block.startTime} – {block.endTime}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDelete(block.id)}
                    className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-[#FF2525] bg-transparent px-2.5 py-1 text-[10px] font-bold text-[#FF2525] transition-colors hover:bg-[#FF2525]/10"
                    aria-label={`${t('availability_block_delete')} - ${formatDates(block.dates)}`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    {t('availability_block_delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(block)}
                    className="cursor-pointer inline-flex items-center gap-1 rounded-lg bg-[#DDAF3B] px-2.5 py-1 text-[10px] font-bold text-[#001201] transition-colors hover:bg-[#A07818]"
                    aria-label={`${t('availability_block_edit')} - ${formatDates(block.dates)}`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
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

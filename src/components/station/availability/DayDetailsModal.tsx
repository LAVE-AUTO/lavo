'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import type { AvailabilityBlock } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  date: string | null; // ISO: "2026-02-10"
  blocks: AvailabilityBlock[];
  onDeleteBlock: (id: string) => void;
  onEditBlock: (block: AvailabilityBlock) => void;
  onCreateForDay: (dateISO: string) => void;
}

function formatBays(bayIds: string[]): string {
  if (bayIds.length === 0 || bayIds.includes('all')) return 'Tous les postes';
  return `Poste${bayIds.length > 1 ? 's' : ''} ${bayIds.join(', ')}`;
}

export function DayDetailsModal({
  isOpen,
  onClose,
  date,
  blocks,
  onDeleteBlock,
  onEditBlock,
  onCreateForDay,
}: Props) {
  const t = useTranslations('station_dashboard');

  const displayDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('availability_day_details_title')} — ${displayDate}`}
    >
      <div className="p-5">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-[#F0EDE0] py-8 text-center dark:bg-[#1E2A1A]">
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
              className="mb-2 text-[#A0A090]"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <p className="mb-4 text-sm text-[#666] dark:text-[#A0A090]">
              {t('availability_day_no_blocks')}
            </p>
            {date && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCreateForDay(date);
                }}
                className="cursor-pointer rounded-xl bg-[#C09A18] px-4 py-2.5 text-sm font-bold text-[#1A1A0A] transition-colors hover:bg-[#a8861a]"
              >
                {t('availability_day_create_for_day')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="rounded-xl border-l-4 border-[#C09A18] bg-[#F0EDE0] p-4 dark:bg-[#1E2A1A]"
              >
                <p className="mb-0.5 text-[11px] font-semibold text-[#666] dark:text-[#A0A090]">
                  {formatBays(block.bayIds)}
                </p>
                <p className="mb-2 text-[15px] font-black text-[#C09A18]">
                  {block.startTime} – {block.endTime}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDeleteBlock(block.id)}
                    className="cursor-pointer rounded-lg border border-[#FF2525] bg-transparent px-3 py-1.5 text-[11px] font-bold text-[#FF2525] transition-colors hover:bg-[#FF2525]/10"
                  >
                    {t('availability_block_delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditBlock(block);
                    }}
                    className="cursor-pointer rounded-lg bg-[#C09A18] px-3 py-1.5 text-[11px] font-bold text-[#1A1A0A] transition-colors hover:bg-[#a8861a]"
                  >
                    {t('availability_block_edit')}
                  </button>
                </div>
              </div>
            ))}

            {date && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCreateForDay(date);
                }}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#C09A18]/40 py-3 text-sm font-semibold text-[#C09A18] transition-colors hover:bg-[#C09A18]/10"
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
                {t('availability_day_create_for_day')}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

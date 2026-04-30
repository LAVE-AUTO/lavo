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
      open={isOpen}
      onClose={onClose}
      title={`${t('availability_day_details_title')} ${displayDate}`}
      size="xl"
    >
      <div className="p-5">
        {/* Section label */}
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#C09A18]">
          {t('availability_day_blocks_section')}
        </p>

        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="mb-1 text-sm font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
              {t('availability_day_no_blocks')}
            </p>
            <p className="mb-4 text-[11px] text-[#666] dark:text-[#A0A090]">
              Tous les postes sont fermés
            </p>
            {/* Tip card — matches prototype gold-border callout */}
            <div className="mb-5 w-full rounded-lg border-l-4 border-[#C09A18] bg-[#C09A18]/10 p-3 text-left dark:bg-[#C09A18]/8">
              <p className="text-[11px] text-[#666] dark:text-[#A0A090]">
                <strong className="text-[#C09A18]">Astuce :</strong>{' '}
                {t('availability_day_no_blocks_tip')}
              </p>
            </div>
          </div>
        ) : (
          /* 2-column grid matching prototype */
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="rounded-xl bg-[#EDE9CC] p-3 dark:bg-[#1E2A1A]"
              >
                <p className="mb-1 text-[11px] font-semibold text-[#555] dark:text-[#A0A090]">
                  {formatBays(block.bayIds)}
                </p>
                <p className="mb-0.5 text-[12px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
                  {block.dates.length > 1 ? `${block.dates.length} dates` : ''}
                </p>
                <p className="mb-2.5 text-[13px] font-black text-[#C09A18]">
                  {block.startTime} – {block.endTime}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDeleteBlock(block.id)}
                    className="cursor-pointer rounded-md border border-[#FF2525] bg-transparent px-2.5 py-1 text-[10px] font-bold text-[#FF2525] transition-colors hover:bg-[#FF2525]/10"
                  >
                    {t('availability_block_delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditBlock(block);
                    }}
                    className="cursor-pointer rounded-md bg-[#C09A18] px-2.5 py-1 text-[10px] font-bold text-[#1A1A0A] transition-colors hover:bg-[#a8861a]"
                  >
                    {t('availability_block_edit')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer CTA */}
        {date && (
          <div className="flex justify-end gap-3 border-t border-[#C09A18]/20 pt-4 dark:border-[#C09A18]/10">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-[#C09A18]/30 px-4 py-2.5 text-sm font-bold text-[#666] transition-colors hover:bg-[#C09A18]/10 dark:text-[#A0A090]"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateForDay(date);
              }}
              className="cursor-pointer rounded-xl bg-[#C09A18] px-4 py-2.5 text-sm font-black text-[#1A1A0A] transition-colors hover:bg-[#a8861a]"
            >
              + {t('availability_day_create_for_day')}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

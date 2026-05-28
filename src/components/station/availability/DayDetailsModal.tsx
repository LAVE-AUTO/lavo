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

  function formatBays(bayIds: string[]): string {
    if (bayIds.length === 0 || bayIds.includes('all')) return t('availability_block_all_postes');
    return `${t('availability_modal_poste')}${bayIds.length > 1 ? 's' : ''} ${bayIds.join(', ')}`;
  }

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
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#DDAF3B]">
          {t('availability_day_blocks_section')}
        </p>

        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="mb-1 text-sm font-black text-[#001201] dark:text-[#FFF9EC]">
              {t('availability_day_no_blocks')}
            </p>
            <p className="mb-4 text-[11px] text-foreground/65 dark:text-[#A0A090]">
              {t('availability_all_postes_closed')}
            </p>
            {/* Tip card - matches prototype gold-border callout */}
            <div className="mb-5 w-full rounded-xl border-l-4 border-[#DDAF3B] bg-[#DDAF3B]/10 p-3 text-left dark:bg-[#DDAF3B]/8">
              <p className="text-[11px] text-foreground/65 dark:text-[#A0A090]">
                <strong className="text-[#DDAF3B]">{t('availability_tip_label')}</strong>{' '}
                {t('availability_day_no_blocks_tip')}
              </p>
            </div>
          </div>
        ) : (
          /* Responsive grid: 1 col mobile, 2 col on sm+ */
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="rounded-xl bg-[#F7F6F2] p-4 dark:bg-[#0F1A0C]"
              >
                <p className="mb-1 text-[11px] font-semibold text-foreground/70 dark:text-[#A0A090]">
                  {formatBays(block.bayIds)}
                </p>
                <p className="mb-0.5 text-[12px] font-bold text-[#001201] dark:text-[#FFF9EC]">
                  {block.dates.length > 1
                    ? t('availability_dates_count', { count: block.dates.length })
                    : ''}
                </p>
                <p className="mb-2.5 text-[13px] font-black text-[#DDAF3B]">
                  {block.startTime} – {block.endTime}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onDeleteBlock(block.id)}
                    className="rounded-lg border border-[#FF2525] bg-transparent px-2.5 py-1 text-[10px] font-bold text-[#FF2525] transition-colors hover:bg-[#FF2525]/10"
                  >
                    {t('availability_block_delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditBlock(block);
                    }}
                    className="rounded-lg bg-[#DDAF3B] px-2.5 py-1 text-[10px] font-bold text-[#001201] transition-colors hover:bg-[#A07818]"
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
          <div className="flex flex-col-reverse justify-end gap-2 border-t border-[#DDAF3B]/20 pt-4 dark:border-[#DDAF3B]/10 sm:flex-row sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E0DCD0] px-4 py-2.5 text-sm font-bold text-foreground/65 transition-colors hover:bg-[#F0EDE0] dark:border-[#001A05] dark:text-[#A0A090] dark:hover:bg-[#182214]"
            >
              {t('availability_btn_close')}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateForDay(date);
              }}
              className="rounded-xl bg-[#DDAF3B] px-4 py-2.5 text-sm font-black text-[#0C1209] transition-opacity hover:opacity-85"
            >
              + {t('availability_day_create_for_day')}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

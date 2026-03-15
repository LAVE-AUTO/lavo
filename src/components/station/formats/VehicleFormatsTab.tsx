'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { patchWithApi, deleteWithApi } from '@/services';
import type { VehicleFormat } from './types';
import { VehicleFormatModal } from './VehicleFormatModal';

interface Props {
  formats: VehicleFormat[];
  onAdd: (format: VehicleFormat) => void;
  onUpdate: (format: VehicleFormat) => void;
  onDelete: (id: string) => void;
}

const PencilIcon = () => (
  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18" />
  </svg>
);

export function VehicleFormatsTab({ formats, onAdd, onUpdate, onDelete }: Props) {
  const t = useTranslations('station_services');
  const [modal, setModal] = useState<VehicleFormat | null | 'new'>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; msg: string } | null>(null);

  async function handleToggle(format: VehicleFormat) {
    setToggling(format.id);
    const [ok, data] = await patchWithApi(`/station/formats/${format.id}`, { is_active: !format.is_active });
    setToggling(null);
    if (ok) onUpdate((data as { data: VehicleFormat }).data);
  }

  async function handleDelete(format: VehicleFormat) {
    if (!window.confirm(t('format_delete_confirm'))) return;
    setDeleting(format.id);
    setDeleteError(null);
    const [ok, data] = await deleteWithApi(`/station/formats/${format.id}`);
    setDeleting(null);
    if (ok) {
      onDelete(format.id);
    } else {
      const err = data as { code?: string };
      setDeleteError({
        id: format.id,
        msg: err?.code === 'CONFLICT' ? t('format_delete_conflict') : t('format_delete_error'),
      });
    }
  }

  function handleSaved(saved: VehicleFormat) {
    const isNew = !formats.find((f) => f.id === saved.id);
    if (isNew) onAdd(saved);
    else onUpdate(saved);
    setModal(null);
  }

  return (
    <>
      {/* Section header with hint + add button */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] text-[#888] dark:text-[#6A6A5A]">{t('formats_hint')}</p>
        <button
          type="button"
          onClick={() => setModal('new')}
          className="flex items-center gap-1.5 rounded-[8px] border border-[#C49A1E]/50 px-3 py-1.5 text-[12px] font-semibold text-[#C49A1E] transition-all hover:border-[#C49A1E] hover:bg-[#FDF8EC] dark:hover:bg-[#1A1A08]"
        >
          <span className="text-[15px] font-light leading-none">+</span>
          {t('btn_new_format')}
        </button>
      </div>

      {formats.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <span className="text-[14px] font-semibold text-[#999] dark:text-[#6A6A5A]">{t('formats_empty')}</span>
          <span className="text-[12px] text-[#BBBBAA] dark:text-[#4A4A3A]">{t('formats_empty_hint')}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {formats.map((format) => {
            const isDeleting = deleting === format.id;
            const isToggling = toggling === format.id;
            const err = deleteError?.id === format.id ? deleteError.msg : null;

            return (
              <div
                key={format.id}
                className="flex items-center gap-3 rounded-xl border border-[#E8E4DC] bg-white px-4 py-3.5 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    format.is_active ? 'bg-[#00C851]' : 'bg-[#D0D0C0] dark:bg-[#3A3A2A]'
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">
                  {format.label}
                </span>
                <span className="shrink-0 font-mono text-[14px] font-bold text-[#C49A1E]">
                  {parseFloat(format.price).toFixed(2)} $
                </span>

                <button
                  type="button"
                  onClick={() => handleToggle(format)}
                  disabled={isToggling}
                  className={`shrink-0 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition-all disabled:opacity-50 ${
                    format.is_active
                      ? 'bg-[#E8F8EE] text-[#009A3A] dark:bg-[#0A2A14] dark:text-[#00C851]'
                      : 'bg-[#F0EDE4] text-[#888] dark:bg-[#1A1A0A] dark:text-[#6A6A5A]'
                  }`}
                >
                  {format.is_active ? t('badge_active') : t('badge_inactive')}
                </button>

                <button
                  type="button"
                  onClick={() => setModal(format)}
                  className="shrink-0 rounded-[8px] border border-[#D8D4C8] p-1.5 text-[#888] transition-colors hover:border-[#C49A1E] hover:text-[#C49A1E] dark:border-[#243020] dark:text-[#6A6A5A]"
                  aria-label="Edit"
                >
                  <PencilIcon />
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(format)}
                  disabled={isDeleting}
                  className="shrink-0 rounded-[8px] border border-[#D8D4C8] p-1.5 text-[#888] transition-colors hover:border-[#EF4444] hover:text-[#EF4444] disabled:opacity-40 dark:border-[#243020] dark:text-[#6A6A5A]"
                  aria-label="Delete"
                >
                  {isDeleting ? (
                    <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <TrashIcon />
                  )}
                </button>

                {err && <span className="ml-1 text-[11px] font-semibold text-[#EF4444]">{err}</span>}
              </div>
            );
          })}
        </div>
      )}

      {modal !== null && (
        <VehicleFormatModal
          format={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

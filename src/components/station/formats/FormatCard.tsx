'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { patchWithApi, deleteWithApi } from '@/services';
import type { VehicleFormat } from './FormatModal';

interface FormatCardProps {
  format: VehicleFormat;
  onEdit: (format: VehicleFormat) => void;
  onDeleted: (id: string) => void;
  onToggled: (format: VehicleFormat) => void;
}

export function FormatCard({ format, onEdit, onDeleted, onToggled }: FormatCardProps) {
  const t = useTranslations('station_formats');
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleToggle() {
    setToggling(true);
    const [ok, data] = await patchWithApi(`/station/formats/${format.id}`, {
      is_active: !format.is_active,
    });
    setToggling(false);
    if (ok) {
      const res = data as { data: VehicleFormat };
      onToggled(res.data);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('delete_confirm'))) return;
    setDeleting(true);
    setDeleteError(null);
    const [ok, data] = await deleteWithApi(`/station/formats/${format.id}`);
    setDeleting(false);
    if (ok) {
      onDeleted(format.id);
    } else {
      const err = data as { code?: string };
      if (err?.code === 'CONFLICT') {
        setDeleteError(t('delete_error_conflict'));
      } else {
        setDeleteError(t('delete_error'));
      }
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E8E4DC] bg-white px-4 py-3.5 shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
      {/* Active indicator */}
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          format.is_active ? 'bg-[#00C851]' : 'bg-[#D0D0C0] dark:bg-[#3A3A2A]'
        }`}
      />

      {/* Label */}
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">
        {format.label}
      </span>

      {/* Price */}
      <span className="shrink-0 font-mono text-[14px] font-bold text-[#C49A1E]">
        {parseFloat(format.price).toFixed(2)} $
      </span>

      {/* Status toggle */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={toggling}
        className={`shrink-0 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 disabled:opacity-50 ${
          format.is_active
            ? 'bg-[#E8F8EE] text-[#009A3A] dark:bg-[#0A2A14] dark:text-[#00C851]'
            : 'bg-[#F0EDE4] text-[#888] dark:bg-[#1A1A0A] dark:text-[#6A6A5A]'
        }`}
      >
        {format.is_active ? t('active') : t('inactive')}
      </button>

      {/* Edit */}
      <button
        type="button"
        onClick={() => onEdit(format)}
        className="shrink-0 rounded-[8px] border border-[#D8D4C8] p-1.5 text-[#888] transition-colors hover:border-[#C49A1E] hover:text-[#C49A1E] dark:border-[#243020] dark:text-[#6A6A5A] dark:hover:border-[#C49A1E] dark:hover:text-[#C49A1E]"
        aria-label="Edit format"
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
        </svg>
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 rounded-[8px] border border-[#D8D4C8] p-1.5 text-[#888] transition-colors hover:border-[#EF4444] hover:text-[#EF4444] disabled:opacity-40 dark:border-[#243020] dark:text-[#6A6A5A] dark:hover:border-[#EF4444] dark:hover:text-[#EF4444]"
        aria-label="Delete format"
      >
        {deleting ? (
          <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18" />
          </svg>
        )}
      </button>

      {deleteError && (
        <span className="ml-1 text-[11px] font-semibold text-[#EF4444]">{deleteError}</span>
      )}
    </div>
  );
}

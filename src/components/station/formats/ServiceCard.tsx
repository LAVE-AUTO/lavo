'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Service } from './types';

interface Props {
  service: Service;
  onEdit: (service: Service) => void;
  onDeleted: (id: string) => void;
  onToggled: (service: Service) => void;
}

export function ServiceCard({ service, onEdit, onDeleted, onToggled }: Props) {
  const t = useTranslations('station_services');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);

  // TODO: connect to API once endpoint is available (local-only for now)
  async function confirmDelete() {
    setDeleting(true);
    await new Promise((r) => setTimeout(r, 200));
    setDeleting(false);
    setDeleteOpen(false);
    onDeleted(service.id);
  }

  // TODO: connect to API once endpoint is available (local-only for now)
  function confirmToggle() {
    setToggleOpen(false);
    onToggled({ ...service, is_active: !service.is_active });
  }

  const activeEntries = service.vehicle_entries.filter((e) => e.is_active);
  const durations = activeEntries.map((e) => e.duration_min).filter((d) => d > 0);
  const minDur = durations.length ? Math.min(...durations) : null;
  const maxDur = durations.length ? Math.max(...durations) : null;
  const durationLabel = minDur !== null
    ? (minDur === maxDur ? `${minDur} min` : `${minDur}–${maxDur} min`)
    : null;

  return (
    <>
      <div className="flex flex-col rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
        {/* Header */}
        <div className="flex items-start justify-between p-4 pb-3">
          <div className="min-w-0 flex-1 pr-3">
            <div className="text-[14px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{service.name}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-[5px] bg-[#F0EDE4] px-2 py-0.5 text-[11px] font-bold text-[#5A5A4A] dark:bg-[#1A2A14] dark:text-[#9A9A8A]">
                {t(`cat_${service.category}`)}
              </span>
              <span className="rounded-[5px] bg-[#F0EDE4] px-2 py-0.5 text-[11px] font-bold text-[#5A5A4A] dark:bg-[#1A2A14] dark:text-[#9A9A8A]">
                {t(`type_${service.service_type}`)}
              </span>
              {durationLabel && (
                <span className="text-[11px] text-[#888] dark:text-[#9A9A8A]">{durationLabel}</span>
              )}
              <button
                type="button"
                onClick={() => setToggleOpen(true)}
                className={`rounded-[5px] px-2 py-0.5 text-[11px] font-bold transition-all ${
                  service.is_active
                    ? 'bg-[#E8F8EE] text-[#009A3A] dark:bg-[#0A2A14] dark:text-[#00C851]'
                    : 'bg-[#F0EDE4] text-[#888] dark:bg-[#1A1A0A] dark:text-[#9A9A8A]'
                }`}
              >
                {service.is_active ? t('badge_active') : t('badge_inactive')}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(service)}
              className="rounded-[8px] border border-[#D8D4C8] px-3 py-1.5 text-[12px] font-semibold text-[#888] transition-colors hover:border-[#C49A1E] hover:text-[#C49A1E] dark:border-[#243020] dark:text-[#9A9A8A] dark:hover:border-[#C49A1E] dark:hover:text-[#C49A1E]"
            >
              {t('btn_edit')}
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
              className="rounded-[8px] border border-[#D8D4C8] px-3 py-1.5 text-[12px] font-semibold text-[#888] transition-colors hover:border-[#EF4444] hover:text-[#EF4444] disabled:opacity-40 dark:border-[#243020] dark:text-[#9A9A8A] dark:hover:border-[#EF4444] dark:hover:text-[#EF4444]"
            >
              {t('btn_delete')}
            </button>
          </div>
        </div>

        {/* Tariffs grid */}
        {activeEntries.length > 0 ? (
          <div className="mx-4 mb-4 rounded-[10px] bg-[#F7F6F0] p-3 dark:bg-[#0F1A0C]">
            <div className="mb-2 text-[9px] font-black tracking-[.08em] text-[#888] uppercase dark:text-[#5A5A4A]">
              {t('tarifs_label')}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {activeEntries.map((entry) => (
                <div
                  key={entry.vehicle_format_id}
                  className="rounded-[8px] bg-[#EDE9DC] p-2.5 text-center dark:bg-[#182A14]"
                >
                  <div className="text-[8px] font-black tracking-[.06em] text-[#C49A1E] uppercase">
                    {entry.vehicle_label}
                  </div>
                  <div className="mt-0.5 font-mono text-[17px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
                    {parseFloat(entry.price || '0').toFixed(0)}$
                  </div>
                  <div className="text-[9px] text-[#888] dark:text-[#5A5A4A]">{entry.duration_min} min</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-4 mb-4 rounded-[10px] border border-dashed border-[#E0DCD4] p-3 text-center text-[12px] text-[#BBBBAA] dark:border-[#243020] dark:text-[#4A4A3A]">
            {t('no_vehicle_entries')}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        title={t('confirm_delete_title')}
        message={t('confirm_delete_message', { name: service.name })}
        confirmLabel={t('confirm_delete_label')}
        cancelLabel={t('btn_cancel')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      {/* Toggle confirmation */}
      <ConfirmDialog
        open={toggleOpen}
        title={service.is_active ? t('confirm_deactivate_title') : t('confirm_activate_title')}
        message={service.is_active
          ? t('confirm_deactivate_message', { name: service.name })
          : t('confirm_activate_message', { name: service.name })}
        confirmLabel={service.is_active ? t('confirm_deactivate_label') : t('confirm_activate_label')}
        cancelLabel={t('btn_cancel')}
        variant={service.is_active ? 'warning' : 'default'}
        onConfirm={confirmToggle}
        onCancel={() => setToggleOpen(false)}
      />
    </>
  );
}

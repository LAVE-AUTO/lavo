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
    ? (minDur === maxDur ? `${minDur} min` : `${minDur}\u2013${maxDur} min`)
    : null;

  const extras = service.compatible_extras ?? [];

  return (
    <>
      <div className="flex flex-col rounded-[14px] bg-[#EDE9CC] dark:bg-[#182214]">
        {/* Header */}
        <div className="flex items-start justify-between p-[18px] pb-0">
          <div className="min-w-0 flex-1 pr-3">
            <div className="text-[17px] font-black text-[#1A1A0A] dark:text-[#EDE9CC]">{service.name}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {durationLabel && (
                <span className="text-[13px] font-black text-[#C09A18]">{durationLabel}</span>
              )}
              {/* badge actif / inactif */}
              <button
                type="button"
                onClick={() => setToggleOpen(true)}
                className={[
                  'rounded-full border px-2 py-0.5 text-[9px] font-black tracking-[.04em] transition-colors',
                  service.is_active
                    ? 'border-[#2ecc71] bg-[rgba(46,204,113,.12)] text-[#2ecc71]'
                    : 'border-[#888] bg-[rgba(136,136,136,.12)] text-[#888]',
                ].join(' ')}
              >
                {service.is_active ? t('badge_active') : t('badge_inactive')}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
              className="rounded-[6px] border-[1.5px] border-[#FF2525] bg-transparent px-2.5 py-1 text-[10px] font-bold text-[#FF2525] transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {t('btn_delete')}
            </button>
            <button
              type="button"
              onClick={() => onEdit(service)}
              className="rounded-[6px] bg-[#C09A18] px-2.5 py-1 text-[10px] font-bold text-[#0C1209] transition-opacity hover:opacity-80"
            >
              {t('btn_edit')}
            </button>
          </div>
        </div>

        {/* Category + type tags */}
        <div className="flex flex-wrap items-center gap-1.5 px-[18px] pt-2">
          <span className="rounded-[5px] bg-[#D8D4B0] px-2 py-0.5 text-[10px] font-bold text-[#4A4A2A] dark:bg-[#1A2A14] dark:text-[#9A9A8A]">
            {t(`cat_${service.category}`)}
          </span>
          <span className="rounded-[5px] bg-[#D8D4B0] px-2 py-0.5 text-[10px] font-bold text-[#4A4A2A] dark:bg-[#1A2A14] dark:text-[#9A9A8A]">
            {t(`type_${service.service_type}`)}
          </span>
        </div>

        {/* Tariffs — dark container inside cream card */}
        <div className="mx-[18px] mt-3 rounded-[10px] bg-[#182214] p-3 dark:bg-[#0F120A]">
          <div className="mb-2.5 text-[9px] font-black tracking-[.08em] text-[#5A6A5A] uppercase">
            {t('tarifs_label')}
          </div>
          {activeEntries.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {activeEntries.map((entry) => (
                <div
                  key={entry.vehicle_format_id}
                  className="rounded-[8px] bg-[#3A2A12] p-2.5 text-center"
                >
                  <div className="text-[8px] font-black tracking-[.06em] text-[#C09A18] uppercase">
                    {entry.vehicle_label}
                  </div>
                  <div className="mt-1 font-mono text-[17px] font-black text-[#EDE9CC]">
                    {parseFloat(entry.price || '0').toFixed(0)}$
                  </div>
                  <div className="mt-0.5 text-[9px] text-[#5A6A5A]">{entry.duration_min} min</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#2A3A20] py-3 text-center text-[11px] text-[#5A6A5A]">
              {t('no_vehicle_entries')}
            </div>
          )}
        </div>

        {/* Extras */}
        <div className="mx-[18px] mb-[18px] mt-2 rounded-[10px] bg-[#182214] p-3 dark:bg-[#0F120A]">
          <div className="mb-2 text-[9px] font-black tracking-[.08em] text-[#5A6A5A] uppercase">
            {t('extras_label')}
          </div>
          {extras.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {extras.map((extra) => (
                <span
                  key={extra.id}
                  className="inline-flex items-center gap-1 rounded-full border border-[#2ecc71] bg-[rgba(46,204,113,.12)] px-2.5 py-1 text-[10px] font-bold text-[#2ecc71]"
                >
                  {extra.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#EF4444] bg-[rgba(239,68,68,.12)] px-2.5 py-1 text-[10px] font-bold text-[#EF4444]">
              {t('extras_none')}
            </span>
          )}
        </div>
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

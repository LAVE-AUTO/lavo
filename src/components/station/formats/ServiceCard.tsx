'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { deleteWithApi, patchWithApi } from '@/services';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Service } from './types';

interface Props {
  service: Service;
  onEdit: (service: Service) => void;
  onDeleted: (id: string) => void;
  onToggled: (service: Service) => void;
}

const CrossIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PencilIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const FlameIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14a8 8 0 0 0 16 0C20 9.79 17.65 5.74 13.5.67zM11.71 19a3.07 3.07 0 0 1-3.05-3.36c.16-1.41 1.13-2.41 2.31-2.66.71-.16 1.46.04 1.97.5.85.78 1.06 2.13.4 3.21z" />
  </svg>
);

export function ServiceCard({ service, onEdit, onDeleted, onToggled }: Props) {
  const t = useTranslations('station_services');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    const [ok, data] = await deleteWithApi(`/station/services/${service.id}`);
    setDeleting(false);
    if (!ok) {
      setDeleteError((data as { message?: string })?.message ?? 'Erreur lors de la suppression');
      return;
    }
    setDeleteOpen(false);
    onDeleted(service.id);
  }

  async function confirmToggle() {
    setToggling(true);
    const [ok, data] = await patchWithApi(`/station/services/${service.id}`, {
      is_active: !service.is_active,
    });
    setToggling(false);
    if (!ok) {
      console.error('Toggle failed', data);
      setToggleOpen(false);
      return;
    }
    setToggleOpen(false);
    onToggled({ ...service, is_active: !service.is_active });
  }

  const activeEntries = service.vehicle_entries.filter((e) => e.is_active);
  const durations = activeEntries.map((e) => e.duration_min).filter((d) => d > 0);
  const minDur = durations.length ? Math.min(...durations) : null;
  const maxDur = durations.length ? Math.max(...durations) : null;
  const durationLabel =
    minDur !== null
      ? minDur === maxDur
        ? `${minDur} MIN`
        : `${minDur}-${maxDur} MIN`
      : null;

  const extras = service.compatible_extras ?? [];
  const isPackages = service.category === 'automatic';

  return (
    <>
      <article
        className="group flex flex-col rounded-2xl border border-separator/25 bg-card-surface p-4 transition-all duration-200 hover:border-[#DDAF3B]/30 hover:shadow-sm dark:border-[#1A2A14] dark:bg-[#182214] dark:hover:border-[#DDAF3B]/30 sm:p-6"
      >
        {/* Header */}
        <header className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/55 dark:text-[#B0BFB1]">
              {t(`cat_${service.category}`)}
            </p>
            <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-separator/25 bg-card-surface px-2.5 py-1.5 text-[11px] font-bold text-foreground/55 transition-all hover:border-[#FF2525] hover:bg-[#FF2525]/5 hover:text-[#FF2525] disabled:opacity-40 dark:border-[#001A05] dark:bg-dark-bg dark:text-[#B0BFB1]"
            >
              <CrossIcon />
              {t('btn_delete_short')}
            </button>
            <button
              type="button"
              onClick={() => onEdit(service)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#DDAF3B] px-2.5 py-1.5 text-[11px] font-bold text-[#001201] transition-opacity hover:opacity-85"
            >
              <PencilIcon />
              {t('btn_edit')}
            </button>
            </div>
          </div>
          <h3 className="mt-2 text-[18px] font-black leading-tight text-[#001201] dark:text-[#FFF9EC] sm:text-[20px] mb-3">
            {service.name}
          </h3>
          {durationLabel && (
            <p className="mt-1 font-mono text-[13px] font-black tracking-[2px] text-[#DDAF3B]">
              {durationLabel}
            </p>
          )}
        </header>

        {/* Badges */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setToggleOpen(true)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide transition-colors ${
              service.is_active
                ? 'border-[#22C47A]/40 bg-[#22C47A]/12 text-[#16A964] hover:bg-[#22C47A]/20'
                : 'border-[#888]/30 bg-[#888]/10 text-foreground/55 hover:bg-[#888]/15 dark:text-[#B0BFB1]'
            }`}
            aria-label={service.is_active ? t('badge_active') : t('badge_inactive')}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${service.is_active ? 'bg-[#22C47A]' : 'bg-[#888]'}`} aria-hidden="true" />
            {service.is_active ? t('badge_active') : t('badge_inactive')}
          </button>
          {service.is_popular && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#EF4444]/30 bg-[#EF4444]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#EF4444]">
              <FlameIcon />
              {t('badge_popular')}
            </span>
          )}
        </div>

        {/* Tarifs */}
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[1px] text-foreground/55 dark:text-[#B0BFB1]">
          {isPackages ? t('automatic_packages_label') : t('tarifs_label')}
        </p>
        {activeEntries.length > 0 ? (
          <div className="mb-4 grid grid-cols-3 gap-1.5 sm:gap-2">
            {activeEntries.map((entry) => (
              <div
                /* The serviceVehicleEntries row id is always unique; the
                 * underlying vehicle_format_id can be null on non-hand_wash
                 * services (catalogue placeholders), which used to collide
                 * across siblings and trip React's duplicate-key warning. */
                key={entry.id}
                className="rounded-xl bg-[#FFF9EC] px-1.5 py-2 text-center dark:bg-dark-bg sm:px-3 sm:py-3"
              >
                <p className={`truncate text-[8px] font-bold uppercase tracking-[0.5px] sm:text-[9px] sm:tracking-[1px] ${isPackages ? 'text-[#DDAF3B]' : 'text-foreground/55 dark:text-[#B0BFB1]'}`}>
                  {entry.vehicle_label}
                </p>
                <p className="mt-1 font-mono text-[17px] font-black tabular-nums leading-none text-[#DDAF3B] sm:text-[22px]">
                  {parseFloat(entry.price || '0').toFixed(0)} $
                </p>
                <p className="mt-1 text-[10px] text-foreground/55 dark:text-[#B0BFB1] sm:text-[11px]">
                  {entry.duration_min} min
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-dashed border-[#FFF9EC] py-4 text-center text-[12px] text-[#BBBBAA] dark:border-[#001A05] dark:text-[#5A5A4A]">
            {t('no_vehicle_entries')}
          </div>
        )}

        {/* Extras compatibles - auto/self-service services don't have extras */}
        {!isPackages && service.category !== 'self_service' && (
          <div className="mt-auto rounded-xl bg-[#FFF9EC] p-3 dark:bg-dark-bg">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[1px] text-foreground/55 dark:text-[#B0BFB1]">
              {t('extras_label')}
            </p>
            {extras.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {extras.map((extra) => (
                  <span
                    key={extra.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#22C47A]/40 bg-[#22C47A]/12 px-3 py-1.5 text-[13px] font-bold text-[#16A964] dark:text-[#3FD98A]"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {extra.name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="inline-flex items-center text-[12px] text-[#BBBBAA] dark:text-[#5A5A4A]">
                {t('extras_none_short')}
              </span>
            )}
          </div>
        )}
      </article>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        title={t('confirm_delete_title')}
        message={deleteError ?? t('confirm_delete_message', { name: service.name })}
        confirmLabel={t('confirm_delete_label')}
        cancelLabel={t('btn_cancel')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleteOpen(false); setDeleteError(null); }}
      />

      {/* Toggle confirmation */}
      <ConfirmDialog
        open={toggleOpen}
        title={service.is_active ? t('confirm_deactivate_title') : t('confirm_activate_title')}
        message={
          service.is_active
            ? t('confirm_deactivate_message', { name: service.name })
            : t('confirm_activate_message', { name: service.name })
        }
        confirmLabel={service.is_active ? t('confirm_deactivate_label') : t('confirm_activate_label')}
        cancelLabel={t('btn_cancel')}
        variant={service.is_active ? 'warning' : 'default'}
        loading={toggling}
        onConfirm={confirmToggle}
        onCancel={() => setToggleOpen(false)}
      />
    </>
  );
}

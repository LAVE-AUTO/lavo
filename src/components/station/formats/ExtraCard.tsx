'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { deleteWithApi, patchWithApi } from '@/services';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { StationExtra } from '@/components/station/config/station-extras-types';

interface Props {
  extra: StationExtra;
  onEdit: (extra: StationExtra) => void;
  onDeleted: (id: string) => void;
  onToggled: (extra: StationExtra) => void;
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

export function ExtraCard({ extra, onEdit, onDeleted, onToggled }: Props) {
  const t = useTranslations('station_services');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    const [ok, data] = await deleteWithApi(`/station/extras/${extra.id}`);
    setDeleting(false);
    if (!ok) {
      setDeleteError((data as { message?: string })?.message ?? 'Erreur lors de la suppression');
      return;
    }
    setDeleteOpen(false);
    onDeleted(extra.id);
  }

  async function confirmToggle() {
    setToggling(true);
    const [ok, data] = await patchWithApi(`/station/extras/${extra.id}`, {
      is_active: !extra.is_active,
    });
    setToggling(false);
    if (!ok) {
      console.error('Toggle extra failed', data);
      setToggleOpen(false);
      return;
    }
    setToggleOpen(false);
    onToggled({ ...extra, is_active: !extra.is_active });
  }

  const entries = extra.vehicle_entries ?? [];
  const durations = entries.map((e) => e.duration_min).filter((d) => d > 0);
  const minDur = durations.length ? Math.min(...durations) : null;
  const maxDur = durations.length ? Math.max(...durations) : null;
  const durationLabel =
    minDur !== null
      ? minDur === maxDur
        ? `+${minDur} MIN`
        : `+${minDur}-${maxDur} MIN`
      : null;

  const opacityClass = extra.is_active ? '' : 'opacity-60';

  return (
    <>
      <article
        className={`group flex flex-col rounded-2xl border border-[#FFF9EC] bg-white p-5 transition-all duration-200 hover:border-[#DDAF3B]/30 hover:shadow-sm dark:border-[#1A2A14] dark:bg-[#182214] dark:hover:border-[#DDAF3B]/30 ${opacityClass}`}
      >
        {/* Header */}
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-black leading-tight text-[#001201] dark:text-[#FFF9EC]">
              {extra.label}
            </h3>
            {durationLabel && (
              <p className="mt-1 font-mono text-[12px] font-black tracking-[2px] text-[#DDAF3B]">
                {durationLabel}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
              aria-label={t('btn_delete')}
              className="inline-flex items-center justify-center rounded-lg border border-[#FFF9EC] bg-white p-1.5 text-foreground/55 transition-all hover:border-[#FF2525] hover:bg-[#FF2525]/5 hover:text-[#FF2525] disabled:opacity-40 dark:border-[#001A05] dark:bg-[#001201] dark:text-[#B0BFB1]"
            >
              <CrossIcon />
            </button>
            <button
              type="button"
              onClick={() => onEdit(extra)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#DDAF3B] px-2.5 py-1.5 text-[11px] font-bold text-[#001201] transition-opacity hover:opacity-85"
            >
              <PencilIcon />
              {t('btn_edit')}
            </button>
          </div>
        </header>

        {/* Badge */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setToggleOpen(true)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide transition-colors ${
              extra.is_active
                ? 'border-[#22C47A]/40 bg-[#22C47A]/12 text-[#16A964] hover:bg-[#22C47A]/20'
                : 'border-[#888]/30 bg-[#888]/10 text-foreground/55 hover:bg-[#888]/15 dark:text-[#B0BFB1]'
            }`}
            aria-label={extra.is_active ? t('badge_active') : t('badge_inactive')}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${extra.is_active ? 'bg-[#22C47A]' : 'bg-[#888]'}`} aria-hidden="true" />
            {extra.is_active ? t('badge_active') : t('badge_inactive')}
          </button>
        </div>

        {/* Tarifs */}
        {entries.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {entries.map((entry) => (
              <div
                key={entry.vehicle_format_id}
                className="rounded-xl bg-[#FFF9EC] px-3 py-3 text-center dark:bg-[#001201]"
              >
                <p className="text-[9px] font-bold uppercase tracking-[1px] text-foreground/55 dark:text-[#B0BFB1]">
                  {entry.vehicle_label}
                </p>
                <p className="mt-1 font-mono text-[20px] font-black tabular-nums leading-none text-[#DDAF3B]">
                  {parseFloat(entry.price || '0').toFixed(0)} $
                </p>
                <p className="mt-1 text-[11px] text-foreground/55 dark:text-[#B0BFB1]">{entry.duration_min} min</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-[#FFF9EC] px-3 py-3 text-center dark:bg-[#001201]">
            <p className="text-[9px] font-bold uppercase tracking-[1px] text-foreground/55 dark:text-[#B0BFB1]">
              {t('extras_all_formats')}
            </p>
            <p className="mt-1 font-mono text-[22px] font-black tabular-nums leading-none text-[#DDAF3B]">
              +{parseFloat(extra.price || '0').toFixed(0)} $
            </p>
          </div>
        )}
      </article>

      <ConfirmDialog
        open={deleteOpen}
        title={t('confirm_delete_title')}
        message={deleteError ?? t('confirm_delete_message', { name: extra.label })}
        confirmLabel={t('confirm_delete_label')}
        cancelLabel={t('btn_cancel')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleteOpen(false); setDeleteError(null); }}
      />

      <ConfirmDialog
        open={toggleOpen}
        title={extra.is_active ? t('confirm_deactivate_title') : t('confirm_activate_title')}
        message={
          extra.is_active
            ? t('confirm_deactivate_message', { name: extra.label })
            : t('confirm_activate_message', { name: extra.label })
        }
        confirmLabel={extra.is_active ? t('confirm_deactivate_label') : t('confirm_activate_label')}
        cancelLabel={t('btn_cancel')}
        variant={extra.is_active ? 'warning' : 'default'}
        loading={toggling}
        onConfirm={confirmToggle}
        onCancel={() => setToggleOpen(false)}
      />
    </>
  );
}

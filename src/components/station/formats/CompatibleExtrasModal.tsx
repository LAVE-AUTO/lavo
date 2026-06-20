'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { patchWithApi } from '@/services';
import { Modal } from '@/components/ui/Modal';
import type { StationExtra } from '@/components/station/config/station-extras-types';

interface Props {
  open: boolean;
  onClose: () => void;
  serviceName: string;
  extras: StationExtra[];
  /** Bubble the updated extra up so the parent list stays in sync. */
  onToggled: (extra: StationExtra) => void;
}

/**
 * Lists the extras compatible with a given service and lets the merchant
 * activate / deactivate each one in place. Toggling patches the extra's
 * `is_active` flag (same endpoint as the Extras tab) and reports the change up.
 */
export function CompatibleExtrasModal({ open, onClose, serviceName, extras, onToggled }: Props) {
  const t = useTranslations('station_services');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggle(extra: StationExtra) {
    if (togglingId) return;
    setTogglingId(extra.id);
    const [ok] = await patchWithApi(`/station/extras/${extra.id}`, { is_active: !extra.is_active });
    setTogglingId(null);
    if (!ok) return;
    onToggled({ ...extra, is_active: !extra.is_active });
  }

  return (
    <Modal open={open} onClose={onClose} title={t('extras_modal_title')} size="md">
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-foreground/65 dark:text-[#B0BFB1]">
          {t('extras_modal_subtitle', { service: serviceName })}
        </p>

        {extras.length === 0 ? (
          <div className="rounded-xl border border-separator/25 bg-[#FFF9EC] px-4 py-6 text-center text-[13px] text-foreground/55 dark:border-[#1A2A14] dark:bg-dark-bg dark:text-[#B0BFB1]">
            {t('extras_none_short')}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {extras.map((extra) => {
              const isToggling = togglingId === extra.id;
              return (
                <li
                  key={extra.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-separator/25 bg-card-surface px-3.5 py-3 dark:border-[#1A2A14] dark:bg-[#182214]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-foreground">{extra.label}</p>
                    {extra.description && (
                      <p className="truncate text-[12px] text-foreground/55 dark:text-[#B0BFB1]">{extra.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={extra.is_active}
                    aria-label={extra.is_active ? t('badge_active') : t('badge_inactive')}
                    disabled={isToggling}
                    onClick={() => toggle(extra)}
                    className={[
                      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
                      extra.is_active ? 'bg-[#22C47A]' : 'bg-[#C8C8B4] dark:bg-[#3A4A30]',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                        extra.is_active ? 'translate-x-[22px]' : 'translate-x-0.5',
                      ].join(' ')}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

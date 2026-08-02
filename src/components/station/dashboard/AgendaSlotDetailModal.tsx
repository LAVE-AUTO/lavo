'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { utcToStationMinutes } from '@/helpers/station-time';
import type { AgendaEntry } from './DashboardAgendaTimeline';

interface Props {
  open: boolean;
  entry: AgendaEntry | null;
  onClose: () => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onExtraTime: (id: string, minutes: number) => void;
}

function formatTime(iso: string | null, fallback = '—'): string {
  if (!iso) return fallback;
  const minutes = utcToStationMinutes(new Date(iso));
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function statusVisuals(status: string): { dot: string; label: string } {
  switch (status) {
    case 'completed':   return { dot: '#999',    label: 'status_completed' };
    case 'in_progress': return { dot: '#2ECC71', label: 'status_in_progress' };
    case 'late':        return { dot: '#FF383C', label: 'status_late' };
    case 'cancelled':   return { dot: '#999',    label: 'status_cancelled' };
    default:            return { dot: '#1E40AF', label: 'status_confirmed' };
  }
}

export function AgendaSlotDetailModal({
  open, entry, onClose, onStart, onComplete, onCancel, onExtraTime,
}: Props) {
  const t = useTranslations('station_dashboard');
  if (!entry) return null;

  const visuals = statusVisuals(entry.status);
  const isRunning = entry.status === 'in_progress';

  return (
    <Modal open={open} onClose={onClose} size="md" title={t('slot_detail_title')}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#FFF9EC] bg-[#FFF9EC] p-4 dark:border-[#1A2A14] dark:bg-dark-bg">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-foreground/55 dark:text-[#B0BFB1]">
              {t('slot_detail_client')}
            </div>
            <div className="mt-0.5 truncate text-[18px] font-black text-[#001201] dark:text-[#FFF9EC]">
              {entry.clientName}
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wide shadow-sm dark:bg-[#182214]">
            <span className="h-2 w-2 rounded-full" style={{ background: visuals.dot }} aria-hidden="true" />
            <span className="text-[#001201] dark:text-[#FFF9EC]">{t(visuals.label)}</span>
          </span>
        </div>

        {/* Grid info */}
        <div className="grid grid-cols-2 gap-3">
          <InfoCell label={t('slot_detail_time')}
                    value={`${formatTime(entry.slotStart)}–${formatTime(entry.slotEnd)}`} bebas />
          <InfoCell label={t('slot_detail_amount')}
                    value={entry.amountPaid !== null ? `${entry.amountPaid}$` : '—'} />
          <InfoCell label={t('slot_detail_service')}
                    value={entry.vehicleFormat ?? '—'}
                    span2 />
        </div>

        {/* Payment notice — clarifies that funds clear at completion */}
        <div className="rounded-xl border border-[#1E40AF]/25 bg-[#E6EEFD] px-3 py-2 text-[11px] text-[#1E40AF] dark:bg-[#10182B] dark:text-[#8AB4FF]">
          {t('slot_detail_payment_notice')}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-[#FFF9EC] pt-3 dark:border-[#1A2A14]">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[#FFF9EC] px-4 py-2 text-[13px] font-bold text-foreground/65 transition-colors hover:bg-[#F0EDE0] dark:border-[#001A05] dark:text-[#B0BFB1] dark:hover:bg-[#1A2A14]"
        >
          {t('btn_close')}
        </button>
        {!isRunning && entry.status !== 'completed' && entry.status !== 'cancelled' && (
          <>
            <button
              type="button"
              onClick={() => { onCancel(entry.id); onClose(); }}
              className="rounded-lg border border-[#FF383C]/40 px-4 py-2 text-[13px] font-bold text-[#FF383C] transition-colors hover:bg-[#FF383C]/10"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="button"
              onClick={() => { onStart(entry.id); onClose(); }}
              className="rounded-lg bg-[#1E40AF] px-5 py-2 text-[13px] font-black text-white transition-opacity hover:opacity-90"
            >
              {t('btn_start')}
            </button>
          </>
        )}
        {isRunning && (
          <>
            <button
              type="button"
              onClick={() => { onExtraTime(entry.id, 15); onClose(); }}
              className="rounded-lg border border-[#DDAF3B]/50 px-4 py-2 text-[13px] font-bold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/10"
            >
              {t('btn_extra_time')}
            </button>
            <button
              type="button"
              onClick={() => { onComplete(entry.id); onClose(); }}
              className="rounded-lg bg-[#2ECC71] px-5 py-2 text-[13px] font-black text-white transition-opacity hover:opacity-90"
            >
              {t('btn_complete')}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

function InfoCell({ label, value, span2, bebas }: { label: string; value: string; span2?: boolean; bebas?: boolean }) {
  return (
    <div className={`rounded-xl border border-separator/25 bg-card-surface px-3 py-2 dark:border-[#1A2A14] dark:bg-[#182214] ${span2 ? 'col-span-2' : ''}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/55 dark:text-[#B0BFB1]">
        {label}
      </div>
      <div className={`mt-0.5 truncate text-[#001201] dark:text-[#FFF9EC] ${bebas ? 'font-bebas text-[16px] tracking-wide' : 'text-[14px] font-bold'}`}>
        {value}
      </div>
    </div>
  );
}

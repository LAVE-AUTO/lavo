'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
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
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function statusVisuals(status: string): { dot: string; label: string } {
  switch (status) {
    case 'completed':   return { dot: '#999',    label: 'status_completed' };
    case 'in_progress': return { dot: '#2ECC71', label: 'status_in_progress' };
    case 'late':        return { dot: '#E8472A', label: 'status_late' };
    case 'cancelled':   return { dot: '#999',    label: 'status_cancelled' };
    default:            return { dot: '#3B82F6', label: 'status_confirmed' };
  }
}

export function AgendaSlotDetailModal({
  open, entry, onClose, onStart, onComplete, onCancel, onExtraTime,
}: Props) {
  const t = useTranslations('station_dashboard');
  if (!entry) return null;

  const visuals = statusVisuals(entry.status);
  const isStartable = entry.status === 'confirmed' || entry.status === 'pending' || entry.status === 'pending_payment';
  const isRunning = entry.status === 'in_progress';

  return (
    <Modal open={open} onClose={onClose} size="md" title={t('slot_detail_title')}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#E8E4DC] bg-[#F7F6F2] p-4 dark:border-[#1A2A14] dark:bg-[#0F1A0C]">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#888] dark:text-[#9A9A8A]">
              {t('slot_detail_client')}
            </div>
            <div className="mt-0.5 truncate text-[18px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
              {entry.clientName}
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wide shadow-sm dark:bg-[#182214]">
            <span className="h-2 w-2 rounded-full" style={{ background: visuals.dot }} aria-hidden="true" />
            <span className="text-[#1A1A0A] dark:text-[#F0EDD4]">{t(visuals.label)}</span>
          </span>
        </div>

        {/* Grid info */}
        <div className="grid grid-cols-2 gap-3">
          <InfoCell label={t('slot_detail_time')}
                    value={`${formatTime(entry.slotStart)}–${formatTime(entry.slotEnd)}`} />
          <InfoCell label={t('slot_detail_amount')}
                    value={entry.amountPaid !== null ? `${entry.amountPaid}$` : '—'} />
          <InfoCell label={t('slot_detail_service')}
                    value={entry.vehicleFormat ?? '—'}
                    span2 />
        </div>

        {/* Payment notice — clarifies that funds clear at completion */}
        <div className="rounded-xl border border-[#3B82F6]/25 bg-[#E6EEFD] px-3 py-2 text-[11px] text-[#1E40AF] dark:bg-[#10182B] dark:text-[#8AB4FF]">
          {t('slot_detail_payment_notice')}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-[#E0DCD0] pt-3 dark:border-[#1A2A14]">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[#E0DCD0] px-4 py-2 text-[13px] font-bold text-[#666] transition-colors hover:bg-[#F0EDE0] dark:border-[#243020] dark:text-[#A0A090] dark:hover:bg-[#1A2A14]"
        >
          {t('btn_close')}
        </button>
        {isStartable && (
          <>
            <button
              type="button"
              onClick={() => { onCancel(entry.id); onClose(); }}
              className="rounded-lg border border-[#E8472A]/40 px-4 py-2 text-[13px] font-bold text-[#E8472A] transition-colors hover:bg-[#E8472A]/10"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="button"
              onClick={() => { onStart(entry.id); onClose(); }}
              className="rounded-lg bg-[#3B82F6] px-5 py-2 text-[13px] font-black text-white transition-opacity hover:opacity-90"
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
              className="rounded-lg border border-[#C49A1E]/50 px-4 py-2 text-[13px] font-bold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/10"
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

function InfoCell({ label, value, span2 }: { label: string; value: string; span2?: boolean }) {
  return (
    <div className={`rounded-xl border border-[#E8E4DC] bg-white px-3 py-2 dark:border-[#1A2A14] dark:bg-[#182214] ${span2 ? 'col-span-2' : ''}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#888] dark:text-[#9A9A8A]">
        {label}
      </div>
      <div className="mt-0.5 truncate text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
        {value}
      </div>
    </div>
  );
}

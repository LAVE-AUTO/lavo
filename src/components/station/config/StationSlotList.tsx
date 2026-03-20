'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { deleteWithApi } from '@/services';
import type { CreatedSlot } from './SlotModal';

interface StationSlotListProps {
  slots: CreatedSlot[];
  selectedDate: string;
  onDateChange: (d: string) => void;
  onDeleted: (id: string) => void;
  onAddSlot: () => void;
  onGenerate: () => void;
  onBulk: () => void;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
}

const statusColor: Record<string, string> = {
  available: '#2ECC71',
  full: '#EF4444',
  blocked: '#888',
};

export function StationSlotList({
  slots,
  selectedDate,
  onDateChange,
  onDeleted,
  onAddSlot,
  onGenerate,
  onBulk,
}: StationSlotListProps) {
  const t = useTranslations('station_config');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const [ok] = await deleteWithApi(`/station/slots/${id}`);
    if (!mountedRef.current) return;
    setDeletingId(null);
    if (ok) onDeleted(id);
  }

  const statusLabel: Record<string, string> = {
    available: t('slot_status_available'),
    full: t('slot_status_full'),
    blocked: t('slot_status_blocked'),
  };

  return (
    <section className="rounded-xl border border-[#E0DCD0] bg-white p-5 dark:border-[#1A2A14] dark:bg-[#182214]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[13px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
          {t('slots_title')}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-lg border border-[#E0DCD0] bg-[#F5F5EE] px-2 py-1 text-[11px] text-[#1A1A0A] outline-none focus:border-[#C49A1E] dark:border-[#1A2A14] dark:bg-[#0C1209] dark:text-[#F0EDD4]"
          />
          <button
            type="button"
            onClick={onAddSlot}
            className="rounded-lg border border-[#C49A1E] px-3 py-1.5 text-[11px] font-bold text-[#C49A1E] transition-colors hover:bg-[#C49A1E] hover:text-[#0C1209]"
          >
            {t('btn_add_slot')}
          </button>
          <button
            type="button"
            onClick={onBulk}
            className="rounded-lg border border-[#C49A1E] px-3 py-1.5 text-[11px] font-bold text-[#C49A1E] transition-colors hover:bg-[#C49A1E] hover:text-[#0C1209]"
          >
            {t('btn_bulk_slot')}
          </button>
          <button
            type="button"
            onClick={onGenerate}
            className="rounded-lg bg-[#C49A1E] px-3 py-1.5 text-[11px] font-black text-[#0C1209] transition-opacity hover:opacity-80"
          >
            {t('btn_generate')}
          </button>
        </div>
      </div>

      {/* Slot list */}
      {slots.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-[12px] text-[#888] dark:text-[#8A8A7A]">
          {t('slots_empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="flex items-center justify-between rounded-lg border border-[#E0DCD0] px-4 py-2.5 dark:border-[#1A2A14]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: statusColor[slot.status] ?? '#888' }}
                />
                <span className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
                  {fmt(slot.start_time)} – {fmt(slot.end_time)}
                </span>
                <span className="text-[11px] text-[#666] dark:text-[#8A8A7A]">
                  {t('slot_booked', { n: slot.booked_count, total: slot.capacity })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold" style={{ color: statusColor[slot.status] ?? '#888' }}>
                  {statusLabel[slot.status] ?? slot.status}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(slot.id)}
                  disabled={deletingId === slot.id}
                  className="rounded px-2 py-1 text-[11px] font-bold text-[#EF4444] transition-colors hover:bg-[#FEE2E2] disabled:opacity-40 dark:hover:bg-[#3A1A1A]"
                >
                  {deletingId === slot.id ? t('deleting') : t('btn_delete_slot')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

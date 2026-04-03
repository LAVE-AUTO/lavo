'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { deleteWithApi, getAxiosInstance } from '@/services';
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

const statusConfig: Record<string, { color: string; bg: string; darkBg: string }> = {
  available: { color: '#00C851', bg: 'rgba(0,200,81,0.12)', darkBg: 'rgba(0,200,81,0.1)' },
  full:      { color: '#EF4444', bg: 'rgba(239,68,68,0.10)', darkBg: 'rgba(239,68,68,0.08)' },
  blocked:   { color: '#AAAAAA', bg: 'rgba(170,170,170,0.12)', darkBg: 'rgba(170,170,170,0.08)' },
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const [ok] = await deleteWithApi(`/station/slots/${id}`);
    if (!mountedRef.current) return;
    setDeletingId(null);
    if (ok) onDeleted(id);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === slots.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(slots.map((s) => s.id)));
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await getAxiosInstance().delete<{ data: { deleted: string[]; failed?: { id: string; reason: string }[] } }>(
        '/station/slots',
        { data: { ids: Array.from(selected) } },
      );
      if (!mountedRef.current) return;
      const deleted = res.data?.data?.deleted ?? Array.from(selected);
      for (const id of deleted) onDeleted(id);
      setSelected(new Set());
    } catch {
      // silent — individual failures handled by backend partial response
    } finally {
      if (mountedRef.current) setBulkDeleting(false);
    }
  }

  const statusLabel: Record<string, string> = {
    available: t('slot_status_available'),
    full: t('slot_status_full'),
    blocked: t('slot_status_blocked'),
  };

  return (
    <section className="rounded-xl border border-[#E8E4DC] bg-white shadow-sm dark:border-[#1A2A14] dark:bg-[#182214]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#F0EDE4] px-5 py-3.5 dark:border-[#1A2A14]">
        <span className="h-4 w-[3px] rounded-full bg-[#C49A1E]" />
        <span className="flex-1 text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{t('slots_title')}</span>
        {slots.length > 0 && (
          <span className="rounded-full bg-[#FDF3D8] px-2 py-0.5 text-[11px] font-bold text-[#C49A1E] dark:bg-[#2A1E08]">
            {slots.length}
          </span>
        )}
        {selected.size > 0 && (
          <button type="button" onClick={handleBulkDelete} disabled={bulkDeleting}
            className="rounded-[8px] bg-[#EF4444] px-3 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-50">
            {bulkDeleting ? t('deleting') : t('btn_delete_selected', { n: selected.size })}
          </button>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-[8px] border border-[#E0DCD0] bg-[#F7F6F2] px-2.5 py-1.5 text-[12px] text-[#1A1A0A] outline-none transition-colors focus:border-[#C49A1E] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4]"
          />
          <button type="button" onClick={onAddSlot}
            className="rounded-[8px] border border-[#C49A1E]/50 px-3 py-1.5 text-[11px] font-bold text-[#C49A1E] transition-colors hover:border-[#C49A1E] hover:bg-[#C49A1E]/8">
            {t('btn_add_slot')}
          </button>
          <button type="button" onClick={onBulk}
            className="rounded-[8px] border border-[#C49A1E]/50 px-3 py-1.5 text-[11px] font-bold text-[#C49A1E] transition-colors hover:border-[#C49A1E] hover:bg-[#C49A1E]/8">
            {t('btn_bulk_slot')}
          </button>
          <button type="button" onClick={onGenerate}
            className="rounded-[8px] bg-[#C49A1E] px-3 py-1.5 text-[11px] font-black text-[#0C1209] transition-opacity hover:opacity-80">
            {t('btn_generate')}
          </button>
        </div>
      </div>

      <div className="p-5">
        {slots.length === 0 ? (
          <div className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[#E0DCD4] dark:border-[#243020]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CCCCBB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="text-[12px] text-[#BBBBAA] dark:text-[#4A4A3A]">{t('slots_empty')}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {slots.length > 1 && (
              <label className="flex items-center gap-2 px-4 py-1 text-[11px] font-semibold text-[#888] dark:text-[#6A6A5A] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selected.size === slots.length}
                  onChange={toggleAll}
                  className="accent-[#C49A1E] h-3.5 w-3.5"
                />
                {t('select_all')}
              </label>
            )}
            {slots.map((slot) => {
              const st = statusConfig[slot.status] ?? statusConfig.blocked;
              const fillPct = slot.capacity > 0 ? Math.round((slot.booked_count / slot.capacity) * 100) : 0;
              return (
                <div key={slot.id}
                  className="flex items-center gap-4 rounded-[10px] border border-[#EDEBE5] bg-[#FAFAF7] px-4 py-3 transition-shadow hover:shadow-sm dark:border-[#243020] dark:bg-[#0D170A]">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(slot.id)}
                    onChange={() => toggleSelect(slot.id)}
                    className="accent-[#C49A1E] h-3.5 w-3.5 shrink-0 cursor-pointer"
                  />
                  {/* Status dot */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]" style={{ background: st.bg }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: st.color }} />
                  </div>

                  {/* Time range */}
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="text-[13px] font-bold tabular-nums text-[#1A1A0A] dark:text-[#F0EDD4]">
                      {fmt(slot.start_time)} – {fmt(slot.end_time)}
                    </span>
                    {/* Capacity bar */}
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-[#E8E4DC] dark:bg-[#243020]">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${fillPct}%`, background: st.color }} />
                      </div>
                      <span className="text-[11px] text-[#999] dark:text-[#6A6A5A]">
                        {t('slot_booked', { n: slot.booked_count, total: slot.capacity })}
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color: st.color, background: st.bg }}>
                    {statusLabel[slot.status] ?? slot.status}
                  </span>

                  {/* Delete */}
                  <button type="button" onClick={() => handleDelete(slot.id)} disabled={deletingId === slot.id}
                    className="rounded-[7px] px-2.5 py-1.5 text-[11px] font-bold text-[#C8C4BC] transition-colors hover:bg-[#FEE2E2] hover:text-[#EF4444] disabled:opacity-40 dark:text-[#3A3A2A] dark:hover:bg-[#3A1A1A] dark:hover:text-[#EF4444]">
                    {deletingId === slot.id ? t('deleting') : t('btn_delete_slot')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

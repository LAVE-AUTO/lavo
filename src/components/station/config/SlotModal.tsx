'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { postWithApi } from '@/services';

export interface CreatedSlot {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: string;
}

interface BulkRow {
  startTime: string;
  endTime: string;
  capacity: string;
}

interface SlotModalProps {
  mode: 'add' | 'generate' | 'bulk';
  selectedDate: string;
  onClose: () => void;
  onCreated: (slots: CreatedSlot[]) => void;
}

const inputClass =
  'w-full rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 text-[13px] text-[#1A1A0A] outline-none transition-colors duration-150 placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] dark:focus:border-[#C49A1E] dark:focus:bg-[#182214]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-[#5A5A4A] dark:text-[#9A9A8A]">{label}</label>
      {children}
    </div>
  );
}

export function SlotModal({ mode, selectedDate, onClose, onCreated }: SlotModalProps) {
  const t = useTranslations('station_config');

  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [capacity, setCapacity] = useState('1');
  const [date, setDate] = useState(selectedDate);
  const [endDate, setEndDate] = useState('');
  const [intervalMin, setIntervalMin] = useState('');
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    { startTime: '08:00', endTime: '09:00', capacity: '1' },
    { startTime: '09:00', endTime: '10:00', capacity: '1' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  function updateBulkRow(idx: number, field: keyof BulkRow, value: string) {
    setBulkRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function addBulkRow() {
    setBulkRows((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, { startTime: last?.endTime ?? '08:00', endTime: last?.endTime ?? '09:00', capacity: '1' }];
    });
  }

  function removeBulkRow(idx: number) {
    setBulkRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleConfirm() {
    if (mode === 'add') {
      if (!date || !startTime || !endTime) {
        setError(true);
        return;
      }
      if (endTime <= startTime) {
        setError(true);
        return;
      }
      const cap = Number(capacity);
      if (!cap || cap < 1) {
        setError(true);
        return;
      }
    }

    setLoading(true);
    setError(false);

    if (mode === 'add') {
      const startISO = `${date}T${startTime}:00`;
      const endISO = `${date}T${endTime}:00`;
      const [ok, data] = await postWithApi('/station/slots', {
        start_time: startISO,
        end_time: endISO,
        capacity: Number(capacity),
      });
      setLoading(false);
      if (ok) {
        const res = data as { data: CreatedSlot };
        onCreated([res.data]);
        onClose();
      } else {
        setError(true);
      }
    } else if (mode === 'generate') {
      const body: Record<string, unknown> = { date };
      if (endDate) body.end_date = endDate;
      if (intervalMin) body.interval_minutes = Number(intervalMin);
      const [ok, data] = await postWithApi('/station/slots/generate', body);
      setLoading(false);
      if (ok) {
        const res = data as { data: CreatedSlot[] };
        onCreated(res.data ?? []);
        onClose();
      } else {
        setError(true);
      }
    } else {
      // bulk mode
      const [ok, data] = await postWithApi('/station/slots/bulk', {
        slots: bulkRows.map((row) => ({
          start_time: `${date}T${row.startTime}:00`,
          end_time: `${date}T${row.endTime}:00`,
          capacity: Number(row.capacity) || 1,
        })),
      });
      setLoading(false);
      if (ok) {
        const res = data as { data: CreatedSlot[] };
        onCreated(res.data ?? []);
        onClose();
      } else {
        setError(true);
      }
    }
  }

  const title = mode === 'add' ? t('modal_add_title') : mode === 'generate' ? t('modal_generate_title') : t('modal_bulk_title');
  const btnLabel = loading
    ? mode === 'generate' ? t('modal_generating') : t('modal_creating')
    : t('modal_btn_confirm');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="w-[380px] rounded-2xl border border-[#E8E4DC] bg-white shadow-2xl dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="flex items-center gap-2.5 border-b border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14]">
          <span className="h-4 w-[3px] rounded-full bg-[#C49A1E]" />
          <span className="text-[14px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{title}</span>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <Field label={t('modal_field_date')}>
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          {mode === 'add' && (
            <>
              <Field label={t('modal_field_start')}>
                <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </Field>
              <Field label={t('modal_field_end')}>
                <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </Field>
              <Field label={t('modal_field_capacity')}>
                <input type="number" min={1} className={inputClass} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </Field>
            </>
          )}

          {mode === 'generate' && (
            <>
              <Field label={t('modal_field_end_date')}>
                <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
              <Field label={t('modal_field_interval')}>
                <input type="number" min={1} className={inputClass} placeholder="30" value={intervalMin} onChange={(e) => setIntervalMin(e.target.value)} />
              </Field>
            </>
          )}

          {mode === 'bulk' && (
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {bulkRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input type="time" className={`${inputClass} flex-1`} value={row.startTime} onChange={(e) => updateBulkRow(idx, 'startTime', e.target.value)} />
                  <span className="text-[11px] text-[#888]">–</span>
                  <input type="time" className={`${inputClass} flex-1`} value={row.endTime} onChange={(e) => updateBulkRow(idx, 'endTime', e.target.value)} />
                  <input type="number" min={1} className={`${inputClass} w-16`} value={row.capacity} onChange={(e) => updateBulkRow(idx, 'capacity', e.target.value)} />
                  {bulkRows.length > 1 && (
                    <button type="button" onClick={() => removeBulkRow(idx)} className="shrink-0 rounded px-1.5 py-1 text-[11px] font-bold text-[#EF4444] hover:bg-[#FEE2E2] dark:hover:bg-[#3A1A1A]">×</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addBulkRow} className="mt-1 self-start rounded-lg border border-[#C49A1E] px-3 py-1 text-[11px] font-bold text-[#C49A1E] hover:bg-[#C49A1E] hover:text-[#0C1209] transition-colors">
                + {t('modal_bulk_add_row')}
              </button>
            </div>
          )}

          {error && (
            <p className="text-[11px] font-semibold" style={{ color: '#EF4444' }}>
              {t('save_error')}
            </p>
          )}
        </div>

        <div className="flex gap-3 border-t border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[8px] border border-[#D8D4C8] py-2.5 text-[12px] font-semibold text-[#666] transition-colors hover:bg-[#F7F6F2] dark:border-[#243020] dark:text-[#8A8A7A] dark:hover:bg-[#0F1A0C]"
          >
            {t('modal_btn_cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-[8px] bg-[#C49A1E] py-2.5 text-[12px] font-bold text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

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

interface SlotModalProps {
  mode: 'add' | 'generate';
  selectedDate: string;
  onClose: () => void;
  onCreated: (slots: CreatedSlot[]) => void;
}

const inputClass =
  'w-full rounded-lg border border-[#E0DCD0] bg-[#F5F5EE] px-3 py-2 text-[13px] text-[#1A1A0A] outline-none focus:border-[#C49A1E] dark:border-[#1A2A14] dark:bg-[#0C1209] dark:text-[#F0EDD4]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-[#888] dark:text-[#8A8A7A]">
        {label}
      </label>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleConfirm() {
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
    } else {
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
    }
  }

  const title = mode === 'add' ? t('modal_add_title') : t('modal_generate_title');
  const btnLabel = loading
    ? mode === 'add' ? t('modal_creating') : t('modal_generating')
    : t('modal_btn_confirm');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[360px] rounded-xl border border-[#E0DCD0] bg-white p-6 shadow-xl dark:border-[#1A2A14] dark:bg-[#182214]">
        <div className="mb-5 text-[15px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
          {title}
        </div>
        <div className="flex flex-col gap-4">
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
        </div>

        {error && (
          <p className="mt-4 text-[11px] font-semibold" style={{ color: '#EF4444' }}>
            {t('save_error')}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#E0DCD0] py-2.5 text-[12px] font-bold text-[#666] dark:border-[#1A2A14] dark:text-[#8A8A7A]"
          >
            {t('modal_btn_cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-[#C49A1E] py-2.5 text-[12px] font-black text-[#0C1209] transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

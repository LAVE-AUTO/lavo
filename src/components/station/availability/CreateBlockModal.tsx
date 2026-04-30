'use client';

import { useState, useEffect, useId } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import type { AvailabilityBlock } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (block: Omit<AvailabilityBlock, 'id'>) => void;
  editingBlock?: AvailabilityBlock | null;
  numBays?: number;
  preselectedDate?: string | null;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function isoToDisplay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getWeekRange(offset: 0 | 1): string[] {
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + offset * 7);
  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function formatWeekLabel(dates: string[]): string {
  if (dates.length === 0) return '';
  const first = new Date(dates[0] + 'T00:00:00');
  const last = new Date(dates[dates.length - 1] + 'T00:00:00');
  return `${first.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

export function CreateBlockModal({
  isOpen,
  onClose,
  onSave,
  editingBlock,
  numBays = 4,
  preselectedDate,
}: Props) {
  const t = useTranslations('station_dashboard');
  const dateInputId = useId();

  const [dates, setDates] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [selectedBays, setSelectedBays] = useState<string[]>([]);
  const [allBays, setAllBays] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens / changes between create vs edit
  useEffect(() => {
    if (!isOpen) return;
    if (editingBlock) {
      setDates(editingBlock.dates);
      setStartTime(editingBlock.startTime);
      setEndTime(editingBlock.endTime);
      const isAll = editingBlock.bayIds.includes('all') || editingBlock.bayIds.length === 0;
      setAllBays(isAll);
      setSelectedBays(isAll ? [] : editingBlock.bayIds);
    } else {
      setDates(preselectedDate ? [preselectedDate] : []);
      setStartTime('12:00');
      setEndTime('13:00');
      setSelectedBays([]);
      setAllBays(false);
    }
    setErrors({});
  }, [isOpen, editingBlock, preselectedDate]);

  function addDate(iso: string) {
    if (!dates.includes(iso)) {
      setDates((prev) => [...prev, iso].sort());
    }
  }

  function addDates(isos: string[]) {
    setDates((prev) => {
      const merged = [...new Set([...prev, ...isos])].sort();
      return merged;
    });
  }

  function removeDate(iso: string) {
    setDates((prev) => prev.filter((d) => d !== iso));
  }

  function toggleBay(bay: string) {
    setAllBays(false);
    setSelectedBays((prev) =>
      prev.includes(bay) ? prev.filter((b) => b !== bay) : [...prev, bay],
    );
  }

  function handleAllBays() {
    setAllBays(true);
    setSelectedBays([]);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (dates.length === 0) newErrors.dates = t('availability_error_missing_dates');
    if (!startTime || !endTime) newErrors.hours = t('availability_error_missing_hours');
    if (startTime >= endTime) newErrors.hours = t('availability_error_end_before_start');
    if (!allBays && selectedBays.length === 0) newErrors.bays = t('availability_error_missing_postes');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    // TODO: connect to API once endpoint is available
    // POST /station/availability-blocks
    onSave({
      dates,
      startTime,
      endTime,
      bayIds: allBays ? ['all'] : selectedBays,
    });
    onClose();
  }

  const thisWeek = getWeekRange(0);
  const nextWeek = getWeekRange(1);
  const bays = Array.from({ length: numBays }, (_, i) => String(i + 1));
  const selectedBaysLabel = allBays
    ? t('availability_block_all_postes')
    : selectedBays.length > 0
    ? selectedBays.map((bay) => `${t('availability_modal_poste')} ${bay}`).join(', ')
    : `—`;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={t(editingBlock ? 'availability_edit_block_title' : 'availability_create_block_modal_title')}
    >
      <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_240px]">
        {/* Left: dates + hours + postes */}
        <div className="space-y-5 p-5">
          {/* Dates */}
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#C09A18]">
              {t('availability_modal_section_dates')}
            </p>
            <p className="mb-3 text-xs text-[#666] dark:text-[#A0A090]">
              {t('availability_modal_dates_hint')}
            </p>

            {/* Selected date pills */}
            {dates.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {dates.map((d) => (
                  <span
                    key={d}
                    className="flex items-center gap-1.5 rounded-full border border-[#C09A18]/30 bg-[#C09A18]/10 px-3 py-1 text-[11px] font-semibold text-[#1A1A0A] dark:bg-[#C09A18]/15 dark:text-[#F0EDD4]"
                  >
                    {isoToDisplay(d)}
                    <button
                      type="button"
                      onClick={() => removeDate(d)}
                      aria-label={`Retirer ${isoToDisplay(d)}`}
                      className="cursor-pointer text-[#666] hover:text-[#FF2525]"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {dates.length > 0 && (
              <button
                type="button"
                onClick={() => setDates([])}
                className="mb-3 cursor-pointer text-xs font-semibold text-[#666] underline decoration-dotted underline-offset-2 transition-colors hover:text-[#FF2525] dark:text-[#A0A090]"
              >
                {t('availability_modal_clear_dates')}
              </button>
            )}

            {/* Add date native input */}
            <label htmlFor={dateInputId} className="sr-only">
              {t('availability_modal_add_date')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id={dateInputId}
                type="date"
                min={todayISO()}
                onChange={(e) => {
                  if (e.target.value) {
                    addDate(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="rounded-xl border border-[#C09A18]/30 bg-[#F0EDE0] px-3 py-2 text-sm text-[#1A1A0A] focus:border-[#C09A18] focus:outline-none dark:bg-[#1E2A1A] dark:text-[#F0EDD4]"
              />
              <span className="text-xs text-[#666] dark:text-[#A0A090]">
                {t('availability_modal_add_date')}
              </span>
            </div>
            {errors.dates && (
              <p className="mt-1 text-xs text-[#FF2525]">{errors.dates}</p>
            )}
          </div>

          {/* Hours */}
          <div>
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#C09A18]">
              {t('availability_modal_section_hours')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#666] dark:text-[#A0A090]">
                  {t('availability_modal_from')}
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-[#C09A18]/30 bg-[#F0EDE0] px-3 py-2 text-sm text-[#1A1A0A] focus:border-[#C09A18] focus:outline-none dark:bg-[#1E2A1A] dark:text-[#F0EDD4]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#666] dark:text-[#A0A090]">
                  {t('availability_modal_to')}
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-[#C09A18]/30 bg-[#F0EDE0] px-3 py-2 text-sm text-[#1A1A0A] focus:border-[#C09A18] focus:outline-none dark:bg-[#1E2A1A] dark:text-[#F0EDD4]"
                />
              </div>
            </div>
            {errors.hours && (
              <p className="mt-1 text-xs text-[#FF2525]">{errors.hours}</p>
            )}
          </div>

          {/* Postes */}
          <div>
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#C09A18]">
              {t('availability_modal_section_postes')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {/* All bays option */}
              <label className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 p-3 transition-colors ${allBays ? 'border-[#C09A18] bg-[#C09A18]/10' : 'border-[#C09A18]/20 bg-[#F0EDE0] dark:bg-[#1E2A1A]'}`}>
                <input
                  type="checkbox"
                  checked={allBays}
                  onChange={handleAllBays}
                  className="accent-[#C09A18]"
                />
                <span className={`text-[13px] font-semibold ${allBays ? 'text-[#C09A18]' : 'text-[#1A1A0A] dark:text-[#F0EDD4]'}`}>
                  {t('availability_block_all_postes')}
                </span>
              </label>
              {bays.map((bay) => (
                <label
                  key={bay}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 p-3 transition-colors ${
                    !allBays && selectedBays.includes(bay)
                      ? 'border-[#C09A18] bg-[#C09A18]/10'
                      : 'border-[#C09A18]/20 bg-[#F0EDE0] dark:bg-[#1E2A1A]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!allBays && selectedBays.includes(bay)}
                    onChange={() => toggleBay(bay)}
                    className="accent-[#C09A18]"
                  />
                  <span
                    className={`text-[13px] font-semibold ${
                      !allBays && selectedBays.includes(bay)
                        ? 'text-[#C09A18]'
                        : 'text-[#666] dark:text-[#A0A090]'
                    }`}
                  >
                    {t('availability_modal_poste')} {bay}
                  </span>
                </label>
              ))}
            </div>
            {errors.bays && (
              <p className="mt-1 text-xs text-[#FF2525]">{errors.bays}</p>
            )}
          </div>
        </div>

        {/* Right: quick dates */}
        <div className="border-t border-[#C09A18]/20 p-5 md:border-t-0 md:border-l dark:border-[#C09A18]/10">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#C09A18]">
            {t('availability_modal_quick_dates')}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => addDate(todayISO())}
              className="cursor-pointer rounded-xl bg-[#F0EDE0] px-3 py-2.5 text-left text-[12px] font-semibold text-[#1A1A0A] transition-colors hover:bg-[#C09A18]/15 dark:bg-[#1E2A1A] dark:text-[#F0EDD4]"
            >
              {t('availability_modal_today')}
            </button>
            <button
              type="button"
              onClick={() => addDate(tomorrowISO())}
              className="cursor-pointer rounded-xl bg-[#F0EDE0] px-3 py-2.5 text-left text-[12px] font-semibold text-[#1A1A0A] transition-colors hover:bg-[#C09A18]/15 dark:bg-[#1E2A1A] dark:text-[#F0EDD4]"
            >
              {t('availability_modal_tomorrow')}
            </button>
            <button
              type="button"
              onClick={() => addDates(thisWeek)}
              className="cursor-pointer rounded-xl bg-[#F0EDE0] px-3 py-2.5 text-left text-[12px] font-semibold text-[#1A1A0A] transition-colors hover:bg-[#C09A18]/15 dark:bg-[#1E2A1A] dark:text-[#F0EDD4]"
            >
              {t('availability_modal_this_week')}
              <span className="mt-0.5 block text-[10px] text-[#666] dark:text-[#A0A090]">
                {formatWeekLabel(thisWeek)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => addDates(nextWeek)}
              className="cursor-pointer rounded-xl bg-[#F0EDE0] px-3 py-2.5 text-left text-[12px] font-semibold text-[#1A1A0A] transition-colors hover:bg-[#C09A18]/15 dark:bg-[#1E2A1A] dark:text-[#F0EDD4]"
            >
              {t('availability_modal_next_week')}
              <span className="mt-0.5 block text-[10px] text-[#666] dark:text-[#A0A090]">
                {formatWeekLabel(nextWeek)}
              </span>
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-[#C09A18]/25 bg-[#C09A18]/8 p-3 dark:bg-[#C09A18]/10">
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#C09A18]">
              {t('availability_modal_summary_title')}
            </p>
            <p className="text-[11px] text-[#666] dark:text-[#A0A090]">
              {t('availability_modal_summary_dates')}: <span className="font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{dates.length}</span>
            </p>
            <p className="text-[11px] text-[#666] dark:text-[#A0A090]">
              {t('availability_modal_summary_hours')}: <span className="font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{startTime} – {endTime}</span>
            </p>
            <p className="text-[11px] text-[#666] dark:text-[#A0A090]">
              {t('availability_modal_summary_postes')}: <span className="font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">{selectedBaysLabel}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 border-t border-[#C09A18]/20 px-5 py-4 dark:border-[#C09A18]/10">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-xl border border-[#C09A18]/30 bg-transparent px-5 py-2.5 text-sm font-bold text-[#666] transition-colors hover:bg-[#C09A18]/10 dark:text-[#A0A090]"
        >
          {t('btn_cancel')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="cursor-pointer rounded-xl bg-[#C09A18] px-5 py-2.5 text-sm font-black text-[#1A1A0A] transition-colors hover:bg-[#a8861a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C09A18] focus-visible:ring-offset-2"
        >
          {t(editingBlock ? 'availability_block_edit' : 'availability_create_block')}
        </button>
      </div>
    </Modal>
  );
}

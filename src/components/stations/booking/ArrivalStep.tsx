'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { StationDetailData, TimeSlot } from '@/types/station';

type ArrivalMode = 'queue_now' | 'queue_later' | 'book_slot';

interface ArrivalStepProps {
  station: StationDetailData;
  arrivalMode: ArrivalMode | null;
  selectedDate: string | null;
  selectedSlot: TimeSlot | null;
  laterTime: string | null;
  onSetMode: (mode: ArrivalMode) => void;
  onSetDate: (date: string) => void;
  onSetSlot: (slot: TimeSlot) => void;
  onSetLaterTime: (time: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

function generateDates(count: number): { key: string; dayShort: string; dateNum: number; full: string }[] {
  const days: { key: string; dayShort: string; dateNum: number; full: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const key = d.toISOString().split('T')[0];
    const dayShort = d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3);
    days.push({ key, dayShort, dateNum: d.getDate(), full: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) });
  }
  return days;
}

function generateTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let h = 8; h <= 18; h++) {
    for (const m of [0, 30]) {
      if (h === 18 && m === 30) break;
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const available = Math.random() > 0.3;
      slots.push({ time, available });
    }
  }
  return slots;
}

const LATER_SUGGESTIONS = ['14:00', '15:00', '16:00', '17:00'];

export function ArrivalStep({ station, arrivalMode, selectedDate, selectedSlot, laterTime, onSetMode, onSetDate, onSetSlot, onSetLaterTime, onContinue, onBack }: ArrivalStepProps) {
  const t = useTranslations('booking');
  const dates = useMemo(() => generateDates(7), []);
  const timeSlots = useMemo(() => generateTimeSlots(), []);

  const canContinue = arrivalMode === 'queue_now'
    || (arrivalMode === 'queue_later' && laterTime)
    || (arrivalMode === 'book_slot' && selectedDate && selectedSlot);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 space-y-4 pb-4">
        <p className="text-[14px] text-[#555] dark:text-[#B0B0A0]">{t('arrival_subtitle')}</p>

        {/* Option 1: Queue */}
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('arrival_queue_title')}</h3>

          {/* Now */}
          <button
            type="button"
            onClick={() => onSetMode('queue_now')}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
              arrivalMode === 'queue_now'
                ? 'border-gold bg-gold/10 dark:bg-gold/5'
                : 'border-[#D0D0C0] dark:border-tab-inactive bg-white/40 dark:bg-dark-bg/40 hover:border-gold/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('arrival_now')}</span>
                <p className="text-[13px] text-[#555] dark:text-[#B0B0A0] mt-0.5">
                  {t('arrival_queue_position', { position: station.queueCount })}
                </p>
              </div>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                arrivalMode === 'queue_now' ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'
              }`}>
                {arrivalMode === 'queue_now' && <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a]" />}
              </span>
            </div>
          </button>

          {/* Later */}
          <button
            type="button"
            onClick={() => onSetMode('queue_later')}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
              arrivalMode === 'queue_later'
                ? 'border-gold bg-gold/10 dark:bg-gold/5'
                : 'border-[#D0D0C0] dark:border-tab-inactive bg-white/40 dark:bg-dark-bg/40 hover:border-gold/30'
            }`}
          >
            <span className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('arrival_later')}</span>
            <p className="text-[13px] text-[#555] dark:text-[#B0B0A0] mt-0.5">{t('arrival_later_desc')}</p>
          </button>

          {/* Time suggestions for later */}
          {arrivalMode === 'queue_later' && (
            <div className="flex gap-2 flex-wrap ml-2">
              {LATER_SUGGESTIONS.map((time) => (
                <button
                  key={time}
                  type="button"
                    onClick={() => onSetLaterTime(time)}
                  className={`px-4 py-2 rounded-lg text-[14px] font-bold border-2 transition-colors cursor-pointer ${
                    laterTime === time
                      ? 'bg-gold border-gold text-dark-bg'
                      : 'border-[#D0D0C0] dark:border-tab-inactive text-[#000C1F] dark:text-[#FFF8EC] hover:border-gold/40'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#D0D0C0] dark:bg-tab-inactive" />
          <span className="text-[13px] font-bold text-[#888]">{t('arrival_or')}</span>
          <div className="flex-1 h-px bg-[#D0D0C0] dark:bg-tab-inactive" />
        </div>

        {/* Option 2: Book a slot */}
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('arrival_book_title')}</h3>

          <button
            type="button"
            onClick={() => onSetMode('book_slot')}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
              arrivalMode === 'book_slot'
                ? 'border-gold bg-gold/10 dark:bg-gold/5'
                : 'border-[#D0D0C0] dark:border-tab-inactive bg-white/40 dark:bg-dark-bg/40 hover:border-gold/30'
            }`}
          >
            <span className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('arrival_book_slot')}</span>
            <p className="text-[13px] text-[#555] dark:text-[#B0B0A0] mt-0.5">{t('arrival_book_desc')}</p>
          </button>

          {/* Date scroller + Time slots */}
          {arrivalMode === 'book_slot' && (
            <div className="space-y-3">
              {/* Horizontal date scroller */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {dates.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => onSetDate(d.key)}
                    className={`flex flex-col items-center min-w-[58px] py-2 px-3 rounded-xl border-2 transition-colors cursor-pointer ${
                      selectedDate === d.key
                        ? 'bg-gold border-gold text-dark-bg'
                        : 'border-[#D0D0C0] dark:border-tab-inactive text-[#000C1F] dark:text-[#FFF8EC] hover:border-gold/40'
                    }`}
                  >
                    <span className={`text-[11px] font-bold uppercase ${selectedDate === d.key ? 'text-dark-bg' : 'text-[#888]'}`}>{d.dayShort}</span>
                    <span className="text-[18px] font-black">{d.dateNum}</span>
                  </button>
                ))}
              </div>

              {/* Time slots grid */}
              {selectedDate && (
                <div className="grid grid-cols-3 gap-2">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => onSetSlot(slot)}
                      className={`py-2.5 rounded-lg text-[14px] font-bold border-2 transition-colors ${
                        !slot.available
                          ? 'border-transparent bg-[#E0E0D0] dark:bg-dark-bg/30 text-[#AAA] dark:text-[#555] cursor-not-allowed opacity-50'
                          : selectedSlot && selectedSlot.time === slot.time
                            ? 'bg-gold border-gold text-dark-bg cursor-pointer'
                            : 'border-[#D0D0C0] dark:border-tab-inactive text-[#000C1F] dark:text-[#FFF8EC] hover:border-gold/40 cursor-pointer'
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-[#D0D0C0] dark:border-tab-inactive pt-4 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 border-2 border-gold rounded-xl text-[15px] font-bold text-gold hover:bg-gold/10 transition-colors cursor-pointer"
        >
          {t('back')}
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className={`flex-1 py-3 rounded-xl text-[15px] font-black transition-colors cursor-pointer ${
            canContinue
              ? 'bg-gold hover:bg-gold-hover text-dark-bg'
              : 'bg-[#D0D0C0] dark:bg-tab-inactive text-[#888] cursor-not-allowed'
          }`}
        >
          {t('continue')}
        </button>
      </div>
    </div>
  );
}

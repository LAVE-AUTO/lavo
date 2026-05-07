'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { StationDetailData, StationConfigPublic, TimeSlot } from '@/types/station';

type ArrivalMode = 'queue_now' | 'queue_later' | 'book_slot';

interface ArrivalStepProps {
  station: StationDetailData;
  stationConfig: StationConfigPublic | null;
  serviceDuration: number;
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

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Can the client join/reserve immediately right now? */
function canJoinNow(config: StationConfigPublic | null, serviceDuration: number): boolean {
  if (!config) return true;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openingMinutes = parseTimeToMinutes(config.openingTime);
  const closingMinutes = parseTimeToMinutes(config.closingTime);
  return currentMinutes >= openingMinutes && currentMinutes + serviceDuration <= closingMinutes;
}

/** Generate valid "later" time slots at 30-min intervals within today's operating window. */
function generateLaterSlots(config: StationConfigPublic | null, serviceDuration: number): string[] {
  if (!config) return ['14:00', '15:00', '16:00', '17:00'];
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openingMinutes = parseTimeToMinutes(config.openingTime);
  const closingMinutes = parseTimeToMinutes(config.closingTime);
  const latestStart = closingMinutes - serviceDuration;
  if (latestStart <= openingMinutes) return [];

  const INTERVAL = 30;
  const startFrom = Math.max(
    openingMinutes,
    Math.ceil((currentMinutes + 1) / INTERVAL) * INTERVAL
  );

  const slots: string[] = [];
  for (let t = startFrom; t <= latestStart; t += INTERVAL) {
    slots.push(minutesToHHMM(t));
  }
  return slots;
}

function generateDates(count: number, appLocale: string): { key: string; dayShort: string; dateNum: number }[] {
  const days: { key: string; dayShort: string; dateNum: number }[] = [];
  const now = new Date();
  const dateFmtLocale = appLocale === 'en' ? 'en-CA' : 'fr-FR';
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const key = toLocalDateKey(d);
    const dayShort = d.toLocaleDateString(dateFmtLocale, { weekday: 'short' }).slice(0, 3);
    days.push({ key, dayShort, dateNum: d.getDate() });
  }
  return days;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function ArrivalStep({
  station,
  stationConfig,
  serviceDuration,
  arrivalMode,
  selectedDate,
  selectedSlot,
  laterTime,
  onSetMode,
  onSetDate,
  onSetSlot,
  onSetLaterTime,
  onContinue,
  onBack,
}: ArrivalStepProps) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const dates = useMemo(() => generateDates(7, locale), [locale]);

  const nowPossible = useMemo(() => canJoinNow(stationConfig, serviceDuration), [stationConfig, serviceDuration]);
  const laterSlots = useMemo(() => generateLaterSlots(stationConfig, serviceDuration), [stationConfig, serviceDuration]);

  const timeSlots = useMemo(() => {
    if (!selectedDate || arrivalMode !== 'book_slot') return station.timeSlots;
    return station.timeSlots.filter((s) => s.date === selectedDate);
  }, [station.timeSlots, selectedDate, arrivalMode]);

  const [openSection, setOpenSection] = useState<'queue' | 'book' | null>(() => {
    if (arrivalMode === 'book_slot') return 'book';
    if (arrivalMode === 'queue_now' || arrivalMode === 'queue_later') return 'queue';
    return null;
  });

  const toggleSection = (section: 'queue' | 'book') => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  const isQueueOpen = openSection === 'queue';
  const isBookOpen = openSection === 'book';

  const canContinue =
    (arrivalMode === 'queue_now' && nowPossible) ||
    (arrivalMode === 'queue_later' && !!laterTime) ||
    (arrivalMode === 'book_slot' && !!selectedDate && !!selectedSlot);

  const myQueuePosition = station.queueCount + 1;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 space-y-3 pb-4">
        <p className="text-[14px] text-[#555] dark:text-[#B0B0A0]">{t('arrival_subtitle')}</p>

        {/* ── Section 1: Queue ── */}
        <div className="rounded-xl border-2 overflow-hidden transition-colors border-[#D0D0C0] dark:border-tab-inactive">
          <button
            type="button"
            onClick={() => toggleSection('queue')}
            className={`w-full flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors ${
              isQueueOpen ? 'bg-gold/10 dark:bg-gold/5' : 'bg-white/40 dark:bg-dark-bg/40 hover:bg-gold/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                (arrivalMode === 'queue_now' || arrivalMode === 'queue_later') ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'
              }`}>
                {(arrivalMode === 'queue_now' || arrivalMode === 'queue_later') && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a]" />
                )}
              </div>
              <span className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">
                {t('arrival_queue_title')}
              </span>
            </div>
            <span className={isQueueOpen ? 'text-gold' : 'text-[#888]'}>
              <ChevronIcon open={isQueueOpen} />
            </span>
          </button>

          {isQueueOpen && (
            <div className="px-4 pb-4 pt-3 space-y-3 bg-white/20 dark:bg-dark-bg/20">
              {/* Queue position card */}
              <div className="rounded-xl bg-[#E8E8D8] dark:bg-dark-card border border-[#D0D0C0] dark:border-tab-inactive p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-lavo-success animate-pulse shrink-0" />
                  <span className="text-[12px] font-bold text-[#555] dark:text-[#A0A090] uppercase tracking-wider">
                    {t('arrival_queue_status')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white/50 dark:bg-dark-bg/40 rounded-lg p-3">
                    <div className="text-[26px] font-black text-[#000C1F] dark:text-[#FFF8EC] leading-none">{station.queueCount}</div>
                    <div className="text-[12px] text-[#555] dark:text-[#B0B0A0] mt-1">{t('arrival_queue_waiting')}</div>
                  </div>
                  <div className="bg-gold/10 dark:bg-gold/8 rounded-lg p-3 border border-gold/20">
                    <div className="text-[26px] font-black text-gold leading-none">#{myQueuePosition}</div>
                    <div className="text-[12px] text-[#555] dark:text-[#B0B0A0] mt-1">{t('arrival_queue_your_position')}</div>
                  </div>
                </div>
              </div>

              {/* Now option */}
              <button
                type="button"
                onClick={() => nowPossible && onSetMode('queue_now')}
                disabled={!nowPossible}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                  !nowPossible
                    ? 'border-[#E0E0D0] dark:border-tab-inactive bg-[#F0F0E0] dark:bg-dark-bg/20 opacity-60 cursor-not-allowed'
                    : arrivalMode === 'queue_now'
                      ? 'border-gold bg-gold/10 dark:bg-gold/5 cursor-pointer'
                      : 'border-[#D0D0C0] dark:border-tab-inactive bg-white/40 dark:bg-dark-bg/40 hover:border-gold/30 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('arrival_now')}</span>
                    <p className="text-[13px] text-[#555] dark:text-[#B0B0A0] mt-0.5">
                      {nowPossible
                        ? t('arrival_queue_position', { position: myQueuePosition })
                        : t('arrival_immediate_not_possible')}
                    </p>
                  </div>
                  {nowPossible && (
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      arrivalMode === 'queue_now' ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'
                    }`}>
                      {arrivalMode === 'queue_now' && <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a]" />}
                    </span>
                  )}
                </div>
              </button>

              {/* Later option */}
              <button
                type="button"
                onClick={() => laterSlots.length > 0 && onSetMode('queue_later')}
                disabled={laterSlots.length === 0}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                  laterSlots.length === 0
                    ? 'border-[#E0E0D0] dark:border-tab-inactive bg-[#F0F0E0] dark:bg-dark-bg/20 opacity-60 cursor-not-allowed'
                    : arrivalMode === 'queue_later'
                      ? 'border-gold bg-gold/10 dark:bg-gold/5 cursor-pointer'
                      : 'border-[#D0D0C0] dark:border-tab-inactive bg-white/40 dark:bg-dark-bg/40 hover:border-gold/30 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">{t('arrival_later')}</span>
                    <p className="text-[13px] text-[#555] dark:text-[#B0B0A0] mt-0.5">
                      {laterSlots.length === 0 ? t('arrival_no_later_slots') : t('arrival_later_desc')}
                    </p>
                  </div>
                  {laterSlots.length > 0 && (
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      arrivalMode === 'queue_later' ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'
                    }`}>
                      {arrivalMode === 'queue_later' && <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a]" />}
                    </span>
                  )}
                </div>
              </button>

              {/* Time chips for later */}
              {arrivalMode === 'queue_later' && laterSlots.length > 0 && (
                <div className="flex gap-2 flex-wrap ml-1">
                  {laterSlots.map((time) => (
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
          )}
        </div>

        {/* ── Section 2: Book a slot ── */}
        <div className="rounded-xl border-2 overflow-hidden transition-colors border-[#D0D0C0] dark:border-tab-inactive">
          <button
            type="button"
            onClick={() => toggleSection('book')}
            className={`w-full flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors ${
              isBookOpen ? 'bg-gold/10 dark:bg-gold/5' : 'bg-white/40 dark:bg-dark-bg/40 hover:bg-gold/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                arrivalMode === 'book_slot' ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'
              }`}>
                {arrivalMode === 'book_slot' && <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a]" />}
              </div>
              <span className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC]">
                {t('arrival_book_title')}
              </span>
            </div>
            <span className={isBookOpen ? 'text-gold' : 'text-[#888]'}>
              <ChevronIcon open={isBookOpen} />
            </span>
          </button>

          {isBookOpen && (
            <div className="px-4 pb-4 pt-3 space-y-3 bg-white/20 dark:bg-dark-bg/20">
              <p className="text-[13px] text-[#555] dark:text-[#B0B0A0]">{t('arrival_book_desc')}</p>

              {/* Date scroller */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {dates.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => { onSetDate(d.key); onSetMode('book_slot'); }}
                    className={`flex flex-col items-center min-w-[58px] py-2 px-3 rounded-xl border-2 transition-colors cursor-pointer ${
                      selectedDate === d.key && arrivalMode === 'book_slot'
                        ? 'bg-gold border-gold text-dark-bg'
                        : 'border-[#D0D0C0] dark:border-tab-inactive text-[#000C1F] dark:text-[#FFF8EC] hover:border-gold/40'
                    }`}
                  >
                    <span className={`text-[11px] font-bold uppercase ${selectedDate === d.key && arrivalMode === 'book_slot' ? 'text-dark-bg' : 'text-[#888]'}`}>
                      {d.dayShort}
                    </span>
                    <span className="text-[18px] font-black">{d.dateNum}</span>
                  </button>
                ))}
              </div>

              {/* Time slots grid */}
              {selectedDate && arrivalMode === 'book_slot' && (
                <>
                  {timeSlots.length === 0 ? (
                    <p className="text-[13px] text-[#888] dark:text-[#888] text-center py-3">{t('arrival_no_slots_for_date')}</p>
                  ) : (
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
                </>
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

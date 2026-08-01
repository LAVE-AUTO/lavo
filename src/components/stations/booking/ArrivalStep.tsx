'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getFromApi } from '@/services/axios-service';
import { formatMoneyPrefix } from '@/helpers/money';
import { formatStationTime, stationNowMinutes } from '@/helpers/station-time';
import type { StationDetailData, StationConfigPublic, TimeSlot } from '@/types/station';

type ArrivalMode = 'queue_now' | 'queue_later' | 'book_slot';

interface AvailabilitySlot {
  start_time: string;
  end_time: string;
}

interface AvailabilityResponse {
  data: {
    date: string;
    duration_min: number;
    slots: AvailabilitySlot[];
    closed_reason?: 'day_closed' | 'exception' | 'no_active_post';
  };
}

interface ArrivalStepProps {
  station: StationDetailData;
  stationConfig: StationConfigPublic | null;
  serviceDuration: number;
  /** Base service + extras price (without reservation surcharge). */
  serviceBasePrice: number;
  /** Surcharge added only for slot reservations. Null = not configured. */
  reservationSurcharge: number | null;
  arrivalMode: ArrivalMode | null;
  selectedDate: string | null;
  selectedSlot: TimeSlot | null;
  laterTime: string | null;
  /** Service id used to query the per-post availability endpoint. */
  serviceId: string | null;
  /** Vehicle format id (only for hand_wash services). */
  vehicleFormatId: string | null;
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

/** Can the client join/reserve immediately right now?
 * Station opening hours are wall times in the station timezone, so "now" is
 * evaluated there too — a visitor in another timezone sees the same reality. */
function canJoinNow(config: StationConfigPublic | null, serviceDuration: number): boolean {
  if (!config) return true;
  const currentMinutes = stationNowMinutes();
  const openingMinutes = parseTimeToMinutes(config.openingTime);
  const closingMinutes = parseTimeToMinutes(config.closingTime);
  return currentMinutes >= openingMinutes && currentMinutes + serviceDuration <= closingMinutes;
}

/** Generate valid "later" time slots at 30-min intervals within today's operating window. */
function generateLaterSlots(config: StationConfigPublic | null, serviceDuration: number): string[] {
  if (!config) return ['14:00', '15:00', '16:00', '17:00'];
  const currentMinutes = stationNowMinutes();
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

function generateDates(count: number, appLocale: string): { key: string; dayShort: string; dateNum: number; monthShort: string; dayOfWeek: number }[] {
  const days: { key: string; dayShort: string; dateNum: number; monthShort: string; dayOfWeek: number }[] = [];
  const now = new Date();
  const dateFmtLocale = appLocale === 'en' ? 'en-CA' : 'fr-FR';
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const key = toLocalDateKey(d);
    const dayShort = d.toLocaleDateString(dateFmtLocale, { weekday: 'short' }).slice(0, 3);
    const monthShort = d.toLocaleDateString(dateFmtLocale, { month: 'short' }).slice(0, 4);
    days.push({ key, dayShort, dateNum: d.getDate(), monthShort, dayOfWeek: d.getDay() });
  }
  return days;
}

/** Stripe card authorizations expire after 7 days, so the backend rejects any
 * booking beyond that window (see MAX_ADVANCE_BOOKING_DAYS in constants.ts).
 * The visible date range must match, otherwise clients can pick a date the
 * server will then refuse. */
const MAX_BOOKING_DAYS = 7;

interface MonthGridDay {
  key: string;
  dateNum: number;
  inMonth: boolean;
  bookable: boolean;
  isToday: boolean;
  dayOfWeek: number;
}

/** Build a 6×7 calendar grid for a given (year, month). Days outside the
 * requested booking window are rendered greyed out (`bookable=false`). */
function buildMonthGrid(year: number, month: number, todayKey: string, maxDate: Date): MonthGridDay[] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
  const startDate = new Date(year, month, 1 - startWeekday);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: MonthGridDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = toLocalDateKey(d);
    const inMonth = d.getMonth() === month;
    const bookable = d >= today && d <= maxDate;
    cells.push({ key, dateNum: d.getDate(), inMonth, bookable, isToday: key === todayKey, dayOfWeek: d.getDay() });
  }
  return cells;
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
  serviceBasePrice,
  reservationSurcharge,
  arrivalMode,
  selectedDate,
  selectedSlot,
  laterTime,
  serviceId,
  vehicleFormatId,
  onSetMode,
  onSetDate,
  onSetSlot,
  onSetLaterTime,
  onContinue,
  onBack,
}: ArrivalStepProps) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const dates = useMemo(() => generateDates(MAX_BOOKING_DAYS, locale), [locale]);

  /* Days of the week the station is closed (0 = Sunday … 6 = Saturday).
   * Used to greyed-out closed days in both the horizontal strip and the
   * month-view grid so the client cannot pick an unbookable date. */
  const closedDows = useMemo(() => {
    const set = new Set<number>();
    for (const h of station.stationHours ?? []) {
      if (!h.isOpen) set.add(h.dayOfWeek);
    }
    return set;
  }, [station.stationHours]);

  /* Per-post availability fetched when the user picks a date in book_slot mode.
   * Replaces the legacy `station.timeSlots` (pre-generated slots). The server
   * computes free chunks across all active wash bays for the requested date
   * and service duration; post selection happens server-side at booking. */
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityClosedReason, setAvailabilityClosedReason] = useState<string | null>(null);

  useEffect(() => {
    if (arrivalMode !== 'book_slot' || !selectedDate || !serviceId) {
      setAvailability([]);
      setAvailabilityClosedReason(null);
      return;
    }
    let cancelled = false;
    setAvailabilityLoading(true);
    setAvailabilityClosedReason(null);
    const params = new URLSearchParams({
      date: selectedDate,
      service_id: serviceId,
    });
    if (vehicleFormatId) params.set('vehicle_format_id', vehicleFormatId);

    getFromApi<AvailabilityResponse>(`/stations/${station.id}/availability?${params.toString()}`)
      .then(([ok, data]) => {
        if (cancelled) return;
        if (!ok || !data || !('data' in (data as object))) {
          setAvailability([]);
          setAvailabilityClosedReason(null);
          return;
        }
        const payload = (data as AvailabilityResponse).data;
        setAvailability(payload.slots ?? []);
        setAvailabilityClosedReason(payload.closed_reason ?? null);
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });
    return () => { cancelled = true; };
  }, [arrivalMode, selectedDate, serviceId, vehicleFormatId, station.id]);

  const [monthViewOpen, setMonthViewOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const monthGrid = useMemo(() => {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + MAX_BOOKING_DAYS - 1);
    return buildMonthGrid(monthCursor.year, monthCursor.month, toLocalDateKey(today), maxDate);
  }, [monthCursor]);
  const monthLabel = useMemo(() => {
    const dateFmtLocale = locale === 'en' ? 'en-CA' : 'fr-FR';
    return new Date(monthCursor.year, monthCursor.month, 1).toLocaleDateString(dateFmtLocale, {
      month: 'long', year: 'numeric',
    });
  }, [locale, monthCursor]);
  const weekdayHeaders = useMemo(() => {
    const dateFmtLocale = locale === 'en' ? 'en-CA' : 'fr-FR';
    /* Iterate from a known Monday (2024-01-01) to derive 1-letter weekday labels. */
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, 1 + i);
      return d.toLocaleDateString(dateFmtLocale, { weekday: 'short' }).slice(0, 1).toUpperCase();
    });
  }, [locale]);

  const shiftMonth = (dir: -1 | 1) => {
    setMonthCursor((c) => {
      let m = c.month + dir;
      let y = c.year;
      if (m < 0) { m = 11; y -= 1; }
      else if (m > 11) { m = 0; y += 1; }
      return { year: y, month: m };
    });
  };

  /* Custom time entered manually in the queue_later flow. Validated against
   * the station's operating window before being applied. */
  const [customTime, setCustomTime] = useState('');
  const [customTimeError, setCustomTimeError] = useState<string | null>(null);

  const applyCustomTime = () => {
    if (!customTime) return;
    const minutes = parseTimeToMinutes(customTime);
    const config = stationConfig;
    const currentMinutes = stationNowMinutes();
    const opening = config ? parseTimeToMinutes(config.openingTime) : 0;
    const closing = config ? parseTimeToMinutes(config.closingTime) : 24 * 60;
    if (minutes <= currentMinutes) {
      setCustomTimeError(t('arrival_custom_time_past'));
      return;
    }
    if (minutes < opening || minutes + serviceDuration > closing) {
      setCustomTimeError(t('arrival_custom_time_out_of_range'));
      return;
    }
    setCustomTimeError(null);
    onSetLaterTime(customTime);
  };

  const nowPossible = useMemo(() => canJoinNow(stationConfig, serviceDuration), [stationConfig, serviceDuration]);
  const laterSlots = useMemo(() => generateLaterSlots(stationConfig, serviceDuration), [stationConfig, serviceDuration]);

  /* Map availability slots returned by the API to the legacy TimeSlot shape so
   * downstream code can keep a single representation. We synthesise a stable
   * per-row id from the start_time; the back-end picks the actual post and
   * creates the underlying time_slots row at booking time. */
  const timeSlotsFromAvailability = useMemo<TimeSlot[]>(() => {
    if (!selectedDate || arrivalMode !== 'book_slot') return [];
    return availability.map((s) => ({
      id: s.start_time,
      date: selectedDate,
      /* Wall time in the station timezone — never the visitor's local time,
       * otherwise slots appear shifted (e.g. 08:10 rendered as 04:10). */
      time: formatStationTime(s.start_time),
      available: true,
    }));
  }, [availability, selectedDate, arrivalMode]);

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
        <p className="text-[14px] text-foreground/70">{t('arrival_subtitle')}</p>

        {/* ── Section 1: Queue ── */}
        <div className="rounded-xl border-2 overflow-hidden transition-colors border-border">
          <button
            type="button"
            onClick={() => toggleSection('queue')}
            className={`w-full flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors ${
              isQueueOpen ? 'bg-gold/10 dark:bg-gold/5' : 'bg-white/40 dark:bg-background/40 hover:bg-gold/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                (arrivalMode === 'queue_now' || arrivalMode === 'queue_later') ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'
              }`}>
                {(arrivalMode === 'queue_now' || arrivalMode === 'queue_later') && (
                  <span className="w-2.5 h-2.5 rounded-full bg-dark-bg" />
                )}
              </div>
              <div>
                <span className="text-[15px] font-bold text-foreground">
                  {t('arrival_queue_title')}
                </span>
                {serviceBasePrice > 0 && (
                  <span className="ml-2 text-[13px] font-black text-gold">
                    {formatMoneyPrefix(serviceBasePrice)}
                  </span>
                )}
              </div>
            </div>
            <span className={isQueueOpen ? 'text-gold' : 'text-foreground/55'}>
              <ChevronIcon open={isQueueOpen} />
            </span>
          </button>

          {isQueueOpen && (
            <div className="px-4 pb-4 pt-3 space-y-3 bg-white/20 dark:bg-background/20">
              {/* Queue position card */}
              <div className="rounded-xl bg-surface border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-Hurryline-success animate-pulse shrink-0" />
                  <span className="text-[12px] font-bold text-foreground/70 dark:text-[#B0BFB1] uppercase tracking-wider">
                    {t('arrival_queue_status')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white/50 dark:bg-background/40 rounded-lg p-3">
                    <div className="text-[26px] font-black text-foreground leading-none">{station.queueCount}</div>
                    <div className="text-[12px] text-foreground/70 mt-1">{t('arrival_queue_waiting')}</div>
                  </div>
                  <div className="bg-gold/10 dark:bg-gold/8 rounded-lg p-3 border border-gold/20">
                    <div className="text-[26px] font-black text-gold leading-none">#{myQueuePosition}</div>
                    <div className="text-[12px] text-foreground/70 mt-1">{t('arrival_queue_your_position')}</div>
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
                    ? 'border-[#E0E0D0] dark:border-border bg-[#F0F0E0] dark:bg-background/20 opacity-60 cursor-not-allowed'
                    : arrivalMode === 'queue_now'
                      ? 'border-gold bg-gold/10 dark:bg-gold/5 cursor-pointer'
                      : 'border-border bg-white/40 dark:bg-background/40 hover:border-gold/30 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[15px] font-bold text-foreground">{t('arrival_now')}</span>
                    <p className="text-[13px] text-foreground/70 mt-0.5">
                      {nowPossible
                        ? t('arrival_queue_position', { position: myQueuePosition })
                        : t('arrival_immediate_not_possible')}
                    </p>
                  </div>
                  {nowPossible && (
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      arrivalMode === 'queue_now' ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'
                    }`}>
                      {arrivalMode === 'queue_now' && <span className="w-2.5 h-2.5 rounded-full bg-dark-bg" />}
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
                    ? 'border-[#E0E0D0] dark:border-border bg-[#F0F0E0] dark:bg-background/20 opacity-60 cursor-not-allowed'
                    : arrivalMode === 'queue_later'
                      ? 'border-gold bg-gold/10 dark:bg-gold/5 cursor-pointer'
                      : 'border-border bg-white/40 dark:bg-background/40 hover:border-gold/30 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[15px] font-bold text-foreground">{t('arrival_later')}</span>
                    <p className="text-[13px] text-foreground/70 mt-0.5">
                      {laterSlots.length === 0 ? t('arrival_no_later_slots') : t('arrival_later_desc')}
                    </p>
                  </div>
                  {laterSlots.length > 0 && (
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      arrivalMode === 'queue_later' ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'
                    }`}>
                      {arrivalMode === 'queue_later' && <span className="w-2.5 h-2.5 rounded-full bg-dark-bg" />}
                    </span>
                  )}
                </div>
              </button>

              {/* Time chips for later */}
              {arrivalMode === 'queue_later' && laterSlots.length > 0 && (
                <div className="space-y-2.5 ml-1">
                  <div className="flex gap-2 flex-wrap">
                    {laterSlots.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => { setCustomTime(''); setCustomTimeError(null); onSetLaterTime(time); }}
                        className={`px-4 py-2 rounded-lg text-[16px] font-bebas tracking-wider border-2 transition-colors cursor-pointer ${
                          laterTime === time
                            ? 'bg-gold border-gold text-dark-bg'
                            : 'border-border text-foreground hover:border-gold/40'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>

                  {/* Custom time entry */}
                  <div className="rounded-xl border border-dashed border-border bg-white/40 dark:bg-background/30 px-3 py-2.5">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-foreground/70 dark:text-[#B0BFB1] mb-1.5">
                      {t('arrival_custom_time_label')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => { setCustomTime(e.target.value); setCustomTimeError(null); }}
                        className="flex-1 px-3 py-2 rounded-lg border-2 border-border bg-white dark:bg-background/40 text-[14px] font-mono text-foreground focus:border-gold outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={applyCustomTime}
                        disabled={!customTime}
                        className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-colors ${
                          customTime
                            ? 'bg-gold text-dark-bg hover:bg-gold-hover cursor-pointer'
                            : 'bg-surface dark:bg-tab-inactive text-foreground/55 cursor-not-allowed'
                        }`}
                      >
                        {t('arrival_custom_time_apply')}
                      </button>
                    </div>
                    {customTimeError && (
                      <p className="text-[12px] text-Hurryline-error mt-1.5">{customTimeError}</p>
                    )}
                    {laterTime && customTime === laterTime && !customTimeError && (
                      <p className="text-[12px] text-Hurryline-success mt-1.5">
                        {t('arrival_custom_time_confirmed', { time: laterTime })}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Section 2: Book a slot ── */}
        <div className="rounded-xl border-2 overflow-hidden transition-colors border-border">
          <button
            type="button"
            onClick={() => toggleSection('book')}
            className={`w-full flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors ${
              isBookOpen ? 'bg-gold/10 dark:bg-gold/5' : 'bg-white/40 dark:bg-background/40 hover:bg-gold/5'
            }`}
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                arrivalMode === 'book_slot' ? 'border-gold bg-gold' : 'border-[#BBB] dark:border-[#555]'
              }`}>
                {arrivalMode === 'book_slot' && <span className="w-2.5 h-2.5 rounded-full bg-dark-bg" />}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-bold text-foreground">
                  {t('arrival_book_title')}
                </span>
                {serviceBasePrice > 0 && (
                  <span className="text-[13px] font-black text-gold">
                    {formatMoneyPrefix(serviceBasePrice + (reservationSurcharge ?? 0))}
                  </span>
                )}
                {reservationSurcharge != null && reservationSurcharge > 0 && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30">
                    +{formatMoneyPrefix(reservationSurcharge)} {t('arrival_surcharge_label')}
                  </span>
                )}
              </div>
            </div>
            <span className={`${isBookOpen ? 'text-gold' : 'text-foreground/55'} shrink-0`}>
              <ChevronIcon open={isBookOpen} />
            </span>
          </button>

          {isBookOpen && (
            <div className="px-4 pb-4 pt-3 space-y-3 bg-white/20 dark:bg-background/20">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] text-foreground/70">{t('arrival_book_desc')}</p>
                <button
                  type="button"
                  onClick={() => setMonthViewOpen((v) => !v)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors cursor-pointer ${
                    monthViewOpen ? 'bg-gold text-dark-bg' : 'bg-surface text-foreground hover:bg-gold/15'
                  }`}
                  aria-expanded={monthViewOpen}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {monthViewOpen ? t('arrival_month_close') : t('arrival_month_open')}
                </button>
              </div>

              {/* Month grid (toggleable, up to 5 weeks ahead) */}
              {monthViewOpen && (
                <div className="rounded-xl bg-white dark:bg-surface border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => shiftMonth(-1)}
                      className="w-7 h-7 rounded-full bg-surface/60 dark:bg-tab-inactive flex items-center justify-center text-foreground hover:bg-gold/15 cursor-pointer"
                      aria-label={t('arrival_month_prev')}
                    >
                      &#8249;
                    </button>
                    <span className="text-[14px] font-black text-foreground capitalize">
                      {monthLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => shiftMonth(1)}
                      className="w-7 h-7 rounded-full bg-surface/60 dark:bg-tab-inactive flex items-center justify-center text-foreground hover:bg-gold/15 cursor-pointer"
                      aria-label={t('arrival_month_next')}
                    >
                      &#8250;
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-[10px] font-bold uppercase tracking-wider text-foreground/55">
                    {weekdayHeaders.map((w, i) => (
                      <div key={i} className="text-center py-1">{w}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {monthGrid.map((cell) => {
                      const isSelected = selectedDate === cell.key && arrivalMode === 'book_slot';
                      const isClosed = cell.bookable && closedDows.has(cell.dayOfWeek);
                      const disabled = !cell.bookable || isClosed;
                      return (
                        <button
                          key={cell.key}
                          type="button"
                          disabled={disabled}
                          onClick={() => { if (disabled) return; onSetDate(cell.key); onSetMode('book_slot'); setMonthViewOpen(false); }}
                          className={`relative aspect-square rounded-lg text-[13px] font-bold transition-colors ${
                            !cell.bookable
                              ? 'text-[#CCC] dark:text-[#444] cursor-not-allowed'
                              : isClosed
                                ? 'text-[#999] dark:text-foreground/65 bg-surface/60 dark:bg-background/40 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-gold text-dark-bg cursor-pointer'
                                  : cell.isToday
                                    ? 'bg-gold/15 text-gold border border-gold/40 cursor-pointer hover:bg-gold/25'
                                    : `${cell.inMonth ? 'text-foreground' : 'text-[#999] dark:text-foreground/65'} hover:bg-gold/15 cursor-pointer`
                          }`}
                          aria-label={isClosed ? t('arrival_closed_badge') : undefined}
                        >
                          {isClosed && (
                            <span className="absolute top-1 left-1/2 -translate-x-1/2 px-1 rounded-full bg-Hurryline-error text-white text-[7px] font-black uppercase tracking-wider leading-tight">
                              {t('arrival_closed_badge')}
                            </span>
                          )}
                          <span className={isClosed ? 'line-through opacity-60' : ''}>{cell.dateNum}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Date scroller (5-week horizontal strip) */}
              <div className="flex gap-2 overflow-x-auto pt-2 pb-2 scrollbar-hide">
                {dates.map((d) => {
                  const isClosed = closedDows.has(d.dayOfWeek);
                  const isSelected = selectedDate === d.key && arrivalMode === 'book_slot';
                  return (
                    <button
                      key={d.key}
                      type="button"
                      disabled={isClosed}
                      onClick={() => { if (isClosed) return; onSetDate(d.key); onSetMode('book_slot'); }}
                      className={`relative flex flex-col items-center min-w-[58px] py-2 px-3 rounded-xl border-2 transition-colors ${
                        isClosed
                          ? 'border-border bg-[#E5E5D5]/60 dark:bg-background/40 text-[#999] dark:text-foreground/65 cursor-not-allowed'
                          : isSelected
                            ? 'bg-gold border-gold text-dark-bg cursor-pointer'
                            : 'border-border text-foreground hover:border-gold/40 cursor-pointer'
                      }`}
                      aria-label={isClosed ? t('arrival_closed_badge') : undefined}
                    >
                      {isClosed && (
                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1.5 py-px rounded-full bg-Hurryline-error text-white text-[9px] font-black uppercase tracking-wider">
                          {t('arrival_closed_badge')}
                        </span>
                      )}
                      <span className={`text-[11px] font-bold uppercase ${isClosed ? 'text-[#AAA] dark:text-foreground/65' : isSelected ? 'text-dark-bg' : 'text-foreground/55'}`}>
                        {d.dayShort}
                      </span>
                      <span className={`text-[18px] font-black ${isClosed ? 'line-through opacity-60' : ''}`}>{d.dateNum}</span>
                      <span className={`text-[10px] font-semibold uppercase ${isClosed ? 'text-[#AAA] dark:text-foreground/65' : isSelected ? 'text-dark-bg/80' : 'text-[#999]'}`}>
                        {d.monthShort}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Time slots grid (from per-post availability endpoint) */}
              {selectedDate && arrivalMode === 'book_slot' && (
                <>
                  {availabilityLoading ? (
                    <p className="text-[13px] text-foreground/55 text-center py-3">{t('arrival_loading_slots')}</p>
                  ) : availabilityClosedReason === 'day_closed' || availabilityClosedReason === 'exception' ? (
                    <p className="text-[13px] text-foreground/55 text-center py-3">{t('arrival_day_closed')}</p>
                  ) : availabilityClosedReason === 'no_active_post' ? (
                    <p className="text-[13px] text-foreground/55 text-center py-3">{t('arrival_no_active_post')}</p>
                  ) : timeSlotsFromAvailability.length === 0 ? (
                    <p className="text-[13px] text-foreground/55 text-center py-3">{t('arrival_no_slots_for_date')}</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlotsFromAvailability.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => onSetSlot(slot)}
                          className={`py-2.5 rounded-lg text-[16px] font-bebas tracking-wider border-2 transition-colors cursor-pointer ${
                            selectedSlot && selectedSlot.id === slot.id
                              ? 'bg-gold border-gold text-dark-bg'
                              : 'border-border text-foreground hover:border-gold/40'
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
      <div className="border-t border-border pt-4 flex gap-3">
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
              : 'bg-[#D0D0C0] dark:bg-tab-inactive text-foreground/55 cursor-not-allowed'
          }`}
        >
          {t('continue')}
        </button>
      </div>
    </div>
  );
}

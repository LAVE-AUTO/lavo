'use client';

import { useState, useEffect, useId } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { intlDateLocale } from '@/helpers/date-helper';
import { Modal } from '@/components/ui/Modal';
import type { AvailabilityBlock } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (block: Omit<AvailabilityBlock, 'id'>) => void;
  editingBlock?: AvailabilityBlock | null;
  numBays?: number;
  /** Real station posts. When provided, the multi-select emits post IDs in `bayIds`
   *  ('all' when every post is selected). Falls back to synthetic 1..numBays labels. */
  posts?: { id: string; position: number }[];
  /** Post pre-checked when opening a fresh block (usually the post being viewed). */
  defaultPostId?: string | null;
  /** Station opening hours — used to pre-fill the time range on a new block. */
  defaultStartTime?: string;
  defaultEndTime?: string;
  /** When set, the block targets this single post (selector hidden, shown read-only). */
  lockedPostLabel?: string;
  preselectedDate?: string | null;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToDisplay(iso: string, locale: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(intlDateLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' });
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Full week (Monday → Sunday) for the current week (offset 0) or next week (offset 1). */
function getWeekRange(offset: 0 | 1): string[] {
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + offset * 7);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(toISODate(d));
  }
  return dates;
}

/** Every day of the month at the given offset from the current month (0 = this month). */
function getMonthRange(offset: number): string[] {
  const base = new Date();
  const year = base.getFullYear();
  const monthIdx = base.getMonth() + offset;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(toISODate(new Date(year, monthIdx, d)));
  }
  return dates;
}

/** Every day from today through the end of the (count-1)th month ahead. */
function getNextMonthsRange(count: number): string[] {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth() + count, 0); // last day of (current + count - 1)
  const dates: string[] = [];
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (cursor <= end) {
    dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

function formatWeekLabel(dates: string[], locale: string): string {
  if (dates.length === 0) return '';
  const first = new Date(dates[0] + 'T00:00:00');
  const last = new Date(dates[dates.length - 1] + 'T00:00:00');
  const fmt = intlDateLocale(locale);
  return `${first.toLocaleDateString(fmt, { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString(fmt, { day: 'numeric', month: 'short' })}`;
}

export function CreateBlockModal({
  isOpen,
  onClose,
  onSave,
  editingBlock,
  numBays = 4,
  posts,
  defaultPostId,
  defaultStartTime = '08:00',
  defaultEndTime = '18:00',
  lockedPostLabel,
  preselectedDate,
}: Props) {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();

  /* Selectable posts. Prefer the real station posts (value = post id) so the
   * parent can create slots per post; fall back to synthetic 1..numBays labels. */
  const postOptions = (posts && posts.length > 0)
    ? posts.map((p) => ({ value: p.id, label: `${t('availability_modal_poste')} ${p.position}` }))
    : Array.from({ length: numBays }, (_, i) => ({ value: String(i + 1), label: `${t('availability_modal_poste')} ${i + 1}` }));
  const postCount = postOptions.length;
  // Monday-first narrow weekday initials for the active locale (Jan 1 2024 is a Monday).
  const miniWeekdays = Array.from({ length: 7 }, (_, i) => {
    const ref = new Date(2024, 0, 1);
    ref.setDate(ref.getDate() + i);
    return ref.toLocaleDateString(intlDateLocale(locale), { weekday: 'narrow' }).toUpperCase();
  });
  const dateInputId = useId();

  const [dates, setDates] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [selectedBays, setSelectedBays] = useState<string[]>([]);
  const [allBays, setAllBays] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [miniCalMonth, setMiniCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

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
      // Pre-fill the time range with the station's opening hours (editable).
      setStartTime(defaultStartTime);
      setEndTime(defaultEndTime);
      // Pre-check the post currently being viewed so the flow stays intuitive;
      // the merchant can then add more posts or switch to "all".
      setSelectedBays(defaultPostId ? [defaultPostId] : []);
      setAllBays(false);
    }
    setErrors({});
  }, [isOpen, editingBlock, preselectedDate, defaultStartTime, defaultEndTime, defaultPostId]);

  function addDate(iso: string) {
    if (iso < todayISO()) return; // no past dates
    if (!dates.includes(iso)) {
      setDates((prev) => [...prev, iso].sort());
    }
  }

  function addDates(isos: string[]) {
    const today = todayISO();
    setDates((prev) => {
      const merged = [...new Set([...prev, ...isos.filter((d) => d >= today)])].sort();
      return merged;
    });
  }

  function removeDate(iso: string) {
    setDates((prev) => prev.filter((d) => d !== iso));
  }

  function toggleBay(bay: string) {
    if (allBays) {
      // Uncheck allBays, keep all except this one selected
      setAllBays(false);
      setSelectedBays(postOptions.map((o) => o.value).filter((b) => b !== bay));
    } else {
      const next = selectedBays.includes(bay)
        ? selectedBays.filter((b) => b !== bay)
        : [...selectedBays, bay];
      // If all individual posts selected, upgrade to allBays
      if (next.length === postCount) {
        setAllBays(true);
        setSelectedBays([]);
      } else {
        setSelectedBays(next);
      }
    }
  }

  function handleAllBays() {
    if (allBays) {
      setAllBays(false);
      setSelectedBays([]);
    } else {
      setAllBays(true);
      setSelectedBays([]);
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (dates.length === 0) newErrors.dates = t('availability_error_missing_dates');
    if (!startTime || !endTime) newErrors.hours = t('availability_error_missing_hours');
    if (startTime >= endTime) newErrors.hours = t('availability_error_end_before_start');
    if (!lockedPostLabel && !allBays && selectedBays.length === 0) newErrors.bays = t('availability_error_missing_postes');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSave({
      dates,
      startTime,
      endTime,
      bayIds: lockedPostLabel ? ['all'] : allBays ? ['all'] : selectedBays,
    });
    onClose();
  }

  // Mini-calendar helpers
  const miniYear = miniCalMonth.getFullYear();
  const miniMonthIdx = miniCalMonth.getMonth();
  const miniMonthLabel = miniCalMonth
    .toLocaleDateString(intlDateLocale(locale), { month: 'long', year: 'numeric' })
    .toUpperCase();
  const miniFirstDay = new Date(miniYear, miniMonthIdx, 1);
  const miniStartOffset = (miniFirstDay.getDay() + 6) % 7;
  const miniDaysInMonth = new Date(miniYear, miniMonthIdx + 1, 0).getDate();
  const miniDaysInPrev = new Date(miniYear, miniMonthIdx, 0).getDate();
  const miniCells: { iso: string; dayNum: number; inMonth: boolean }[] = [];
  for (let i = miniStartOffset - 1; i >= 0; i--) {
    const d = miniDaysInPrev - i;
    const pm = miniMonthIdx === 0 ? 11 : miniMonthIdx - 1;
    const py = miniMonthIdx === 0 ? miniYear - 1 : miniYear;
    miniCells.push({ iso: `${py}-${String(pm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, inMonth: false });
  }
  for (let d = 1; d <= miniDaysInMonth; d++) {
    miniCells.push({ iso: `${miniYear}-${String(miniMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, inMonth: true });
  }
  const miniTrail = 7 - (miniCells.length % 7);
  if (miniTrail < 7) {
    const nm = miniMonthIdx === 11 ? 0 : miniMonthIdx + 1;
    const ny = miniMonthIdx === 11 ? miniYear + 1 : miniYear;
    for (let d = 1; d <= miniTrail; d++) {
      miniCells.push({ iso: `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, inMonth: false });
    }
  }
  const todayStr = todayISO();

  const thisWeek = getWeekRange(0);
  const nextWeek = getWeekRange(1);
  const thisMonth = getMonthRange(0);
  const nextMonth = getMonthRange(1);
  const threeMonths = getNextMonthsRange(3);
  // Sub-labels reflect the addable (future) span, since past days are skipped.
  const futureOf = (arr: string[]) => arr.filter((d) => d >= todayStr);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={t(editingBlock ? 'availability_edit_block_title' : 'availability_create_block_modal_title')}
      size="5xl"
    >
      <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_340px]">
        {/* Left: dates + hours + postes */}
        <div className="space-y-5 p-5">
          {/* Dates */}
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#DDAF3B]">
              {t('availability_modal_section_dates')}
            </p>
            <p className="mb-3 text-xs text-foreground/65 dark:text-[#B0BFB1]">
              {t('availability_modal_dates_hint')}
            </p>

            {/* Selected date pills */}
            {dates.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {dates.map((d) => (
                  <span
                    key={d}
                    className="flex items-center gap-1.5 rounded-full border border-[#DDAF3B]/30 bg-[#DDAF3B]/10 px-3 py-1 text-[11px] font-semibold text-[#001201] dark:bg-[#DDAF3B]/15 dark:text-[#FFF9EC]"
                  >
                    {isoToDisplay(d, locale)}
                    <button
                      type="button"
                      onClick={() => removeDate(d)}
                      aria-label={t('availability_remove_date', { date: isoToDisplay(d, locale) })}
                      className="cursor-pointer text-foreground/65 hover:text-[#FF2525]"
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
                className="mb-3 cursor-pointer text-xs font-semibold text-foreground/65 underline decoration-dotted underline-offset-2 transition-colors hover:text-[#FF2525] dark:text-[#B0BFB1]"
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
                className="rounded-xl border border-[#DDAF3B]/30 bg-[#F0EDE0] px-3 py-2 text-sm text-[#001201] focus:border-[#DDAF3B] focus:outline-none dark:bg-[#001A05] dark:text-[#FFF9EC]"
              />
              <span className="text-xs text-foreground/65 dark:text-[#B0BFB1]">
                {t('availability_modal_add_date')}
              </span>
            </div>
            {errors.dates && (
              <p className="mt-1 text-xs text-[#FF2525]">{errors.dates}</p>
            )}
          </div>

          {/* Hours */}
          <div>
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#DDAF3B]">
              {t('availability_modal_section_hours')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground/65 dark:text-[#B0BFB1]">
                  {t('availability_modal_from')}
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-[#DDAF3B]/30 bg-[#F0EDE0] px-3 py-2 text-sm text-[#001201] focus:border-[#DDAF3B] focus:outline-none dark:bg-[#001A05] dark:text-[#FFF9EC]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground/65 dark:text-[#B0BFB1]">
                  {t('availability_modal_to')}
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-[#DDAF3B]/30 bg-[#F0EDE0] px-3 py-2 text-sm text-[#001201] focus:border-[#DDAF3B] focus:outline-none dark:bg-[#001A05] dark:text-[#FFF9EC]"
                />
              </div>
            </div>
            {errors.hours && (
              <p className="mt-1 text-xs text-[#FF2525]">{errors.hours}</p>
            )}
          </div>

          {/* Postes */}
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#DDAF3B]">
              {t('availability_modal_section_postes')}
            </p>
            {!lockedPostLabel && (
              <p className="mb-3 text-xs text-foreground/65 dark:text-[#B0BFB1]">
                {t('availability_modal_postes_hint')}
              </p>
            )}
            {lockedPostLabel ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-[#DDAF3B]/30 bg-[#DDAF3B]/10 px-3.5 py-2.5 text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {lockedPostLabel}
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-2">
              {/* All bays option */}
              <label className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 p-3 transition-colors ${allBays ? 'border-[#DDAF3B] bg-[#DDAF3B]/10' : 'border-[#DDAF3B]/20 bg-[#F0EDE0] dark:bg-[#001A05]'}`}>
                <input
                  type="checkbox"
                  checked={allBays}
                  onChange={handleAllBays}
                  className="accent-[#DDAF3B]"
                />
                <span className={`text-[13px] font-semibold ${allBays ? 'text-[#DDAF3B]' : 'text-[#001201] dark:text-[#FFF9EC]'}`}>
                  {t('availability_block_all_postes')}
                </span>
              </label>
              {postOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 p-3 transition-colors ${
                    allBays || selectedBays.includes(opt.value)
                      ? 'border-[#DDAF3B] bg-[#DDAF3B]/10'
                      : 'border-[#DDAF3B]/20 bg-[#F0EDE0] dark:bg-[#001A05]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={allBays || selectedBays.includes(opt.value)}
                    onChange={() => toggleBay(opt.value)}
                    className="accent-[#DDAF3B]"
                  />
                  <span
                    className={`text-[13px] font-semibold ${
                      allBays || selectedBays.includes(opt.value)
                        ? 'text-[#DDAF3B]'
                        : 'text-foreground/65 dark:text-[#B0BFB1]'
                    }`}
                  >
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            )}
            {errors.bays && (
              <p className="mt-1 text-xs text-[#FF2525]">{errors.bays}</p>
            )}
          </div>
        </div>

        {/* Right: quick dates + mini-calendar */}
        <div className="border-t border-[#DDAF3B]/20 p-5 md:border-t-0 md:border-l dark:border-[#DDAF3B]/10">
          {/* Premium intro header — same gold pill style used elsewhere
              on the station chrome so the merchant immediately recognises
              this as 'one-click shortcuts' rather than dead form rows. */}
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#DDAF3B] text-[#001201]" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#DDAF3B]">
              {t('availability_modal_quick_dates')}
            </p>
          </div>
          <p className="mb-3 text-[11px] leading-snug text-foreground/65 dark:text-[#B0BFB1]">
            {t('availability_modal_quick_dates_hint')}
          </p>

          <div className="mb-5 flex flex-col gap-2">
            <QuickDateShortcut
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <circle cx="12" cy="16" r="1.5" fill="currentColor" />
                </svg>
              }
              label={t('availability_modal_today')}
              targetDates={[todayISO()]}
              currentDates={dates}
              onApply={() => addDate(todayISO())}
            />
            <QuickDateShortcut
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <polyline points="9 14 13 18 9 22" transform="translate(2, -4)" />
                </svg>
              }
              label={t('availability_modal_tomorrow')}
              targetDates={[tomorrowISO()]}
              currentDates={dates}
              onApply={() => addDate(tomorrowISO())}
            />
            <QuickDateShortcut
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <line x1="6" y1="14" x2="18" y2="14" strokeWidth="2.5" />
                </svg>
              }
              label={t('availability_modal_this_week')}
              subLabel={formatWeekLabel(futureOf(thisWeek), locale)}
              targetDates={thisWeek}
              currentDates={dates}
              onApply={() => addDates(thisWeek)}
            />
            <QuickDateShortcut
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <polyline points="13 14 17 17 13 20" />
                </svg>
              }
              label={t('availability_modal_next_week')}
              subLabel={formatWeekLabel(nextWeek, locale)}
              targetDates={nextWeek}
              currentDates={dates}
              onApply={() => addDates(nextWeek)}
            />
            <QuickDateShortcut
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                </svg>
              }
              label={t('availability_modal_this_month')}
              subLabel={formatWeekLabel(futureOf(thisMonth), locale)}
              targetDates={thisMonth}
              currentDates={dates}
              onApply={() => addDates(thisMonth)}
            />
            <QuickDateShortcut
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <polyline points="14 14 17 16 14 18" />
                </svg>
              }
              label={t('availability_modal_next_month')}
              subLabel={formatWeekLabel(futureOf(nextMonth), locale)}
              targetDates={nextMonth}
              currentDates={dates}
              onApply={() => addDates(nextMonth)}
            />
            <QuickDateShortcut
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="bold" fill="currentColor" stroke="none">3M</text>
                </svg>
              }
              label={t('availability_modal_three_months')}
              subLabel={formatWeekLabel(futureOf(threeMonths), locale)}
              targetDates={threeMonths}
              currentDates={dates}
              onApply={() => addDates(threeMonths)}
            />
          </div>

          {/* Mini-calendar */}
          <div className="rounded-xl border border-[#DDAF3B]/20 bg-white dark:bg-[#001A05] p-3">
            {/* Month nav */}
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setMiniCalMonth(new Date(miniYear, miniMonthIdx - 1, 1))}
                aria-label={t('availability_prev_month')}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-[#DDAF3B] hover:bg-[#DDAF3B]/20 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <p className="flex-1 text-center text-[11px] font-black tracking-wide text-[#001201] dark:text-[#FFF9EC]">
                {miniMonthLabel}
              </p>
              <button
                type="button"
                onClick={() => setMiniCalMonth(new Date(miniYear, miniMonthIdx + 1, 1))}
                aria-label={t('availability_next_month')}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-[#DDAF3B] hover:bg-[#DDAF3B]/20 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {miniWeekdays.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-bold text-foreground/50 dark:text-[#B0BFB1] py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-[3px]">
              {miniCells.map(({ iso, dayNum, inMonth }) => {
                const isPast = inMonth && iso < todayStr;
                const isDisabled = !inMonth || isPast;
                const isSelected = dates.includes(iso);
                const isToday = iso === todayStr;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return;
                      if (isSelected) {
                        setDates((prev) => prev.filter((d) => d !== iso));
                      } else {
                        addDate(iso);
                      }
                    }}
                    className={[
                      'aspect-square w-full rounded-md text-center text-[11px] font-bold transition-colors leading-none flex items-center justify-center',
                      isDisabled ? 'cursor-default opacity-25 text-foreground/40' : 'cursor-pointer',
                      !isDisabled && isSelected
                        ? 'bg-[#DDAF3B] text-[#001201]'
                        : !isDisabled && isToday
                          ? 'border-2 border-[#DDAF3B] text-[#001201] dark:text-[#FFF9EC]'
                          : !isDisabled
                            ? 'text-[#001201] hover:bg-[#DDAF3B]/20 dark:text-[#FFF9EC] dark:hover:bg-[#DDAF3B]/15'
                            : '',
                    ].join(' ')}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-foreground/55 dark:text-[#B0BFB1]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[3px] border-2 border-[#DDAF3B]" />
                {t('block_calendar_today')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-[3px] bg-[#DDAF3B]" />
                {t('block_calendar_selected')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 border-t border-[#DDAF3B]/20 px-5 py-4 dark:border-[#DDAF3B]/10">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-xl border border-[#DDAF3B]/30 bg-transparent px-5 py-2.5 text-sm font-bold text-foreground/65 transition-colors hover:bg-[#DDAF3B]/10 dark:text-[#B0BFB1]"
        >
          {t('btn_cancel')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="cursor-pointer rounded-xl bg-[#DDAF3B] px-5 py-2.5 text-sm font-black text-[#001201] transition-colors hover:bg-[#A07818] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAF3B] focus-visible:ring-offset-2"
        >
          {t(editingBlock ? 'availability_block_edit' : 'availability_create_block')}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* QuickDateShortcut — one row of the Dates rapides shortcut list      */
/* ------------------------------------------------------------------ */

interface QuickDateShortcutProps {
  icon: React.ReactNode;
  label: string;
  /** Optional second line (e.g. '23 May – 27 May' for a week shortcut). */
  subLabel?: string;
  /** Dates the shortcut would add to the selection. */
  targetDates: string[];
  /** Dates currently selected — used to compute the 'new dates' counter
   *  and whether the shortcut has already been applied. */
  currentDates: string[];
  onApply: () => void;
}

function QuickDateShortcut({
  icon,
  label,
  subLabel,
  targetDates,
  currentDates,
  onApply,
}: QuickDateShortcutProps) {
  const t = useTranslations('station_dashboard');
  /* How many of the proposed dates would actually be added if the user
   * clicked the shortcut. Already-selected ones don't count. We also
   * filter out past dates to mirror the addDates() guard. */
  const today = todayISO();
  const futureTargets = targetDates.filter((d) => d >= today);
  const newCount = futureTargets.filter((d) => !currentDates.includes(d)).length;
  const isFullyApplied = futureTargets.length > 0 && newCount === 0;
  const isEmptyShortcut = futureTargets.length === 0;

  return (
    <button
      type="button"
      onClick={onApply}
      disabled={isEmptyShortcut}
      aria-pressed={isFullyApplied}
      className={[
        'group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
        'cursor-pointer disabled:cursor-not-allowed disabled:opacity-45',
        isFullyApplied
          ? 'border-[#22C47A]/40 bg-[#22C47A]/8 hover:border-[#22C47A]/60'
          : 'border-[#DDAF3B]/30 bg-[#F0EDE0] hover:-translate-y-px hover:border-[#DDAF3B] hover:bg-[#DDAF3B]/15 hover:shadow-sm dark:bg-[#001A05] dark:border-[#DDAF3B]/20',
      ].join(' ')}
    >
      {/* Icon — gold for new add, green for already applied. */}
      <span
        className={[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
          isFullyApplied
            ? 'bg-[#22C47A]/15 text-[#16A964]'
            : 'bg-[#DDAF3B]/15 text-[#DDAF3B] group-hover:bg-[#DDAF3B]/25',
        ].join(' ')}
        aria-hidden="true"
      >
        {icon}
      </span>

      {/* Label + sub-label */}
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-bold text-[#001201] dark:text-[#FFF9EC]">
          {label}
        </span>
        {subLabel && (
          <span className="mt-0.5 block text-[10.5px] text-foreground/60 dark:text-[#B0BFB1] tabular-nums">
            {subLabel}
          </span>
        )}
      </span>

      {/* Counter pill — '+1' / '+5' for fresh adds, 'Ajouté ✓' once applied,
          'Passé' for shortcuts that resolve to no future dates. */}
      <span
        className={[
          'shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider transition-colors',
          isEmptyShortcut
            ? 'bg-foreground/8 text-foreground/55 dark:text-[#B0BFB1]'
            : isFullyApplied
              ? 'bg-[#22C47A]/15 text-[#16A964]'
              : 'bg-[#DDAF3B] text-[#001201] group-hover:bg-[#A07818] group-hover:text-[#FFF9EC]',
        ].join(' ')}
        aria-hidden="true"
      >
        {isEmptyShortcut
          ? t('availability_modal_shortcut_past')
          : isFullyApplied
            ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>{t('availability_modal_shortcut_added')}</>
            : t('availability_modal_shortcut_add', { count: newCount })}
      </span>
    </button>
  );
}

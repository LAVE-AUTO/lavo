'use client';

import { useMemo, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export interface AgendaEntry {
  id: string;
  clientName: string;
  vehicleFormat: string | null;
  status: string;
  slotStart: string | null;
  slotEnd: string | null;
  amountPaid: number | null;
  postId: string | null;
}

export interface AgendaPost {
  id: string;
  position: number;
  isActive: boolean;
}

interface Props {
  posts: AgendaPost[];
  entries: AgendaEntry[];
  selectedDate: Date;
  openingTime: string | null;
  closingTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  selectedPostId: string | 'all';
  onSelectEntry: (entry: AgendaEntry) => void;
}

const PX_PER_MINUTE = 1.5; // 60 min = 90 px (compact yet readable)
const DEFAULT_OPEN = '08:00';
const DEFAULT_CLOSE = '20:00';

function parseHHMM(value: string | null, fallback: string): { h: number; m: number } {
  const v = (value ?? fallback).trim();
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  if (!m) {
    const fb = fallback.match(/^(\d{1,2}):(\d{2})/);
    return { h: parseInt(fb![1], 10), m: parseInt(fb![2], 10) };
  }
  return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
}

function minutesSinceOpen(date: Date | null, openMinutes: number): number | null {
  if (!date) return null;
  const total = date.getHours() * 60 + date.getMinutes();
  return total - openMinutes;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function statusToBlockClass(status: string): { bg: string; border: string; chip: string; chipBg: string } {
  switch (status) {
    case 'completed':
      return {
        bg: 'bg-[#F0EDE0] dark:bg-[#001201]/60',
        border: 'border-[#D8D4C4] dark:border-[#001A05]',
        chip: 'text-foreground/55 dark:text-[#B0BFB1]',
        chipBg: 'bg-[#FFF9EC] dark:bg-[#1A2A14]',
      };
    case 'in_progress':
      return {
        bg: 'bg-[#E8F6EC] dark:bg-[#0B2418]',
        border: 'border-[#2ECC71]/60',
        chip: 'text-[#0E8C45] dark:text-[#65E69A]',
        chipBg: 'bg-[#2ECC71]/15',
      };
    case 'late':
      return {
        bg: 'bg-[#FDECE6] dark:bg-[#291210]',
        border: 'border-[#391C01]/50',
        chip: 'text-[#B33B1F] dark:text-[#FF8866]',
        chipBg: 'bg-[#391C01]/15',
      };
    case 'cancelled':
      return {
        bg: 'bg-[#F0EDE0]/70',
        border: 'border-[#D8D4C4]',
        chip: 'text-foreground/55',
        chipBg: 'bg-[#FFF9EC]',
      };
    default:
      // confirmed / pending / pending_payment
      return {
        bg: 'bg-[#E6EEFD] dark:bg-[#10182B]',
        border: 'border-[#1E40AF]/50',
        chip: 'text-[#1E40AF] dark:text-[#8AB4FF]',
        chipBg: 'bg-[#1E40AF]/15',
      };
  }
}

function statusLabelKey(status: string): string {
  if (status === 'completed') return 'status_completed';
  if (status === 'in_progress') return 'status_in_progress';
  if (status === 'cancelled') return 'status_cancelled';
  if (status === 'late') return 'status_late';
  /* pending / pending_payment / confirmed all surface as "À venir" since the
   * client pre-authorizes payment in Stripe; the merchant is paid once the
   * service is completed. The intermediate "Paiement en attente" badge was
   * confusing for the merchant. */
  return 'status_confirmed';
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function DashboardAgendaTimeline({
  posts,
  entries,
  selectedDate,
  openingTime,
  closingTime,
  breakStart,
  breakEnd,
  selectedPostId,
  onSelectEntry,
}: Props) {
  const t = useTranslations('station_dashboard');
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const { openMinutes, closeMinutes, totalMinutes, hours } = useMemo(() => {
    const open = parseHHMM(openingTime, DEFAULT_OPEN);
    const close = parseHHMM(closingTime, DEFAULT_CLOSE);
    const openTotal = open.h * 60 + open.m;
    let closeTotal = close.h * 60 + close.m;
    if (closeTotal <= openTotal) closeTotal = openTotal + 60; // safety
    const hourLabels: string[] = [];
    for (let m = Math.ceil(openTotal / 60) * 60; m <= closeTotal; m += 60) {
      hourLabels.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:00`);
    }
    return { openMinutes: openTotal, closeMinutes: closeTotal, totalMinutes: closeTotal - openTotal, hours: hourLabels };
  }, [openingTime, closingTime]);

  const breakSpan = useMemo(() => {
    if (!breakStart || !breakEnd) return null;
    const s = parseHHMM(breakStart, '12:00');
    const e = parseHHMM(breakEnd, '13:00');
    const startMin = s.h * 60 + s.m - openMinutes;
    const endMin = e.h * 60 + e.m - openMinutes;
    if (endMin <= 0 || startMin >= totalMinutes) return null;
    return { top: Math.max(0, startMin) * PX_PER_MINUTE, height: (Math.min(totalMinutes, endMin) - Math.max(0, startMin)) * PX_PER_MINUTE };
  }, [breakStart, breakEnd, openMinutes, totalMinutes]);

  const nowLineTop = useMemo(() => {
    if (!isSameDay(now, selectedDate)) return null;
    const m = now.getHours() * 60 + now.getMinutes() - openMinutes;
    if (m < 0 || m > totalMinutes) return null;
    return m * PX_PER_MINUTE;
  }, [now, selectedDate, openMinutes, totalMinutes]);

  const visiblePosts = useMemo(() => {
    const active = posts.filter((p) => p.isActive);
    if (selectedPostId === 'all') return active;
    return active.filter((p) => p.id === selectedPostId);
  }, [posts, selectedPostId]);

  // Distribute orphan entries (post_id = null) across visible posts deterministically by hash.
  const entriesByPost = useMemo(() => {
    const map = new Map<string, AgendaEntry[]>();
    visiblePosts.forEach((p) => map.set(p.id, []));
    if (visiblePosts.length === 0) return map;
    for (const entry of entries) {
      if (!entry.slotStart) continue;
      const slotDate = new Date(entry.slotStart);
      if (!isSameDay(slotDate, selectedDate)) continue;
      let bucketId = entry.postId;
      if (!bucketId || !map.has(bucketId)) {
        // Round-robin fallback for entries with no post assigned yet
        const hash = [...entry.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        bucketId = visiblePosts[hash % visiblePosts.length].id;
      }
      const bucket = map.get(bucketId);
      if (bucket) bucket.push(entry);
    }
    map.forEach((arr) => arr.sort((a, b) => (a.slotStart ?? '').localeCompare(b.slotStart ?? '')));
    return map;
  }, [entries, visiblePosts, selectedDate]);

  const totalHeight = totalMinutes * PX_PER_MINUTE;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-white dark:bg-[#111A0E]">
      {/* Header strip — sticky bay names */}
      <div className="flex flex-shrink-0 border-b border-[#FFF9EC] bg-[#FFF9EC] dark:border-[#1A2A14] dark:bg-[#001201]">
        <div className="w-14 flex-shrink-0 border-r border-[#FFF9EC] dark:border-[#1A2A14]" />
        {visiblePosts.length === 0 ? (
          <div className="flex-1 px-4 py-3 text-center text-[12px] text-foreground/55 dark:text-[#B0BFB1]">
            {t('agenda_no_posts')}
          </div>
        ) : (
          visiblePosts.map((post) => {
            const bucket = entriesByPost.get(post.id) ?? [];
            const inProgress = bucket.some((e) => e.status === 'in_progress');
            return (
              <div
                key={post.id}
                className="min-w-[200px] flex-1 border-l border-[#FFF9EC] px-3 py-2 dark:border-[#1A2A14]"
              >
                <div className="text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">
                  {t('filter_post', { n: post.position })}
                </div>
                <div className={`mt-0.5 text-[11px] font-bold ${inProgress ? 'text-[#0E8C45] dark:text-[#65E69A]' : 'text-[#1E40AF] dark:text-[#8AB4FF]'}`}>
                  {inProgress ? `● ${t('post_in_service')}` : `● ${t('post_available')}`}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex flex-1 overflow-auto">
        {/* Hour gutter */}
        <div className="sticky left-0 z-10 w-14 flex-shrink-0 border-r border-[#FFF9EC] bg-white dark:border-[#1A2A14] dark:bg-[#111A0E]">
          <div className="relative" style={{ height: totalHeight }}>
            {hours.map((h) => {
              const top = (parseHHMM(h, '00:00').h * 60 + parseHHMM(h, '00:00').m - openMinutes) * PX_PER_MINUTE;
              return (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[11px] font-bold tabular-nums text-[#999] dark:text-[#5A5A4A]"
                  style={{ top }}
                >
                  {h}
                </div>
              );
            })}
          </div>
        </div>

        {/* Post columns */}
        {visiblePosts.map((post) => {
          const bucket = entriesByPost.get(post.id) ?? [];
          return (
            <div
              key={post.id}
              className="relative min-w-[200px] flex-1 border-l border-[#FFF9EC] dark:border-[#1A2A14]"
            >
              <div className="relative" style={{ height: totalHeight }}>
                {/* Hour grid lines */}
                {hours.map((h) => {
                  const top = (parseHHMM(h, '00:00').h * 60 + parseHHMM(h, '00:00').m - openMinutes) * PX_PER_MINUTE;
                  return (
                    <div
                      key={h}
                      className="absolute left-0 right-0 h-px bg-[#FFF9EC] dark:bg-[#1A2A14]"
                      style={{ top }}
                    />
                  );
                })}

                {/* Break overlay */}
                {breakSpan && (
                  <div
                    className="absolute left-1 right-1 flex items-center justify-center rounded-md bg-[#001201]/[0.06] text-[10px] font-bold uppercase tracking-wider text-foreground/65 dark:bg-[#001201] dark:text-[#5A5A4A]"
                    style={{ top: breakSpan.top, height: breakSpan.height }}
                    aria-hidden="true"
                  >
                    {t('agenda_break')}
                  </div>
                )}

                {/* Now line */}
                {nowLineTop !== null && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 h-px bg-[#DDAF3B]"
                    style={{ top: nowLineTop }}
                  >
                    <span className="absolute -left-1 -top-[3px] block h-1.5 w-1.5 rounded-full bg-[#DDAF3B]" />
                  </div>
                )}

                {/* Slots */}
                {bucket.map((entry) => (
                  <SlotBlock
                    key={entry.id}
                    entry={entry}
                    openMinutes={openMinutes}
                    closeMinutes={closeMinutes}
                    onSelect={onSelectEntry}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SlotBlockProps {
  entry: AgendaEntry;
  openMinutes: number;
  closeMinutes: number;
  onSelect: (entry: AgendaEntry) => void;
}

function SlotBlock({ entry, openMinutes, closeMinutes, onSelect }: SlotBlockProps) {
  const t = useTranslations('station_dashboard');
  if (!entry.slotStart) return null;
  const start = new Date(entry.slotStart);
  const end = entry.slotEnd ? new Date(entry.slotEnd) : new Date(start.getTime() + 30 * 60 * 1000);
  const startMin = minutesSinceOpen(start, openMinutes) ?? 0;
  const endMin = minutesSinceOpen(end, openMinutes) ?? startMin + 30;
  const clampedStart = Math.max(0, startMin);
  const clampedEnd = Math.min(closeMinutes - openMinutes, endMin);
  if (clampedEnd <= clampedStart) return null;

  const top = clampedStart * PX_PER_MINUTE;
  /* Minimum 64px so the price + status badge always fit. If the real slot
   * duration is short, we slightly overlap the next hour gridline — better
   * than hiding actionable info. */
  const height = Math.max(64, (clampedEnd - clampedStart) * PX_PER_MINUTE);
  const styles = statusToBlockClass(entry.status);
  const statusLbl = t(statusLabelKey(entry.status));
  const showPrimary = entry.status === 'confirmed' || entry.status === 'pending' || entry.status === 'pending_payment' || entry.status === 'in_progress';
  const primaryLabel = entry.status === 'in_progress' ? t('btn_complete') : t('btn_start');
  const primaryClass = entry.status === 'in_progress'
    ? 'bg-[#2ECC71] text-white'
    : 'bg-[#1E40AF] text-white';

  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      aria-label={t('slot_block_aria', { name: entry.clientName, time: `${formatTime(start)}–${formatTime(end)}` })}
      className={`group absolute left-1.5 right-1.5 flex flex-col overflow-hidden rounded-lg border text-left ${styles.bg} ${styles.border} px-2 py-1.5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#DDAF3B]/40`}
      style={{ top, height }}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] font-bold tabular-nums text-[#001201] dark:text-[#FFF9EC]">
          {formatTime(start)}–{formatTime(end)}
        </span>
        <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${styles.chip} ${styles.chipBg}`}>
          {statusLbl}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[11px] font-semibold text-[#001201] dark:text-[#FFF9EC]">
        {entry.clientName}
      </div>
      <div className="mt-auto flex items-end justify-between gap-1.5 pt-1">
        <div className="min-w-0 truncate text-[10px] text-foreground/65 dark:text-[#B0BFB1]">
          {entry.vehicleFormat ?? ''}
          {entry.vehicleFormat && entry.amountPaid !== null ? ' · ' : ''}
          {entry.amountPaid !== null ? (
            <span className="font-black text-[#001201] dark:text-[#FFF9EC]">{entry.amountPaid}$</span>
          ) : null}
        </div>
        {showPrimary && (
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black ${primaryClass}`}>
            {primaryLabel}
          </span>
        )}
      </div>
    </button>
  );
}

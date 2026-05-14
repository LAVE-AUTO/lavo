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
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onExtraTime: (id: string, minutes: number) => void;
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
        bg: 'bg-[#F0EDE0] dark:bg-[#0F1A0C]/60',
        border: 'border-[#D8D4C4] dark:border-[#243020]',
        chip: 'text-[#888] dark:text-[#A0A090]',
        chipBg: 'bg-[#E0DCD0] dark:bg-[#1A2A14]',
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
        border: 'border-[#E8472A]/50',
        chip: 'text-[#B33B1F] dark:text-[#FF8866]',
        chipBg: 'bg-[#E8472A]/15',
      };
    case 'cancelled':
      return {
        bg: 'bg-[#F0EDE0]/70',
        border: 'border-[#D8D4C4]',
        chip: 'text-[#888]',
        chipBg: 'bg-[#E0DCD0]',
      };
    default:
      // confirmed / pending / pending_payment
      return {
        bg: 'bg-[#E6EEFD] dark:bg-[#10182B]',
        border: 'border-[#3B82F6]/50',
        chip: 'text-[#1E40AF] dark:text-[#8AB4FF]',
        chipBg: 'bg-[#3B82F6]/15',
      };
  }
}

function statusLabelKey(status: string): string {
  if (status === 'completed') return 'status_completed';
  if (status === 'in_progress') return 'status_in_progress';
  if (status === 'cancelled') return 'status_cancelled';
  if (status === 'late') return 'status_late';
  if (status === 'pending') return 'status_pending';
  if (status === 'pending_payment') return 'status_pending_payment';
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
  onStart,
  onComplete,
  onCancel,
  onExtraTime,
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
      <div className="flex flex-shrink-0 border-b border-[#E0DCD0] bg-[#F7F6F2] dark:border-[#1A2A14] dark:bg-[#0F1A0C]">
        <div className="w-14 flex-shrink-0 border-r border-[#E0DCD0] dark:border-[#1A2A14]" />
        {visiblePosts.length === 0 ? (
          <div className="flex-1 px-4 py-3 text-center text-[12px] text-[#888] dark:text-[#A0A090]">
            {t('agenda_no_posts')}
          </div>
        ) : (
          visiblePosts.map((post) => {
            const bucket = entriesByPost.get(post.id) ?? [];
            const inProgress = bucket.some((e) => e.status === 'in_progress');
            return (
              <div
                key={post.id}
                className="min-w-[200px] flex-1 border-l border-[#E0DCD0] px-3 py-2 dark:border-[#1A2A14]"
              >
                <div className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
                  {t('filter_post', { n: post.position })}
                </div>
                <div className={`mt-0.5 text-[11px] font-bold ${inProgress ? 'text-[#0E8C45] dark:text-[#65E69A]' : 'text-[#3B82F6] dark:text-[#8AB4FF]'}`}>
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
        <div className="sticky left-0 z-10 w-14 flex-shrink-0 border-r border-[#E0DCD0] bg-white dark:border-[#1A2A14] dark:bg-[#111A0E]">
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
              className="relative min-w-[200px] flex-1 border-l border-[#E0DCD0] dark:border-[#1A2A14]"
            >
              <div className="relative" style={{ height: totalHeight }}>
                {/* Hour grid lines */}
                {hours.map((h) => {
                  const top = (parseHHMM(h, '00:00').h * 60 + parseHHMM(h, '00:00').m - openMinutes) * PX_PER_MINUTE;
                  return (
                    <div
                      key={h}
                      className="absolute left-0 right-0 h-px bg-[#E8E4D8] dark:bg-[#1A2A14]"
                      style={{ top }}
                    />
                  );
                })}

                {/* Break overlay */}
                {breakSpan && (
                  <div
                    className="absolute left-1 right-1 flex items-center justify-center rounded-md bg-[#1A1A0A]/[0.06] text-[10px] font-bold uppercase tracking-wider text-[#666] dark:bg-[#0F1A0C] dark:text-[#5A5A4A]"
                    style={{ top: breakSpan.top, height: breakSpan.height }}
                    aria-hidden="true"
                  >
                    {t('agenda_break')}
                  </div>
                )}

                {/* Now line */}
                {nowLineTop !== null && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 h-px bg-[#C49A1E]"
                    style={{ top: nowLineTop }}
                  >
                    <span className="absolute -left-1 -top-[3px] block h-1.5 w-1.5 rounded-full bg-[#C49A1E]" />
                  </div>
                )}

                {/* Slots */}
                {bucket.map((entry) => (
                  <SlotBlock
                    key={entry.id}
                    entry={entry}
                    openMinutes={openMinutes}
                    closeMinutes={closeMinutes}
                    onStart={onStart}
                    onComplete={onComplete}
                    onCancel={onCancel}
                    onExtraTime={onExtraTime}
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
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onExtraTime: (id: string, minutes: number) => void;
}

function SlotBlock({ entry, openMinutes, closeMinutes, onStart, onComplete, onCancel, onExtraTime }: SlotBlockProps) {
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
  const height = Math.max(36, (clampedEnd - clampedStart) * PX_PER_MINUTE);
  const styles = statusToBlockClass(entry.status);
  const statusLbl = t(statusLabelKey(entry.status));
  const compact = height < 64;

  return (
    <div
      className={`absolute left-1.5 right-1.5 overflow-hidden rounded-lg border ${styles.bg} ${styles.border} px-2 py-1.5 shadow-sm transition-shadow hover:shadow-md`}
      style={{ top, height }}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] font-bold tabular-nums text-[#1A1A0A] dark:text-[#F0EDD4]">
          {formatTime(start)}–{formatTime(end)}
        </span>
        <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${styles.chip} ${styles.chipBg}`}>
          {statusLbl}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[11px] font-semibold text-[#1A1A0A] dark:text-[#F0EDD4]">
        {entry.clientName}
      </div>
      {!compact && (entry.vehicleFormat || entry.amountPaid !== null) && (
        <div className="mt-0.5 truncate text-[10px] text-[#666] dark:text-[#A0A090]">
          {entry.vehicleFormat ?? ''}
          {entry.vehicleFormat && entry.amountPaid !== null ? ' · ' : ''}
          {entry.amountPaid !== null ? `${entry.amountPaid}$` : ''}
        </div>
      )}
      {!compact && entry.status === 'in_progress' && (
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onComplete(entry.id)}
            className="rounded-md bg-[#2ECC71] px-2 py-0.5 text-[10px] font-black text-white hover:opacity-90"
          >
            {t('btn_complete')}
          </button>
          <button
            type="button"
            onClick={() => onExtraTime(entry.id, 15)}
            className="rounded-md border border-[#C49A1E]/50 px-2 py-0.5 text-[10px] font-bold text-[#C49A1E] hover:bg-[#C49A1E]/10"
          >
            {t('btn_extra_time')}
          </button>
        </div>
      )}
      {!compact && (entry.status === 'confirmed' || entry.status === 'pending' || entry.status === 'pending_payment') && (
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onStart(entry.id)}
            className="rounded-md bg-[#3B82F6] px-2 py-0.5 text-[10px] font-black text-white hover:opacity-90"
          >
            {t('btn_start')}
          </button>
          <button
            type="button"
            onClick={() => onCancel(entry.id)}
            className="rounded-md border border-[#E8472A]/50 px-2 py-0.5 text-[10px] font-bold text-[#E8472A] hover:bg-[#E8472A]/10"
          >
            {t('btn_cancel')}
          </button>
        </div>
      )}
    </div>
  );
}

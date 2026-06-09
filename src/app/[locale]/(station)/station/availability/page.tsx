'use client';

/**
 * Disponibilité - manages station time slots through the new calendar UX.
 * Backed by /station/slots (GET, POST, POST /bulk, DELETE) and /station/config
 * (to know how many active bays the station has, used as default capacity).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { getFromApi, postWithApi, deleteWithApi, updateWithApi } from '@/services';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import { BlocksPanel } from '@/components/station/availability/BlocksPanel';
import { MonthCalendar } from '@/components/station/availability/MonthCalendar';
import { CreateBlockModal } from '@/components/station/availability/CreateBlockModal';
import { DayDetailsModal } from '@/components/station/availability/DayDetailsModal';
import { PageLoader } from '@/components/ui/PageLoader';
import type { AvailabilityBlock } from '@/components/station/availability/types';

interface RawSlot {
  id: string;
  start_time: string; // ISO datetime
  end_time: string;   // ISO datetime
  capacity: number;
  booked_count: number;
  status: string;
}

interface RawConfig {
  data: {
    config: { wash_post_count: number | null; opening_time?: string | null; closing_time?: string | null };
    posts: Array<{ id: string; position: number; is_active: boolean }>;
  };
}

/** Extracts the HH:MM portion from a stored time ("08:00:00", "09:00:00+00", …). */
function extractHHMM(time: string | null | undefined, fallback: string): string {
  if (!time) return fallback;
  const m = String(time).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : fallback;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function extractTime(iso: string): string {
  // Render the local HH:MM portion regardless of timezone offset on the response.
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Build a strict ISO 8601 datetime (with timezone) from a date + HH:MM input.
 * The backend's Zod `.datetime()` validator requires the offset, so a bare
 * `"2026-05-15T12:00:00"` is rejected with a 400. We treat the input as local
 * time at the merchant's browser and serialise it as UTC - the round-trip
 * preserves the wall-clock value because `extractTime` reads back local hours.
 */
function localTimeToIsoUtc(date: string, time: string): string {
  const local = new Date(`${date}T${time}:00`);
  if (Number.isNaN(local.getTime())) {
    throw new Error(`Invalid date/time combination: ${date} ${time}`);
  }
  return local.toISOString();
}

function enumerateMonth(month: Date): string[] {
  // Returns every day from the 1st to the last day of the given month, ISO format.
  const y = month.getFullYear();
  const m = month.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= days; d++) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

function slotToBlock(slot: RawSlot, dateISO: string): AvailabilityBlock {
  // /time_slots have no per-bay info - we surface capacity through the existing
  // bayIds shape using a synthetic ['all'] marker. Capacity is conveyed via the
  // count of slot-derived blocks per date and the modal's numBays prop.
  return {
    id: slot.id,
    dates: [dateISO],
    startTime: extractTime(slot.start_time),
    endTime: extractTime(slot.end_time),
    bayIds: ['all'],
  };
}

export default function StationAvailabilityPage() {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();
  const { error: showError, success } = useToast();
  const { isLoading: authLoading } = useAuth();
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [slotsByDate, setSlotsByDate] = useState<Record<string, RawSlot[]>>({});
  const [activeBays, setActiveBays] = useState<number>(1);
  // Station's configured opening hours — used to pre-fill the create modal's time range.
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('18:00');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [initialLoading, setInitialLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<AvailabilityBlock | null>(null);
  const [preselectedDate, setPreselectedDate] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);

  const fetchSlotsForDate = useCallback(async (date: string): Promise<RawSlot[]> => {
    const [ok, data] = await getFromApi(`/station/slots?date=${date}`);
    if (!ok) return [];
    const slots = (data as { data?: { slots?: RawSlot[] } })?.data?.slots ?? [];
    return slots;
  }, []);

  const refreshDate = useCallback(
    async (date: string) => {
      const slots = await fetchSlotsForDate(date);
      if (!mountedRef.current) return;
      setSlotsByDate((prev) => ({ ...prev, [date]: slots }));
    },
    [fetchSlotsForDate],
  );

  const fetchMonth = useCallback(
    async (month: Date) => {
      const dates = enumerateMonth(month);
      const results = await Promise.all(dates.map(fetchSlotsForDate));
      if (!mountedRef.current) return;
      const next: Record<string, RawSlot[]> = {};
      dates.forEach((d, i) => {
        next[d] = results[i];
      });
      setSlotsByDate(next);
    },
    [fetchSlotsForDate],
  );

  // Initial load: config (for active bays) + current month slots in parallel
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      const [configResult] = await Promise.all([
        getFromApi('/station/config'),
        fetchMonth(currentMonth),
      ]);
      const [configOk, configData] = configResult;
      if (cancelled || !mountedRef.current) return;
      if (configOk) {
        const cfg = (configData as RawConfig).data;
        const activeCount =
          cfg.posts?.filter((p) => p.is_active).length ?? cfg.config?.wash_post_count ?? 1;
        setActiveBays(Math.max(1, activeCount));
        setOpeningTime(extractHHMM(cfg.config?.opening_time, '08:00'));
        setClosingTime(extractHHMM(cfg.config?.closing_time, '18:00'));
      }
      setInitialLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, currentMonth, fetchMonth]);

  function getBlocksForDate(dateISO: string): AvailabilityBlock[] {
    return (slotsByDate[dateISO] ?? []).map((s) => slotToBlock(s, dateISO));
  }

  // All currently visible blocks across the month, flattened - feeds the side panel
  const allBlocks: AvailabilityBlock[] = Object.entries(slotsByDate)
    .flatMap(([date, slots]) => slots.map((s) => slotToBlock(s, date)))
    .sort((a, b) => `${a.dates[0]} ${a.startTime}`.localeCompare(`${b.dates[0]} ${b.startTime}`));

  function handleDayClick(dateISO: string) {
    setSelectedDay(dateISO);
    setIsDayModalOpen(true);
  }

  function openCreateModal() {
    setEditingBlock(null);
    setPreselectedDate(null);
    setIsCreateOpen(true);
  }

  function openCreateForDay(dateISO: string) {
    setEditingBlock(null);
    setPreselectedDate(dateISO);
    setIsCreateOpen(true);
  }

  function openEditModal(block: AvailabilityBlock) {
    setEditingBlock(block);
    setPreselectedDate(null);
    setIsCreateOpen(true);
  }

  async function handleSave(data: Omit<AvailabilityBlock, 'id'>) {
    if (data.dates.length === 0) return;

    const capacity = data.bayIds.includes('all') ? activeBays : data.bayIds.length;
    const safeCapacity = Math.max(1, capacity);

    const newSlots = data.dates.map((date) => ({
      start_time: localTimeToIsoUtc(date, data.startTime),
      end_time: localTimeToIsoUtc(date, data.endTime),
      capacity: safeCapacity,
    }));

    let ok = false;

    if (editingBlock) {
      // Edit path: atomic replace — delete old slots + create new ones in one transaction.
      // If the delete fails (slot has reservations, not found, etc.) the create is rolled
      // back too, so no orphan slots are ever produced.
      const idsToDelete = editingBlock.ids ?? [editingBlock.id];
      const [replaceOk] = await updateWithApi('/station/slots/replace', {
        ids_to_delete: idsToDelete,
        slots: newSlots,
      });
      ok = replaceOk;
    } else {
      // Create path: single or bulk insert.
      if (newSlots.length === 1) {
        const [success1] = await postWithApi('/station/slots', newSlots[0]);
        ok = success1;
      } else {
        const [success1] = await postWithApi('/station/slots/bulk', { slots: newSlots });
        ok = success1;
      }
    }

    if (!mountedRef.current) return;

    if (!ok) {
      showError(t('availability_save_error'));
      return;
    }

    success(t('availability_save_success'));
    setEditingBlock(null);

    const datesToRefresh = new Set(data.dates);
    if (editingBlock) editingBlock.dates.forEach((d) => datesToRefresh.add(d));
    await Promise.all(Array.from(datesToRefresh).map(refreshDate));
  }

  async function handleDelete(slotId: string) {
    const [ok] = await deleteWithApi(`/station/slots/${slotId}`);
    if (!mountedRef.current) return;

    if (!ok) {
      showError(t('availability_delete_error'));
      return;
    }

    success(t('availability_delete_success'));

    // Find the date the slot belonged to and refresh just that one
    for (const [date, slots] of Object.entries(slotsByDate)) {
      if (slots.some((s) => s.id === slotId)) {
        await refreshDate(date);
        break;
      }
    }
  }

  async function handleDeleteGroup(ids: string[]) {
    // Use the bulk DELETE endpoint so all slots are removed in one round-trip
    // instead of N parallel individual deletes that each succeed or fail independently.
    const [ok] = await deleteWithApi('/station/slots', { autoJoin: false, data: { ids } });
    if (!mountedRef.current) return;

    if (!ok) {
      showError(t('availability_delete_error'));
      return;
    }

    success(t('availability_delete_success'));

    const datesToRefresh = new Set<string>();
    for (const [date, slots] of Object.entries(slotsByDate)) {
      if (slots.some((s) => ids.includes(s.id))) datesToRefresh.add(date);
    }
    await Promise.all(Array.from(datesToRefresh).map(refreshDate));
  }

  if (initialLoading) {
    return <PageLoader label={t('loading')} />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex flex-col gap-3 border-b border-[#DDAF3B]/20 px-4 py-4 dark:border-[#DDAF3B]/10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-[#001201] dark:text-[#FFF9EC]">
            {t('availability_title')}
          </h1>
          <p className="mt-0.5 text-sm text-foreground/65 dark:text-[#B0BFB1]">
            {t('availability_subtitle')}
          </p>
        </div>

        {/* Shortcuts to the related Config tabs (Hours + Capacity) */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={`/${locale}/station/config?tab=hours`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#FFF9EC] bg-white px-3 py-2 text-[12px] font-bold text-[#5A5A4A] transition-colors hover:border-[#DDAF3B]/40 hover:text-[#DDAF3B] dark:border-[#001A05] dark:bg-[#182214] dark:text-[#B0BFB1]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
            {t('availability_link_hours')}
          </Link>
          <Link
            href={`/${locale}/station/config?tab=capacity`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#FFF9EC] bg-white px-3 py-2 text-[12px] font-bold text-[#5A5A4A] transition-colors hover:border-[#DDAF3B]/40 hover:text-[#DDAF3B] dark:border-[#001A05] dark:bg-[#182214] dark:text-[#B0BFB1]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            {t('availability_link_capacity')}
          </Link>
        </div>
      </div>

      {/* Main two-panel layout - stacked on mobile (scrollable), side-by-side on desktop */}
      <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <BlocksPanel
          blocks={allBlocks}
          onDelete={handleDeleteGroup}
          onEdit={openEditModal}
          onCreateClick={openCreateModal}
        />
        <MonthCalendar
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          getBlocksForDate={getBlocksForDate}
          onDayClick={handleDayClick}
          selectedDateISO={selectedDay}
        />
      </div>

      {/* Modals */}
      <CreateBlockModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingBlock(null);
          setPreselectedDate(null);
        }}
        onSave={handleSave}
        editingBlock={editingBlock}
        numBays={activeBays}
        defaultStartTime={openingTime}
        defaultEndTime={closingTime}
        preselectedDate={preselectedDate ?? (selectedDay && selectedDay >= todayISO() ? selectedDay : null)}
      />
      <DayDetailsModal
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        date={selectedDay}
        blocks={selectedDay ? getBlocksForDate(selectedDay) : []}
        onDeleteBlock={handleDelete}
        onEditBlock={openEditModal}
        onCreateForDay={openCreateForDay}
      />
    </div>
  );
}

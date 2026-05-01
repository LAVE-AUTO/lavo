'use client';

/**
 * Disponibilité — manages station time slots through the new calendar UX.
 * Backed by /station/slots (GET, POST, POST /bulk, DELETE) and /station/config
 * (to know how many active bays the station has, used as default capacity).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, postWithApi, deleteWithApi } from '@/services';
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
    config: { wash_post_count: number | null };
    posts: Array<{ id: string; position: number; is_active: boolean }>;
  };
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
  // /time_slots have no per-bay info — we surface capacity through the existing
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

  // All currently visible blocks across the month, flattened — feeds the side panel
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

    // Edit = delete the old slot first, then bulk-create the replacement set.
    // Slots are independent rows so cross-date edits become "rewrite the set".
    if (editingBlock) {
      await deleteWithApi(`/station/slots/${editingBlock.id}`);
    }

    // Capacity: if "all bays" → use the active-bay count; otherwise the count of selected bays.
    const capacity = data.bayIds.includes('all') ? activeBays : data.bayIds.length;
    const safeCapacity = Math.max(1, capacity);

    const newSlots = data.dates.map((date) => ({
      start_time: `${date}T${data.startTime}:00`,
      end_time: `${date}T${data.endTime}:00`,
      capacity: safeCapacity,
    }));

    let ok = false;
    if (newSlots.length === 1) {
      const [success1] = await postWithApi('/station/slots', newSlots[0]);
      ok = success1;
    } else {
      const [success1] = await postWithApi('/station/slots/bulk', { slots: newSlots });
      ok = success1;
    }

    if (!mountedRef.current) return;

    if (!ok) {
      showError(t('availability_save_error'));
      return;
    }

    success(t('availability_save_success'));
    setEditingBlock(null);

    // Refetch every affected date in parallel (also re-fetch the old date if the edit moved it)
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

  if (initialLoading) {
    return <PageLoader label={t('loading')} />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="border-b border-[#C49A1E]/20 px-6 py-4 dark:border-[#C49A1E]/10">
        <h1 className="text-2xl font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
          {t('availability_title')}
        </h1>
        <p className="mt-0.5 text-sm text-[#666] dark:text-[#A0A090]">
          {t('availability_subtitle')}
        </p>
      </div>

      {/* Main two-panel layout — stacked on mobile, side-by-side on desktop */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <BlocksPanel
          blocks={allBlocks}
          onDelete={handleDelete}
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

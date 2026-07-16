'use client';

/**
 * Disponibilité — per-post calendar. A post selector at the top scopes the
 * familiar two-panel calendar + blocks to one wash bay; each created slot is
 * bound to that post (time_slots.post_id). Legacy slots with no post_id show
 * under every post until re-created.
 *
 * Backed by /station/slots (GET, POST, /bulk, /replace, DELETE) + /station/config.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { getFromApi, postWithApi, deleteWithApi, updateWithApi } from '@/services';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import { BlocksPanel } from '@/components/station/availability/BlocksPanel';
import { AllPostsBlocksPanel } from '@/components/station/availability/AllPostsBlocksPanel';
import { MonthCalendar } from '@/components/station/availability/MonthCalendar';
import { CreateBlockModal } from '@/components/station/availability/CreateBlockModal';
import { DayDetailsModal } from '@/components/station/availability/DayDetailsModal';
import { PageLoader } from '@/components/ui/PageLoader';
import type { AvailabilityBlock } from '@/components/station/availability/types';

interface RawSlot {
  id: string;
  post_id: string | null;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: string;
}

interface StationPost { id: string; position: number; is_active: boolean }

interface RawConfig {
  data: {
    config: { wash_post_count: number | null; opening_time?: string | null; closing_time?: string | null };
    posts: StationPost[];
  };
}

function extractHHMM(time: string | null | undefined, fallback: string): string {
  if (!time) return fallback;
  const m = String(time).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : fallback;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function extractTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function localTimeToIsoUtc(date: string, time: string): string {
  const local = new Date(`${date}T${time}:00`);
  if (Number.isNaN(local.getTime())) throw new Error(`Invalid date/time combination: ${date} ${time}`);
  return local.toISOString();
}

function enumerateMonth(month: Date): string[] {
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
  return {
    id: slot.id,
    dates: [dateISO],
    startTime: extractTime(slot.start_time),
    endTime: extractTime(slot.end_time),
    bayIds: ['all'],
    postId: slot.post_id,
  };
}

/** Sentinel post id for the "all posts" aggregated view. */
const ALL_POSTS = 'all';

export default function StationAvailabilityPage() {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();
  const { error: showError, success } = useToast();
  const { isLoading: authLoading } = useAuth();
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [slotsByDate, setSlotsByDate] = useState<Record<string, RawSlot[]>>({});
  const [posts, setPosts] = useState<StationPost[]>([]);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('18:00');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [initialLoading, setInitialLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<AvailabilityBlock | null>(null);
  const [preselectedDate, setPreselectedDate] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);

  const fetchSlotsForDate = useCallback(async (date: string): Promise<RawSlot[]> => {
    const [ok, data] = await getFromApi(`/station/slots?date=${date}`);
    if (!ok) return [];
    return (data as { data?: { slots?: RawSlot[] } })?.data?.slots ?? [];
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
      dates.forEach((d, i) => { next[d] = results[i]; });
      setSlotsByDate(next);
    },
    [fetchSlotsForDate],
  );

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
        const activePosts = (cfg.posts ?? []).filter((p) => p.is_active).sort((a, b) => a.position - b.position);
        setPosts(activePosts);
        setActivePostId((prev) => prev ?? activePosts[0]?.id ?? null);
        setOpeningTime(extractHHMM(cfg.config?.opening_time, '08:00'));
        setClosingTime(extractHHMM(cfg.config?.closing_time, '18:00'));
      }
      setInitialLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authLoading, currentMonth, fetchMonth]);

  // A slot belongs to the active post, or is a legacy (post-less) slot shown
  // everywhere. In the "all posts" view every slot matches.
  const slotMatchesActive = useCallback(
    (s: RawSlot) => activePostId === ALL_POSTS || s.post_id === activePostId || !s.post_id,
    [activePostId],
  );

  function getBlocksForDate(dateISO: string): AvailabilityBlock[] {
    return (slotsByDate[dateISO] ?? []).filter(slotMatchesActive).map((s) => slotToBlock(s, dateISO));
  }

  const allBlocks: AvailabilityBlock[] = Object.entries(slotsByDate)
    .flatMap(([date, slots]) => slots.filter(slotMatchesActive).map((s) => slotToBlock(s, date)))
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

    /* Target posts. Editing stays scoped to the edited block's own post (falling
     * back to the viewed post for legacy post-less slots), so it works from the
     * aggregated "all posts" view too; creating honours the modal's multi-select
     * ('all' or a list of post ids). */
    const editFallbackPost = activePostId && activePostId !== ALL_POSTS ? [activePostId] : posts.map((p) => p.id);
    const targetPostIds = editingBlock
      ? (editingBlock.postId ? [editingBlock.postId] : editFallbackPost)
      : (data.bayIds.includes('all') || data.bayIds.length === 0
          ? posts.map((p) => p.id)
          : data.bayIds.filter((id) => posts.some((p) => p.id === id)));
    if (targetPostIds.length === 0) return;

    // One slot per date per selected post (one car per post at a time → capacity 1).
    const newSlots = data.dates.flatMap((date) =>
      targetPostIds.map((postId) => ({
        start_time: localTimeToIsoUtc(date, data.startTime),
        end_time: localTimeToIsoUtc(date, data.endTime),
        capacity: 1,
        post_id: postId,
      })),
    );

    let ok = false;
    if (editingBlock) {
      const idsToDelete = editingBlock.ids ?? [editingBlock.id];
      const [replaceOk] = await updateWithApi('/station/slots/replace', { ids_to_delete: idsToDelete, slots: newSlots });
      ok = replaceOk;
    } else if (newSlots.length === 1) {
      const [s1] = await postWithApi('/station/slots', newSlots[0]);
      ok = s1;
    } else {
      const [s1] = await postWithApi('/station/slots/bulk', { slots: newSlots });
      ok = s1;
    }

    if (!mountedRef.current) return;
    if (!ok) { showError(t('availability_save_error')); return; }

    success(t('availability_save_success'));
    setEditingBlock(null);
    const datesToRefresh = new Set(data.dates);
    if (editingBlock) editingBlock.dates.forEach((d) => datesToRefresh.add(d));
    await Promise.all(Array.from(datesToRefresh).map(refreshDate));
  }

  async function handleDelete(slotId: string) {
    const [ok, raw] = await deleteWithApi(`/station/slots/${slotId}`);
    if (!mountedRef.current) return;

    if (!ok) {
      const code = (raw as { code?: string })?.code;
      showError(code === 'CONFLICT' ? t('availability_delete_has_reservations') : t('availability_delete_error'));
      return;
    }

    success(t('availability_delete_success'));

    for (const [date, slots] of Object.entries(slotsByDate)) {
      if (slots.some((s) => s.id === slotId)) { await refreshDate(date); break; }
    }
  }

  async function handleDeleteGroup(ids: string[]) {
    const [ok, raw] = await deleteWithApi('/station/slots', { autoJoin: false, data: { ids } });
    if (!mountedRef.current) return;

    if (!ok) {
      showError(t('availability_delete_error'));
      return;
    }

    type DeleteResult = { deleted?: string[]; failed?: Array<{ id: string; reason: string }> };
    const res = (raw as { data?: DeleteResult })?.data ?? (raw as DeleteResult);
    const deleted = res?.deleted ?? [];
    const failed = res?.failed ?? [];

    if (deleted.length === 0 && failed.length > 0) {
      showError(t('availability_delete_has_reservations'));
      return;
    }

    if (failed.length > 0) {
      showError(t('availability_delete_partial_error'));
    } else {
      success(t('availability_delete_success'));
    }

    const datesToRefresh = new Set<string>();
    for (const [date, slots] of Object.entries(slotsByDate)) {
      if (slots.some((s) => deleted.includes(s.id))) datesToRefresh.add(date);
    }
    await Promise.all(Array.from(datesToRefresh).map(refreshDate));
  }

  if (initialLoading) return <PageLoader label={t('loading')} />;

  const isAllPostsView = activePostId === ALL_POSTS;
  const activePost = posts.find((p) => p.id === activePostId) ?? null;
  const activePostLabel = activePost ? `${t('availability_modal_poste')} ${activePost.position}` : undefined;

  // Label of the post owning the block being edited — keeps the edit modal
  // scoped and clearly labelled even from the aggregated "all posts" view.
  const editingPost = editingBlock?.postId ? posts.find((p) => p.id === editingBlock.postId) ?? null : null;
  const editingPostLabel = editingPost ? `${t('availability_modal_poste')} ${editingPost.position}` : activePostLabel;

  // For the aggregated "all posts" view: one bucket per active post, each also
  // carrying legacy (post-less) slots since those apply to every post.
  const postsBlocks = posts.map((post) => ({
    post,
    blocks: Object.entries(slotsByDate).flatMap(([date, slots]) =>
      slots.filter((s) => s.post_id === post.id || !s.post_id).map((s) => slotToBlock(s, date)),
    ),
  }));

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex flex-col gap-3 border-b border-[#DDAF3B]/20 px-4 py-4 dark:border-[#DDAF3B]/10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-[#001201] dark:text-[#FFF9EC]">{t('availability_title')}</h1>
          <p className="mt-0.5 text-sm text-foreground/65 dark:text-[#B0BFB1]">{t('availability_subtitle')}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link href={`/${locale}/station/config?tab=hours`} className="inline-flex items-center gap-1.5 rounded-xl border border-[#FFF9EC] bg-white px-3 py-2 text-[12px] font-bold text-[#5A5A4A] transition-colors hover:border-[#DDAF3B]/40 hover:text-[#DDAF3B] dark:border-[#001A05] dark:bg-[#182214] dark:text-[#B0BFB1]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
            {t('availability_link_hours')}
          </Link>
          <Link href={`/${locale}/station/config?tab=capacity`} className="inline-flex items-center gap-1.5 rounded-xl border border-[#FFF9EC] bg-white px-3 py-2 text-[12px] font-bold text-[#5A5A4A] transition-colors hover:border-[#DDAF3B]/40 hover:text-[#DDAF3B] dark:border-[#001A05] dark:bg-[#182214] dark:text-[#B0BFB1]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
            {t('availability_link_capacity')}
          </Link>
        </div>
      </div>

      {/* Post selector — scopes the calendar to one wash bay */}
      {posts.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-[#DDAF3B]/15 px-4 py-2.5 sm:px-6">
          <span className="shrink-0 text-[11px] font-black uppercase tracking-[1px] text-[#AAAAAA] dark:text-[#5A5A4A]">
            {t('post_selector_label')}
          </span>
          {posts.length > 1 && (
            <button
              type="button"
              onClick={() => setActivePostId(ALL_POSTS)}
              aria-pressed={activePostId === ALL_POSTS}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                activePostId === ALL_POSTS
                  ? 'bg-[#DDAF3B] text-[#001201]'
                  : 'border border-[#DDAF3B]/30 text-[#5A5A4A] hover:bg-[#DDAF3B]/10 dark:text-[#B0BFB1]'
              }`}
            >
              {t('availability_all_postes_short')}
            </button>
          )}
          {posts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePostId(p.id)}
              aria-pressed={p.id === activePostId}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                p.id === activePostId
                  ? 'bg-[#DDAF3B] text-[#001201]'
                  : 'border border-[#DDAF3B]/30 text-[#5A5A4A] hover:bg-[#DDAF3B]/10 dark:text-[#B0BFB1]'
              }`}
            >
              {t('availability_modal_poste')} {p.position}
            </button>
          ))}
        </div>
      )}

      {/* Two-panel calendar */}
      <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        {isAllPostsView ? (
          <AllPostsBlocksPanel
            postsBlocks={postsBlocks}
            onSelectPost={setActivePostId}
            onCreateClick={openCreateModal}
          />
        ) : (
          <BlocksPanel blocks={allBlocks} onDelete={handleDeleteGroup} onEdit={openEditModal} onCreateClick={openCreateModal} />
        )}
        <MonthCalendar currentMonth={currentMonth} onMonthChange={setCurrentMonth} getBlocksForDate={getBlocksForDate} onDayClick={handleDayClick} selectedDateISO={selectedDay} />
      </div>

      <CreateBlockModal
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); setEditingBlock(null); setPreselectedDate(null); }}
        onSave={handleSave}
        editingBlock={editingBlock}
        numBays={Math.max(1, posts.length)}
        posts={posts}
        defaultPostId={activePostId}
        defaultStartTime={openingTime}
        defaultEndTime={closingTime}
        /* Editing an existing slot stays scoped to the viewed post; creating lets the
           merchant pick one or several posts via the modal's multi-select. */
        lockedPostLabel={editingBlock ? editingPostLabel : undefined}
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

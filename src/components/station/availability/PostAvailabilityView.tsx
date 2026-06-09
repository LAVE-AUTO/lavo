'use client';

/**
 * Per-post availability — one section per wash bay, each with a Mon→Sun editable
 * schedule bounded by the station's own hours. Backed by GET /station/posts/hours
 * and PUT /station/posts/:postId/hours. The server enforces the "within station
 * hours" rule; a rejected save surfaces the reason as a toast.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, updateWithApi } from '@/services';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import { PageLoader } from '@/components/ui/PageLoader';
import { HoursDayRow } from '@/components/station/config/tabs/HoursDayRow';

interface HourWindow {
  day_of_week: number;
  is_open: boolean;
  morning_start: string | null;
  morning_end: string | null;
  afternoon_start: string | null;
  afternoon_end: string | null;
}
interface PostHours {
  post_id: string;
  position: number;
  hours: HourWindow[];
}

/** index 0..6 = Sunday..Saturday, matching day_of_week */
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
/** Display order Monday → Sunday */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function toHHMM(t: string | null): string {
  if (!t) return '';
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

export function PostAvailabilityView() {
  const t = useTranslations('station_dashboard');
  const tc = useTranslations('station_config');
  const { success, error: showError } = useToast();
  const { isLoading: authLoading } = useAuth();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [posts, setPosts] = useState<PostHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPost, setSavingPost] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [ok, data] = await getFromApi('/station/posts/hours');
    if (!mountedRef.current) return;
    if (!ok) { showError(t('post_avail_load_error')); setLoading(false); return; }
    const rows = (data as { data?: PostHours[] })?.data ?? [];
    setPosts(rows);
    setExpanded(rows[0]?.post_id ?? null);
    setLoading(false);
  }, [showError, t]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  function updateDay(postId: string, dayOfWeek: number, patch: Partial<HourWindow>) {
    setPosts((prev) =>
      prev.map((p) =>
        p.post_id !== postId
          ? p
          : { ...p, hours: p.hours.map((h) => (h.day_of_week === dayOfWeek ? { ...h, ...patch } : h)) },
      ),
    );
  }

  async function savePost(postId: string) {
    const post = posts.find((p) => p.post_id === postId);
    if (!post) return;
    setSavingPost(postId);
    const [ok, data] = await updateWithApi(`/station/posts/${postId}/hours`, { days: post.hours });
    if (!mountedRef.current) return;
    setSavingPost(null);
    if (ok) {
      success(t('post_avail_saved'));
    } else {
      // Surface the server's bound-violation reason when present.
      const msg = (data as { message?: string })?.message;
      showError(msg || t('post_avail_save_error'));
    }
  }

  if (loading) return <PageLoader label={t('loading')} />;

  if (posts.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-foreground/65 dark:text-[#B0BFB1]">
        {t('post_avail_no_posts')}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
      <p className="rounded-xl border border-[#DDAF3B]/30 bg-[#DDAF3B]/8 px-4 py-3 text-[12px] leading-relaxed text-[#7A5A00] dark:text-[#E0C060]">
        {t('post_avail_bounded_hint')}
      </p>

      {posts.map((post) => {
        const isOpen = expanded === post.post_id;
        const byDay = new Map(post.hours.map((h) => [h.day_of_week, h]));
        return (
          <section
            key={post.post_id}
            className="overflow-hidden rounded-2xl border border-separator/25 bg-card-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-[#1A2A14] dark:bg-[#182214]"
          >
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : post.post_id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DDAF3B]/12 text-[13px] font-black text-[#DDAF3B]">
                  {post.position}
                </span>
                <span className="text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]">
                  {t('availability_modal_poste')} {post.position}
                </span>
              </span>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                className={`text-[#DDAF3B] transition-transform ${isOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isOpen && (
              <div className="border-t border-[#F0EDE4] px-5 py-4 dark:border-[#1A2A14]">
                <div className="hidden sm:grid sm:grid-cols-[100px_44px_1fr] sm:gap-3 border-b border-[#FFF9EC] pb-2 text-[10px] font-bold uppercase tracking-[0.5px] text-[#AAAAAA] dark:border-[#001A05] dark:text-[#5A5A4A]">
                  <span />
                  <span />
                  <div className="grid grid-cols-2 gap-2">
                    <span>{tc('hours_morning')}</span>
                    <span>{tc('hours_afternoon')}</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  {DISPLAY_ORDER.map((dow) => {
                    const day = byDay.get(dow);
                    if (!day) return null;
                    return (
                      <HoursDayRow
                        key={dow}
                        dayLabel={tc(`hours_day_${DAY_KEYS[dow]}`)}
                        enabled={day.is_open}
                        morningStart={toHHMM(day.morning_start)}
                        morningEnd={toHHMM(day.morning_end)}
                        afternoonStart={toHHMM(day.afternoon_start)}
                        afternoonEnd={toHHMM(day.afternoon_end)}
                        disabled={savingPost === post.post_id}
                        onToggle={(v) => updateDay(post.post_id, dow, { is_open: v })}
                        onMorningStartChange={(v) => updateDay(post.post_id, dow, { morning_start: v || null })}
                        onMorningEndChange={(v) => updateDay(post.post_id, dow, { morning_end: v || null })}
                        onAfternoonStartChange={(v) => updateDay(post.post_id, dow, { afternoon_start: v || null })}
                        onAfternoonEndChange={(v) => updateDay(post.post_id, dow, { afternoon_end: v || null })}
                      />
                    );
                  })}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => savePost(post.post_id)}
                    disabled={savingPost === post.post_id}
                    className="flex items-center gap-2 rounded-xl bg-[#DDAF3B] px-6 py-2.5 text-[13px] font-bold text-[#001201] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingPost === post.post_id ? (
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    ) : null}
                    {t('post_avail_save')}
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

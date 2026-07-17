'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { groupBlocks, formatDates } from './blocks-helpers';
import type { AvailabilityBlock } from './types';

export interface PostBlocks {
  post: { id: string; position: number };
  blocks: AvailabilityBlock[];
}

interface Props {
  /** One entry per active wash post, with its own availability blocks. */
  postsBlocks: PostBlocks[];
  /** Switch to a single-post tab (used by the "see more" action). */
  onSelectPost: (postId: string) => void;
  onCreateClick: () => void;
}

/** Cap of availability cards shown per post before the "see more" link appears —
 *  keeps the aggregated overview readable without scrolling one post forever. */
const MAX_PER_POST = 5;

/**
 * "Tous" (all posts) panel for the availability screen. Instead of one flat
 * list scoped to a single post, it groups availabilities per wash post in
 * collapsible sections, showing at most MAX_PER_POST cards each. Beyond that a
 * "see more" button jumps to the dedicated post tab.
 */
export function AllPostsBlocksPanel({ postsBlocks, onSelectPost, onCreateClick }: Props) {
  const t = useTranslations('station_dashboard');
  const locale = useLocale();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(postId: string) {
    setCollapsed((prev) => ({ ...prev, [postId]: !prev[postId] }));
  }

  return (
    <div className="flex w-full shrink-0 flex-col border-b border-[#DDAF3B]/20 bg-[#F0EDE0] dark:border-[#DDAF3B]/10 dark:bg-[#1A2210] md:w-72 md:border-b-0 md:border-r">
      {/* Title */}
      <div className="px-4 pt-5 pb-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/65 dark:text-[#B0BFB1]">
          {t('availability_blocks_title')}
        </p>
      </div>

      {/* Per-post collapsible sections */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {postsBlocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-card-surface/60 px-4 py-10 text-center dark:bg-[#001A05]/60">
            <p className="text-xs text-foreground/65 dark:text-[#B0BFB1]">
              {t('availability_block_no_blocks')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {postsBlocks.map(({ post, blocks }) => {
              const grouped = groupBlocks(blocks);
              const isCollapsed = collapsed[post.id] ?? false;
              const visible = grouped.slice(0, MAX_PER_POST);
              const remaining = grouped.length - visible.length;

              return (
                <div
                  key={post.id}
                  className="overflow-hidden rounded-xl border border-separator/25 bg-card-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-[#DDAF3B]/10 dark:bg-[#001A05]"
                >
                  {/* Section header — collapse toggle */}
                  <button
                    type="button"
                    onClick={() => toggle(post.id)}
                    aria-expanded={!isCollapsed}
                    className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-[#DDAF3B]/5"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-black text-[#001201] dark:text-[#FFF9EC]">
                        {t('availability_modal_poste')} {post.position}
                      </span>
                      <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#DDAF3B]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#DDAF3B]">
                        {grouped.length}
                      </span>
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={`shrink-0 text-[#B0BFB1] transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {!isCollapsed && (
                    <div className="flex flex-col gap-1.5 border-t border-separator/20 px-3 pb-3 pt-2.5 dark:border-[#DDAF3B]/10">
                      {grouped.length === 0 ? (
                        <p className="py-2 text-center text-[11px] text-foreground/55 dark:text-[#B0BFB1]">
                          {t('availability_post_no_slots')}
                        </p>
                      ) : (
                        <>
                          {visible.map((group) => (
                            <button
                              key={(group.ids ?? [group.id]).join('|')}
                              type="button"
                              onClick={() => onSelectPost(post.id)}
                              className="flex w-full items-center justify-between gap-2 rounded-lg bg-[#F0EDE0] px-3 py-2 text-left transition-colors hover:bg-[#DDAF3B]/10 dark:bg-[#0F1A0B]"
                            >
                              <span className="min-w-0 truncate text-[12px] font-bold text-[#001201] dark:text-[#FFF9EC]">
                                {formatDates(group.dates, locale)}
                              </span>
                              <span className="shrink-0 text-[12px] font-black text-[#DDAF3B]">
                                {group.startTime}–{group.endTime}
                              </span>
                            </button>
                          ))}
                          {remaining > 0 && (
                            <button
                              type="button"
                              onClick={() => onSelectPost(post.id)}
                              className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-lg border border-[#DDAF3B]/40 px-3 py-1.5 text-[11px] font-bold text-[#DDAF3B] transition-colors hover:bg-[#DDAF3B]/10"
                            >
                              {t('availability_see_more_count', { count: remaining })}
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create button pinned to bottom */}
      <div className="border-t border-[#DDAF3B]/20 p-3 dark:border-[#DDAF3B]/10">
        <button
          type="button"
          onClick={onCreateClick}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#DDAF3B] px-4 py-3 text-sm font-black text-[#001201] transition-colors hover:bg-[#A07818] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DDAF3B] focus-visible:ring-offset-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('availability_create_block')}
        </button>
      </div>
    </div>
  );
}

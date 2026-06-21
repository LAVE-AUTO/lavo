'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useTheme } from '@/context/theme-context';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';
import { deleteWithApi, getFromApi, patchWithApi } from '@/services/axios-service';

interface StationTopNavProps {
  /** Sidebar toggle handler, surfaced when the parent shell wants a
   *  mobile drawer. Mirrors AdminTopNav's API. */
  onToggleSidebar?: () => void;
  /** Optional station label displayed once below the logo. Kept for
   *  station UX continuity — admin nav does not need it. */
  stationName?: string;
}

type UserNotification = {
  id: string;
  title: string | null;
  body: string | null;
  is_read: boolean;
  action_url?: string | null;
  created_at?: string;
};

/**
 * Station top navigation bar.
 *
 * Structurally identical to AdminTopNav so the merchant/admin spaces
 * share the same chrome: translucent backdrop + blur + gold-tinted
 * border, edge-to-edge inner container (no max-width), same logo
 * treatment (locale + theme switch), 34×34 bordered round controls and
 * the same anchored notification panel.
 */
export function StationTopNav({ onToggleSidebar, stationName }: StationTopNavProps) {
  const t = useTranslations('station_dashboard');
  const { resolvedTheme } = useTheme();
  const locale = useLocale();

  const isDark = resolvedTheme === 'dark';
  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';
  const darkLogoSrc  = locale === 'fr' ? '/logo/logo_anglais_2.png' : '/logo/logo_anglais_2.png';

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [errorLoading, setErrorLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    (async () => {
      const [ok, data] = await getFromApi<{ data?: { unread_count: number } }>('/me/notifications/unread-count');
      if (!ok || !data || typeof data !== 'object' || !('data' in data)) return;
      setUnreadCount(data.data?.unread_count ?? 0);
    })();
  }, []);

  async function refreshUnread() {
    const [ok, data] = await getFromApi<{ data?: { unread_count: number } }>('/me/notifications/unread-count');
    if (!ok || !data || typeof data !== 'object' || !('data' in data)) return;
    setUnreadCount(data.data?.unread_count ?? 0);
  }

  async function openNotifications() {
    setIsOpen((v) => !v);
    if (isOpen) return;
    setLoading(true);
    setErrorLoading(false);
    const [ok, data] = await getFromApi<{ data?: { items: UserNotification[]; unread_count: number; next_cursor?: string | null } }>('/me/notifications?limit=20');
    if (ok && data && typeof data === 'object' && 'data' in data) {
      setItems(data.data?.items ?? []);
      setUnreadCount(data.data?.unread_count ?? 0);
      setNextCursor(data.data?.next_cursor ?? null);
      /* Opening the panel marks everything as read. */
      if ((data.data?.unread_count ?? 0) > 0) void markAllRead();
    } else {
      setErrorLoading(true);
    }
    setLoading(false);
  }

  async function loadMoreNotifications() {
    if (!nextCursor) return;
    const [ok, data] = await getFromApi<{ data?: { items: UserNotification[]; next_cursor: string | null } }>(
      `/me/notifications?limit=20&cursor=${encodeURIComponent(nextCursor)}`
    );
    if (!ok || !data || typeof data !== 'object' || !('data' in data)) return;
    const incoming = data.data?.items ?? [];
    setItems((prev) => [...prev, ...incoming]);
    setNextCursor(data.data?.next_cursor ?? null);
  }

  async function markOneRead(id: string) {
    const [ok] = await patchWithApi(`/me/notifications/${id}/read`, {});
    if (!ok) return;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    void refreshUnread();
  }

  async function markAllRead() {
    const [ok] = await patchWithApi('/me/notifications/read-all', {});
    if (!ok) return;
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  }

  async function removeOne(id: string) {
    const [ok] = await deleteWithApi(`/me/notifications/${id}`);
    if (!ok) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
    void refreshUnread();
  }

  const notifPanelStyle = {
    backgroundColor: isDark ? '#001201' : '#FFF9EC',
    color: isDark ? '#FFF9EC' : '#001A05',
  } as const;

  return (
    <header className="relative z-50 flex-shrink-0 bg-[#FFF9EC] dark:bg-dark-bg backdrop-blur-[16px] border-b border-[rgba(221,175,59,0.18)]">
      {/* Edge-to-edge: station space spans the full window width with just a
          comfortable lateral padding, matching AdminTopNav. */}
      <div className="px-4 lg:px-8 flex items-center justify-between gap-6 py-2 sm:px-6">

        {/* Left cluster: sidebar toggle (when provided) + logo + optional station name */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Menu"
              className="flex h-[34px] w-[34px] items-center justify-center text-foreground transition-colors hover:text-[#DDAF3B] dark:text-Hurryline-muted lg:hidden"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}

          {/* Logo - always links to the merchant landing page (NAV-1 rule):
              a logged-in station belongs to the merchant universe, not the
              client landing at "/". */}
          <Link href="/merchant" className="shrink-0" aria-label="Hurryline - Accueil" suppressHydrationWarning>
            <Image
              src={isDark ? darkLogoSrc : lightLogoSrc}
              alt={t('logo_alt')}
              width={130}
              height={34}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>

          {/* Station identity breadcrumb. Lives between the logo and the
              right cluster so the merchant always knows which station
              they are operating, without competing with the logo. The
              whole block is a discrete link to the station settings. */}
          {stationName && (
            <>
              <span
                className="hidden sm:block h-7 w-px bg-[rgba(221,175,59,0.28)] dark:bg-[rgba(221,175,59,0.22)]"
                aria-hidden="true"
              />
              <Link
                href="/station/config"
                className="group hidden sm:flex items-center gap-2.5 min-w-0 -mx-1 px-1 py-1 rounded-md transition-colors hover:bg-[rgba(221,175,59,0.06)]"
                aria-label={t('station_identity_aria', { name: stationName })}
              >
                {/* Storefront pastille — gold-tinted disc with the same 34x34
                    footprint as the right-side controls, keeping vertical
                    rhythm consistent across the bar. */}
                <span className="hidden sm:flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[rgba(221,175,59,0.28)] bg-[rgba(221,175,59,0.10)] text-[#DDAF3B] shrink-0 group-hover:border-[#DDAF3B] transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 9l2-5h14l2 5" />
                    <path d="M3 9v11a1 1 0 001 1h4v-7h8v7h4a1 1 0 001-1V9" />
                    <path d="M3 9h18" />
                  </svg>
                </span>

                {/* Eyebrow + station name. Mobile shows the name only;
                    desktop adds the small gold eyebrow for the premium
                    'workspace switcher' feel found in app shells. */}
                <span className="min-w-0 flex flex-col leading-none">
                  <span className="hidden sm:block font-bebas text-[10px] tracking-[0.22em] uppercase text-[#DDAF3B]/85">
                    {t('station_identity_eyebrow')}
                  </span>
                  <span className="text-[13px] sm:text-[14.5px] font-bold text-foreground dark:text-[#FFEECA] truncate max-w-[160px] sm:max-w-[220px] sm:mt-1 group-hover:text-[#DDAF3B] transition-colors">
                    {stationName}
                  </span>
                </span>
              </Link>
            </>
          )}
        </div>

        {/* Right controls - mirror Admin: theme, lang, notifs */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <LangToggle />

          <div className="relative" ref={panelRef}>
            <button
              type="button"
              aria-label={t('notif_tooltip')}
              title={t('notif_tooltip')}
              onClick={openNotifications}
              className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#FFF9EC] text-[var(--foreground)] transition-colors hover:border-[#DDAF3B] hover:text-[#DDAF3B] dark:text-[#B0BFB1]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] rounded-full bg-Hurryline-error px-1 text-center text-[10px] font-black leading-[18px] text-white shadow-sm ring-2 ring-white dark:ring-dark-bg">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {isOpen && (
              <div
                className="absolute right-0 top-[calc(100%+10px)] z-50 w-80 max-w-[calc(100vw-1rem)] rounded-xl p-3 shadow-xl sm:w-96"
                style={notifPanelStyle}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold" style={{ color: isDark ? '#FFF9EC' : '#001A05' }}>
                    {t('notif_title')}
                  </div>
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs font-semibold hover:underline"
                    style={{ color: '#DDAF3B' }}
                  >
                    {t('notif_mark_all_read')}
                  </button>
                </div>

                {loading ? (
                  <div className="py-4 text-sm" style={{ color: '#B0BFB1' }}>{t('notif_loading')}</div>
                ) : null}
                {!loading && errorLoading ? (
                  <div className="py-4 text-sm" style={{ color: '#FF383C' }}>{t('notif_error')}</div>
                ) : null}
                {!loading && !errorLoading && items.length === 0 ? (
                  <div className="py-4 text-sm" style={{ color: '#B0BFB1' }}>{t('notif_empty')}</div>
                ) : null}
                {!loading && items.length > 0 ? (
                  <div className="max-h-96 space-y-2 overflow-auto">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg p-2"
                        style={{
                          backgroundColor: isDark ? '#001A05' : (item.is_read ? '#FFF9EC' : '#FFEECA'),
                        }}
                      >
                        <div className="text-xs font-semibold" style={{ color: isDark ? '#FFF9EC' : '#001A05' }}>
                          {item.title ?? t('notif_default_title')}
                        </div>
                        <div className="mt-0.5 text-xs" style={{ color: '#B0BFB1' }}>
                          {item.body ?? '-'}
                        </div>
                        {item.created_at && (
                          <div className="mt-1 text-[11px]" style={{ color: isDark ? '#A9A38F' : '#7A7668' }}>
                            {new Date(item.created_at).toLocaleString(locale === 'en' ? 'en-CA' : 'fr-CA')}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          {item.action_url && (
                            <Link
                              href={item.action_url}
                              className="text-xs font-semibold hover:underline"
                              style={{ color: '#DDAF3B' }}
                            >
                              {t('notif_open_cta')}
                            </Link>
                          )}
                          {!item.is_read && (
                            <button
                              type="button"
                              onClick={() => markOneRead(item.id)}
                              className="text-xs font-semibold hover:underline"
                              style={{ color: isDark ? '#8ED17C' : '#001A05' }}
                            >
                              {t('notif_mark_read')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeOne(item.id)}
                            className="text-xs font-semibold hover:underline"
                            style={{ color: '#FF383C' }}
                          >
                            {t('notif_delete')}
                          </button>
                        </div>
                      </div>
                    ))}
                    {nextCursor && (
                      <button
                        type="button"
                        onClick={loadMoreNotifications}
                        className="w-full rounded-lg border border-[#FFF9EC] px-3 py-2 text-xs font-semibold text-[#DDAF3B] transition-colors hover:bg-[#FFEECA] dark:hover:bg-[#001A05]"
                      >
                        {t('notif_load_more')}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

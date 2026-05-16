'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { LangToggle } from '@/components/auth/LangToggle';
import { deleteWithApi, getFromApi, patchWithApi } from '@/services/axios-service';

interface StationTopNavProps {
  stationName?: string;
}

export function StationTopNav({ stationName }: StationTopNavProps) {
  const t = useTranslations('station_dashboard');
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const locale = useLocale();

  const isDark = resolvedTheme === 'dark';
  const displayName = stationName ?? user?.first_name ?? 'Station';
  const lightLogoSrc = locale === 'fr' ? '/logo/logo2_2.png' : '/logo/logo_anglais_1.png';
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
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
    const [ok, data] = await getFromApi<{ data?: { items: UserNotification[]; unread_count: number } }>('/me/notifications?limit=20');
    if (ok && data && typeof data === 'object' && 'data' in data) {
      setItems(data.data?.items ?? []);
      setUnreadCount(data.data?.unread_count ?? 0);
    }
    setLoading(false);
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
    backgroundColor: isDark ? '#121A10' : '#FFFDF8',
    color: isDark ? '#F3F1E8' : '#1B1B18',
  } as const;

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[#E0DCD0] bg-white px-6 dark:border-[#1A2A14] dark:bg-[#111A0E]">

      {/* Logo - always links to landing page */}
      <div className="flex flex-col justify-center">
        <Link href="/" aria-label="Hurryline - Accueil">
          {isDark ? (
            <div className="flex items-center gap-2">
              <div className="shrink-0 rounded-lg border border-[rgba(200,152,10,0.25)] bg-white/95 p-0.5 shadow-sm">
                <Image src="/logo/frame2.png" alt="" width={24} height={24} className="h-6 w-6 object-contain" aria-hidden="true" />
              </div>
              <span className="font-playfair text-[18px] font-black leading-none tracking-[3px] text-[#C49A1E]">
                Hurryline
              </span>
            </div>
          ) : (
            <Image
              src={lightLogoSrc}
              alt="Hurryline"
              width={110}
              height={30}
              className="h-8 w-auto object-contain"
              priority
            />
          )}
        </Link>
        <div className="mt-0.5 text-[11px] font-medium text-[#666] dark:text-[#A0A090]">
          {displayName}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LangToggle />

        <div className="relative" ref={panelRef}>
          <button
            type="button"
            aria-label={t('notif_tooltip')}
            title={t('notif_tooltip')}
            onClick={openNotifications}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#F0EDE0] hover:bg-[#E8E1CA] dark:bg-[#182214] dark:hover:bg-[#22301a]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] rounded-full bg-Hurryline-error px-1 text-center text-[10px] font-black leading-[18px] text-white shadow-sm ring-2 ring-[#F0EDE0] dark:ring-[#182214]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {isOpen && (
            <div
              className="absolute right-0 top-11 z-50 w-96 rounded-xl p-3 shadow-xl opacity-100 backdrop-blur-0"
              style={notifPanelStyle}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold" style={{ color: isDark ? '#F3F1E8' : '#1B1B18' }}>{t('notif_title')}</div>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: isDark ? '#E4C56A' : '#6B5A23' }}
                >
                  {t('notif_mark_all_read')}
                </button>
              </div>
              {loading ? <div className="py-4 text-sm" style={{ color: isDark ? '#C9C4B2' : '#5E5A4D' }}>{t('notif_loading')}</div> : null}
              {!loading && items.length === 0 ? <div className="py-4 text-sm" style={{ color: isDark ? '#C9C4B2' : '#5E5A4D' }}>{t('notif_empty')}</div> : null}
              {!loading && items.length > 0 ? (
                <div className="max-h-96 space-y-2 overflow-auto">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg p-2"
                      style={{
                        backgroundColor: isDark
                          ? (item.is_read ? '#1A2318' : '#242113')
                          : (item.is_read ? '#F4F1E8' : '#EEE7D2'),
                      }}
                    >
                      <div className="text-xs font-semibold" style={{ color: isDark ? '#F3F1E8' : '#1F1E19' }}>{item.title ?? t('notif_default_title')}</div>
                      <div className="mt-0.5 text-xs" style={{ color: isDark ? '#D2CEBE' : '#4F4C40' }}>{item.body ?? '-'}</div>
                      <div className="mt-2 flex items-center gap-3">
                        {!item.is_read && (
                          <button
                            type="button"
                            onClick={() => markOneRead(item.id)}
                            className="text-xs font-semibold hover:underline"
                            style={{ color: isDark ? '#8ED17C' : '#2E6125' }}
                          >
                            {t('notif_mark_read')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeOne(item.id)}
                          className="text-xs font-semibold hover:underline"
                          style={{ color: isDark ? '#FF9E8D' : '#8C3A2B' }}
                        >
                          {t('notif_delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

type UserNotification = {
  id: string;
  title: string | null;
  body: string | null;
  is_read: boolean;
};

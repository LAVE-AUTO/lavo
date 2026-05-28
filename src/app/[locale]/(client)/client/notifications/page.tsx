'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { deleteWithApi, getFromApi, patchWithApi } from '@/services/axios-service';
import { useTheme } from '@/context/theme-context';

type UserNotification = {
  id: string;
  title: string | null;
  body: string | null;
  is_read: boolean;
};

export default function ClientNotificationsPage() {
  const t = useTranslations('station_dashboard');
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<UserNotification[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ok, data] = await getFromApi<{ data?: { items: UserNotification[] } }>('/me/notifications?limit=50');
      if (ok && data && typeof data === 'object' && 'data' in data) {
        setItems(data.data?.items ?? []);
      }
      setLoading(false);
    })();
  }, []);

  async function markOneRead(id: string) {
    const [ok] = await patchWithApi(`/me/notifications/${id}/read`, {});
    if (!ok) return;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
  }

  async function markAllRead() {
    const [ok] = await patchWithApi('/me/notifications/read-all', {});
    if (!ok) return;
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
  }

  async function removeOne(id: string) {
    const [ok] = await deleteWithApi(`/me/notifications/${id}`);
    if (!ok) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-6 dark:bg-dark-bg sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-[22px] font-black text-foreground">{t('notif_title')}</h1>
          <button
            type="button"
            onClick={markAllRead}
            className="text-[13px] font-semibold hover:underline"
            style={{ color: isDark ? '#DDAF3B' : '#DDAF3B' }}
          >
            {t('notif_mark_all_read')}
          </button>
        </div>

        {loading ? <p className="text-sm" style={{ color: isDark ? '#B0BFB1' : '#B0BFB1' }}>{t('notif_loading')}</p> : null}
        {!loading && items.length === 0 ? <p className="text-sm" style={{ color: isDark ? '#B0BFB1' : '#B0BFB1' }}>{t('notif_empty')}</p> : null}

        {!loading && items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg p-3"
                style={{
                  backgroundColor: isDark
                    ? (item.is_read ? '#001A05' : '#001A05')
                    : (item.is_read ? '#FFF9EC' : '#FFEECA'),
                }}
              >
                <div className="text-[15px] font-bold" style={{ color: isDark ? '#FFF9EC' : '#001A05' }}>
                  {item.title ?? t('notif_default_title')}
                </div>
                <div className="mt-1 text-[14px]" style={{ color: isDark ? '#B0BFB1' : '#B0BFB1' }}>
                  {item.body ?? '-'}
                </div>
                <div className="mt-2 flex items-center gap-4">
                  {!item.is_read && (
                    <button
                      type="button"
                      onClick={() => markOneRead(item.id)}
                      className="text-[14px] font-semibold hover:underline"
                      style={{ color: isDark ? '#8ED17C' : '#001A05' }}
                    >
                      {t('notif_mark_read')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeOne(item.id)}
                    className="text-[14px] font-semibold hover:underline"
                    style={{ color: isDark ? '#FF383C' : '#FF383C' }}
                  >
                    {t('notif_delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}

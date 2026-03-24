'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services';
import { useToast } from '@/context/toast-context';
import { AdminStationsManagement } from './AdminStationsManagement';
import { AdminClientsList } from './AdminClientsList';

type Tab = 'stations' | 'clients';

export interface StationRow {
  id: string;
  name: string;
  city?: string | null;
  status: string;
  email?: string | null;
  created_at: string;
}

export function AdminMerchantsClients() {
  const t = useTranslations('admin_clients');
  const { success: toastSuccess, error: toastError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [tab, setTab]           = useState<Tab>('stations');
  const [stations, setStations] = useState<StationRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    getFromApi('/admin/stations?status=all').then(([ok, data]) => {
      if (!mountedRef.current) return;
      setLoading(false);
      if (ok) setStations(((data as { data: StationRow[] }).data) ?? []);
      else setFetchError(true);
    });
  }, []);

  async function handleStationAction(id: string, action: 'activate' | 'suspend') {
    // TODO: connect to API once endpoint is available (PATCH /admin/stations/:id)
    await new Promise((r) => setTimeout(r, 500));
    if (!mountedRef.current) return;
    setStations((prev) =>
      prev.map((s) => s.id === id ? { ...s, status: action === 'activate' ? 'active' : 'suspended' } : s)
    );
    toastSuccess(action === 'activate' ? t('toast_activated') : t('toast_suspended'));
  }

  async function handleClientAction(_id: string, action: 'activate' | 'suspend' | 'unblock') {
    // TODO: connect to API once endpoints are available (PATCH /admin/users/:id, POST /admin/users/:id/unblock)
    await new Promise((r) => setTimeout(r, 500));
    if (!mountedRef.current) return;
    const msg = action === 'activate' ? t('toast_activated') : action === 'suspend' ? t('toast_suspended') : t('toast_unblocked');
    toastSuccess(msg);
  }

  void toastError; // reserved for future real API errors

  const activeCount    = stations.filter((s) => s.status === 'active').length;
  const suspendedCount = stations.filter((s) => s.status === 'suspended').length;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'stations', label: t('tab_stations'), count: activeCount + suspendedCount },
    { id: 'clients',  label: t('tab_clients') },
  ];

  return (
    <div className="flex min-h-full flex-col">
      {/* Page header */}
      <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 pb-0 pt-5 dark:border-[#1A2A14] dark:bg-[#0C1209]">
        <h1 className="text-[20px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
        <p className="mt-1 text-[12px] text-[#777] dark:text-[#6A6A5A]">{t('page_subtitle')}</p>

        <div className="mt-4 flex gap-0.5">
          {tabs.map(({ id, label, count }) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={[
                'relative flex items-center gap-2 rounded-t-lg px-5 py-2.5 text-[12px] font-bold transition-colors duration-150',
                tab === id
                  ? 'bg-white text-[#1A1A0A] shadow-sm dark:bg-[#1A2416] dark:text-[#F0EDD4]'
                  : 'text-[#888] hover:text-[#555] dark:text-[#6A6A5A] dark:hover:text-[#9A9A8A]',
              ].join(' ')}>
              {label}
              {count !== undefined && (
                <span className={[
                  'rounded-full px-1.5 py-0.5 text-[10px] font-black',
                  tab === id ? 'bg-[#C49A1E]/15 text-[#C49A1E]' : 'bg-[#E8E4D8] text-[#888] dark:bg-[#1E2E18] dark:text-[#5A5A4A]',
                ].join(' ')}>{count}</span>
              )}
              {tab === id && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-[#C49A1E]" />}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto bg-white p-6 dark:bg-[#1A2416]">
        {tab === 'stations'
          ? <AdminStationsManagement stations={stations} loading={loading} error={fetchError} onAction={handleStationAction} />
          : <AdminClientsList onAction={handleClientAction} />
        }
      </div>
    </div>
  );
}

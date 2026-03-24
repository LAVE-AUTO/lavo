'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services';
import { useToast } from '@/context/toast-context';
import { AdminStationsManagement } from './AdminStationsManagement';
import { AdminClientsList } from './AdminClientsList';

type Tab = 'stations' | 'clients';

export interface StationRow {
  id: string; name: string; city?: string | null;
  status: string; email?: string | null; created_at: string;
}

export function AdminMerchantsClients() {
  const t = useTranslations('admin_clients');
  const { success: toastSuccess } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [tab, setTab]               = useState<Tab>('stations');
  const [stations, setStations]     = useState<StationRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [query, setQuery]           = useState('');

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
    setStations((prev) => prev.map((s) => s.id === id ? { ...s, status: action === 'activate' ? 'active' : 'suspended' } : s));
    toastSuccess(action === 'activate' ? t('toast_activated') : t('toast_suspended'));
  }

  async function handleClientAction(_id: string, action: 'activate' | 'suspend' | 'unblock') {
    // TODO: connect to API once endpoints are available (PATCH /admin/users/:id, POST /admin/users/:id/unblock)
    await new Promise((r) => setTimeout(r, 500));
    if (!mountedRef.current) return;
    toastSuccess(action === 'activate' ? t('toast_activated') : action === 'suspend' ? t('toast_suspended') : t('toast_unblocked'));
  }

  const managed   = stations.filter((s) => s.status === 'active' || s.status === 'suspended');
  const actives   = managed.filter((s) => s.status === 'active').length;
  const suspended = managed.filter((s) => s.status === 'suspended').length;

  const MOCK_CLIENT_COUNT = 6;
  const tabs = [
    { id: 'stations' as Tab, count: loading ? '…' : managed.length },
    { id: 'clients'  as Tab, count: MOCK_CLIENT_COUNT },
  ];

  return (
    <div className="flex min-h-full flex-col">

      {/* Header */}
      <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 pb-0 pt-6 dark:border-[#1A2A14] dark:bg-[#0C1209]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
            <p className="mt-1 text-[12px] text-[#888] dark:text-[#6A6A5A]">{t('page_subtitle')}</p>
          </div>
          {/* Live status chips */}
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <span className="flex items-center gap-1.5 rounded-full border border-[#00C851]/20 bg-[#00C851]/8 px-3 py-1 text-[11px] font-bold text-[#00C851]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00C851]" />{actives} {t('chip_active')}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-[#FF8800]/20 bg-[#FF8800]/8 px-3 py-1 text-[11px] font-bold text-[#FF8800]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF8800]" />{suspended} {t('chip_suspended')}
            </span>
          </div>
        </div>

        {/* Tabs + search */}
        <div className="mt-5 flex items-end justify-between gap-4">
          <div className="flex">
            {tabs.map(({ id, count }) => (
              <button key={id} type="button" onClick={() => { setTab(id); setQuery(''); }}
                className={[
                  'relative flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-colors duration-150',
                  tab === id ? 'text-[#1A1A0A] dark:text-[#F0EDD4]' : 'text-[#999] hover:text-[#555] dark:text-[#5A5A4A] dark:hover:text-[#9A9A8A]',
                ].join(' ')}>
                {t(`tab_${id}`)}
                <span className={['min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-black',
                  tab === id ? 'bg-[#C49A1E] text-[#0C1209]' : 'bg-[#E0DCD0] text-[#999] dark:bg-[#1E2E18] dark:text-[#5A5A4A]',
                ].join(' ')}>{count}</span>
                {tab === id && <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t-full bg-[#C49A1E]" />}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-2.5">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#BBBBAA]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search_placeholder')}
              className="w-[220px] rounded-[8px] border border-[#D8D4C8] bg-white py-1.5 pl-8 pr-3 text-[12px] text-[#1A1A0A] outline-none transition-all focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] focus:ring-0 dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#F5F5EE] p-6 dark:bg-[#0C1209]">
        {tab === 'stations'
          ? <AdminStationsManagement stations={stations} loading={loading} error={fetchError} query={query} onAction={handleStationAction} />
          : <AdminClientsList query={query} onAction={handleClientAction} />
        }
      </div>
    </div>
  );
}

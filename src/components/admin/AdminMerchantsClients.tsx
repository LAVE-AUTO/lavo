'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, updateWithApi, postWithApi } from '@/services';
import { useToast } from '@/context/toast-context';

import { AdminStationsManagement } from './AdminStationsManagement';
import { AdminClientsList } from './AdminClientsList';
import { AdminAddUserModal } from './users/AdminAddUserModal';
import { AdminAddStationModal } from './stations/AdminAddStationModal';

type Tab = 'stations' | 'clients';

export interface StationRow {
  id: string; name: string; city?: string | null;
  status: string; email?: string | null; created_at: string;
}

export function AdminMerchantsClients() {
  const t = useTranslations('admin_clients');
  const { success: toastSuccess, error: toastError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [tab, setTab]               = useState<Tab>('stations');
  const [stations, setStations]     = useState<StationRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [clientCount, setClientCount] = useState<number | string>('…');
  const [fetchError, setFetchError] = useState(false);
  const [query, setQuery]           = useState('');
  const [addUserOpen,    setAddUserOpen]    = useState(false);
  const [addStationOpen, setAddStationOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [stationsResult, dashboardResult] = await Promise.all([
          getFromApi('/admin/stations?status=all'),
          getFromApi('/admin/dashboard'),
        ]);

        if (!mountedRef.current) return;

        const [stationsOk, stationsData] = stationsResult;
        if (stationsOk) setStations(((stationsData as { data: StationRow[] }).data) ?? []);
        else setFetchError(true);

        const [dashboardOk, dashboardData] = dashboardResult;
        if (dashboardOk) {
          setClientCount(((dashboardData as { data?: { totals?: { total_clients?: number } } })?.data?.totals?.total_clients ?? 0));
        }
      } catch {
        if (mountedRef.current) setFetchError(true);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, []);

  async function handleStationAction(id: string, action: 'activate' | 'suspend') {
    try {
      const status = action === 'activate' ? 'active' : 'suspended';
      const [ok] = await updateWithApi(`/admin/stations/${id}`, { status });
      if (!mountedRef.current) return;
      if (ok) {
        setStations((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
        toastSuccess(t('action_success'));
      } else {
        toastError(t('action_error'));
      }
    } catch {
      if (mountedRef.current) toastError(t('action_error'));
    }
  }

  async function handleClientAction(id: string, action: 'activate' | 'suspend' | 'unblock') {
    try {
      if (action === 'unblock') {
        const [ok] = await postWithApi(`/admin/users/${id}/unblock`, {});
        if (!mountedRef.current) return;
        if (!ok) { toastError(t('action_error')); return; }
        toastSuccess(t('action_success'));
      } else {
        const status = action === 'activate' ? 'active' : 'suspended';
        const [ok] = await updateWithApi(`/admin/users/${id}`, { status });
        if (!mountedRef.current) return;
        if (!ok) { toastError(t('action_error')); return; }
        toastSuccess(t('action_success'));
      }
    } catch {
      if (mountedRef.current) toastError(t('action_error'));
    }
  }

  const managed   = stations.filter((s) => s.status === 'active' || s.status === 'suspended');
  const actives   = managed.filter((s) => s.status === 'active').length;
  const suspended = managed.filter((s) => s.status === 'suspended').length;

  const tabs = [
    { id: 'stations' as Tab, count: loading ? '…' : managed.length },
    { id: 'clients'  as Tab, count: clientCount },
  ];

  return (
    <div className="flex min-h-full flex-col">

      {/* Header */}
      <div className="shrink-0 border-b border-[#E0DCD0] bg-[#F5F5EE] px-6 pb-0 pt-6 dark:border-[#1A2A14] dark:bg-[#0C1209]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{t('page_title')}</h1>
            <p className="mt-1 text-[13px] text-[#888] dark:text-[#9A9A8A]">{t('page_subtitle')}</p>
          </div>
          {/* Live status chips + add button */}
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <span className="flex items-center gap-1.5 rounded-full border border-[#00C851]/20 bg-[#00C851]/8 px-3 py-1 text-[12px] font-bold text-[#00C851]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00C851]" />{actives} {t('chip_active')}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-[#FF8800]/20 bg-[#FF8800]/8 px-3 py-1 text-[12px] font-bold text-[#FF8800]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF8800]" />{suspended} {t('chip_suspended')}
            </span>
            <div className="mx-1 h-4 w-px bg-[#E0DCD0] dark:bg-[#1A2A14]" />
            <button type="button"
              onClick={() => tab === 'stations' ? setAddStationOpen(true) : setAddUserOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#C49A1E] px-3 py-1.5 text-[12px] font-bold text-[#0C1209] transition-colors hover:bg-[#B08A14]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              {t('btn_add_user')}
            </button>
          </div>
        </div>

        {/* Tabs + search */}
        <div className="mt-5 flex items-end justify-between gap-4">
          <div className="flex">
            {tabs.map(({ id, count }) => (
              <button key={id} type="button" onClick={() => { setTab(id); setQuery(''); }}
                className={[
                  'relative flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-colors duration-150',
                  tab === id ? 'text-[#1A1A0A] dark:text-[#F0EDD4]' : 'text-[#999] hover:text-[#555] dark:text-[#A0A090] dark:hover:text-[#9A9A8A]',
                ].join(' ')}>
                {t(`tab_${id}`)}
                <span className={['min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-black',
                  tab === id ? 'bg-[#C49A1E] text-[#0C1209]' : 'bg-[#E0DCD0] text-[#999] dark:bg-[#1E2E18] dark:text-[#A0A090]',
                ].join(' ')}>{count}</span>
                {tab === id && <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t-full bg-[#C49A1E]" />}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-2.5">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#BBBBAA]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search_placeholder')}
              className="w-[220px] rounded-[8px] border border-[#D8D4C8] bg-white py-1.5 pl-8 pr-3 text-[13px] text-[#1A1A0A] outline-none transition-all focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] focus:ring-0 dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]" />
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

      <AdminAddUserModal    open={addUserOpen}    onClose={() => setAddUserOpen(false)} />
      <AdminAddStationModal open={addStationOpen} onClose={() => setAddStationOpen(false)} />
    </div>
  );
}

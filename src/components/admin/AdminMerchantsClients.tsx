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

  const metrics = [
    { label: t('tab_stations'), value: loading ? '…' : String(managed.length), note: `${actives} ${t('chip_active')}` },
    { label: t('tab_clients'), value: String(clientCount), note: t('page_subtitle') },
    { label: t('chip_active'), value: String(actives), note: t('btn_activate') },
    { label: t('chip_suspended'), value: String(suspended), note: t('btn_suspend') },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_36%),linear-gradient(180deg,#faf8f2_0%,#f2efe7_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(196,154,30,0.12),_transparent_32%),linear-gradient(180deg,#0C1209_0%,#091009_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.08)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#C49A1E]/18 bg-[#C49A1E]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#9A7A13] dark:border-[#C49A1E]/25 dark:bg-[#C49A1E]/12 dark:text-[#F0D98C]">
                Gestion
              </span>
              <h1 className="mt-4 text-[clamp(28px,3vw,42px)] font-black leading-[1.04] text-[#1A1A0A] dark:text-[#F0EDD4]">
                {t('page_title')}
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#6F6B5F] dark:text-[#A6A091]">
                {t('page_subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[560px]">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-[22px] border border-[#E9E4D8] bg-[#FBFAF7] px-4 py-3 shadow-[0_10px_30px_rgba(26,26,10,0.05)] dark:border-[#1E2E18] dark:bg-[#0C150B]">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]">{metric.label}</div>
                  <div className="mt-2 text-[26px] font-black leading-none text-[#1A1A0A] dark:text-[#F0EDD4]">{metric.value}</div>
                  <div className="mt-2 text-[12px] font-semibold text-[#B29A52] dark:text-[#D0BF7E]">{metric.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-[#E7E1D5] bg-[#F8F6F1]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur dark:border-[#1E2E18] dark:bg-[#0C150B]/85">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="inline-flex flex-wrap gap-2 rounded-[18px] bg-white/65 p-1.5 dark:bg-[#111A0E]/80">
                {tabs.map(({ id, count }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setTab(id); setQuery(''); }}
                    className={[
                      'relative flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-[13px] font-bold transition-colors duration-150',
                      tab === id ? 'bg-[#1A1A0A] text-[#F0EDD4] shadow-[0_10px_20px_rgba(26,26,10,0.18)] dark:bg-[#F0EDD4] dark:text-[#1A1A0A]' : 'text-[#847E70] hover:bg-[#EFE8D7] hover:text-[#1A1A0A] dark:text-[#A0A090] dark:hover:bg-[#182214] dark:hover:text-[#F0EDD4]',
                    ].join(' ')}
                  >
                    {t(`tab_${id}`)}
                    <span className={[
                      'min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-black',
                      tab === id ? 'bg-[#C49A1E] text-[#0C1209]' : 'bg-[#E1DBCF] text-[#7E796B] dark:bg-[#1E2E18] dark:text-[#9A9A8A]',
                    ].join(' ')}>{count}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:min-w-[420px] xl:justify-end">
                <label className="relative min-w-[220px] flex-1 xl:max-w-[280px]">
                  <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#BBB6A7]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('search_placeholder')}
                    className="w-full rounded-[16px] border border-[#D8D4C8] bg-white/95 py-2.5 pl-9 pr-4 text-[13px] font-medium text-[#1A1A0A] outline-none transition-all focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] focus:ring-0 dark:border-[#243020] dark:bg-[#0D170B] dark:text-[#F0EDD4] dark:focus:border-[#C49A1E]"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => tab === 'stations' ? setAddStationOpen(true) : setAddUserOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-[#C49A1E] px-4 py-2.5 text-[13px] font-black text-[#0C1209] transition-colors hover:bg-[#B08A14] focus:outline-none focus:ring-2 focus:ring-[#C49A1E]/40"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  {t('btn_add_user')}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="flex-1 min-h-0 rounded-[28px] border border-[#E1DBCF] bg-white/88 shadow-[0_24px_80px_rgba(26,26,10,0.07)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          {tab === 'stations'
            ? <AdminStationsManagement stations={stations} loading={loading} error={fetchError} query={query} onAction={handleStationAction} />
            : <AdminClientsList query={query} onAction={handleClientAction} />
          }
        </section>
      </div>

      <AdminAddUserModal    open={addUserOpen}    onClose={() => setAddUserOpen(false)} />
      <AdminAddStationModal open={addStationOpen} onClose={() => setAddStationOpen(false)} />
    </div>
  );
}

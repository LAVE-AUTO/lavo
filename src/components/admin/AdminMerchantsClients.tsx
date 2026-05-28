'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi, updateWithApi, postWithApi } from '@/services';
import { useToast } from '@/context/toast-context';

import { AdminStationsManagement } from './AdminStationsManagement';
import { AdminClientsList } from './AdminClientsList';
import { AdminAddUserModal } from './users/AdminAddUserModal';
import { AdminEditUserModal } from './users/AdminEditUserModal';
import { AdminDeleteUserModal } from './users/AdminDeleteUserModal';
import { AdminAddStationModal } from './stations/AdminAddStationModal';
import { AdminEditStationModal } from './stations/AdminEditStationModal';
import { AdminDeleteStationModal } from './stations/AdminDeleteStationModal';
import { AdminPagination } from './ui/AdminPagination';

type Tab = 'stations' | 'clients';

interface ClientRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
}

interface EditableUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string;
}

interface EditableStation {
  id: string;
  name: string;
  legal_name?: string | null;
  address: string;
  city: string;
  service_scope?: string | null;
  description?: string | null;
  status: string;
  is_open: boolean;
}

export interface StationRow {
  id: string; name: string; city?: string | null;
  status: string; email?: string | null; created_at: string;
  address?: string; legal_name?: string | null; service_scope?: string | null;
  description?: string | null; is_open?: boolean;
}

interface StationMeta {
  total: number; page: number; per_page: number; total_pages: number;
  total_active: number; total_suspended: number;
}

const STATIONS_PER_PAGE = 50;

export function AdminMerchantsClients() {
  const t = useTranslations('admin_clients');
  const { success: toastSuccess, error: toastError } = useToast();
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const [tab, setTab]                 = useState<Tab>('stations');
  const [stations, setStations]       = useState<StationRow[]>([]);
  const [stationMeta, setStationMeta] = useState<StationMeta | null>(null);
  const [stationPage, setStationPage] = useState(1);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState(false);
  const [query, setQuery]             = useState('');
  const [clientCount, setClientCount] = useState<number | '…'>('…');
  const [addUserOpen,       setAddUserOpen]       = useState(false);
  const [addStationOpen,    setAddStationOpen]    = useState(false);
  const [editStation,       setEditStation]       = useState<StationRow | null>(null);
  const [deleteStation,     setDeleteStation]     = useState<StationRow | null>(null);
  const [editUser,          setEditUser]          = useState<ClientRow | null>(null);
  const [deleteUser,        setDeleteUser]        = useState<ClientRow | null>(null);
  const [clientsRefreshKey,  setClientsRefreshKey]  = useState(0);
  const [stationsRefreshKey, setStationsRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setFetchError(false);
    getFromApi(`/admin/stations?status=managed&page=${stationPage}&per_page=${STATIONS_PER_PAGE}`)
      .then(([ok, data]) => {
        if (!mountedRef.current) return;
        if (ok) {
          const payload = (data as { data: { stations: StationRow[]; meta: StationMeta } }).data;
          setStations(payload?.stations ?? []);
          setStationMeta(payload?.meta ?? null);
        } else {
          setFetchError(true);
        }
      })
      .catch(() => { if (mountedRef.current) setFetchError(true); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [stationPage, stationsRefreshKey]);

  function handleUserSaved(_updated: EditableUser) {
    setClientsRefreshKey((k) => k + 1);
    toastSuccess(t('action_success'));
  }

  function handleUserDeleted(_userId: string, _permanent: boolean) {
    setClientsRefreshKey((k) => k + 1);
    toastSuccess(t('action_success'));
  }

  function handleStationSaved(updated: EditableStation) {
    setStations((prev) => prev.map((s) => s.id === updated.id ? { ...s, ...updated } : s));
    toastSuccess(t('action_success'));
  }

  function handleStationDeleted(stationId: string, permanent: boolean) {
    if (permanent) {
      setStations((prev) => prev.filter((s) => s.id !== stationId));
    } else {
      setStations((prev) => prev.map((s) => s.id === stationId ? { ...s, status: 'disabled' } : s));
    }
    toastSuccess(t('action_success'));
  }

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

  const stationTotal = stationMeta?.total ?? 0;
  const actives     = stationMeta?.total_active    ?? 0;
  const suspended   = stationMeta?.total_suspended ?? 0;

  const tabs = [
    { id: 'stations' as Tab, count: loading ? '…' : stationTotal },
    { id: 'clients'  as Tab, count: clientCount },
  ];

  const metrics = [
    { label: t('tab_stations'),  value: loading ? '…' : String(stationTotal), hint: `${actives} ${t('chip_active')}`, accent: '#DDAF3B' },
    { label: t('tab_clients'),   value: String(clientCount),                  hint: t('chip_active'),                 accent: '#3B82F6' },
    { label: t('chip_active'),   value: String(actives),                      hint: t('btn_activate'),                accent: '#16A34A' },
    { label: t('chip_suspended'),value: String(suspended),                    hint: t('btn_suspend'),                 accent: '#EA580C' },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(221, 175, 59,0.12),_transparent_36%),linear-gradient(180deg,#faf8f2_0%,#f2efe7_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(221, 175, 59,0.12),_transparent_32%),linear-gradient(180deg,#0C1209_0%,#091009_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col gap-5 overflow-y-auto scrollbar-none px-3 py-4 sm:px-4 lg:px-6 lg:py-6">
        <section className="rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.08)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#DDAF3B]/18 bg-[#DDAF3B]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#9A7A13] dark:border-[#DDAF3B]/25 dark:bg-[#DDAF3B]/12 dark:text-[#F0D98C]">
                {t('badge_management')}
              </span>
              <h1 className="mt-4 text-[clamp(28px,3vw,42px)] font-black leading-[1.04] text-[#001201] dark:text-[#FFF9EC]">
                {t('page_title')}
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#6F6B5F] dark:text-[#A6A091]">
                {t('page_subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:w-[640px] 2xl:w-[720px]">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="group relative overflow-hidden rounded-[24px] border border-[#E9E4D8] bg-[#FBFAF7] px-5 py-4 shadow-[0_10px_30px_rgba(26,26,10,0.05)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-[#1E2E18] dark:bg-[#0C150B]"
                >
                  <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: metric.accent }} />
                  <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-3xl opacity-15 transition-opacity duration-200 group-hover:opacity-25" style={{ background: metric.accent }} />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#9B9588] dark:text-[#7E8A75]">{metric.label}</div>
                    <div className="mt-3 text-[30px] font-black leading-none text-[#001201] dark:text-[#FFF9EC]">{metric.value}</div>
                    <div className="mt-1 truncate text-[11px] font-semibold text-[#9B9588] dark:text-[#7E8A75]">{metric.hint}</div>
                  </div>
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
                      tab === id ? 'bg-[#001201] text-[#FFF9EC] shadow-[0_10px_20px_rgba(26,26,10,0.18)] dark:bg-[#FFF9EC] dark:text-[#001201]' : 'text-[#847E70] hover:bg-[#EFE8D7] hover:text-[#001201] dark:text-[#A0A090] dark:hover:bg-[#182214] dark:hover:text-[#FFF9EC]',
                    ].join(' ')}
                  >
                    {t(`tab_${id}`)}
                    <span className={[
                      'min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-black',
                      tab === id ? 'bg-[#DDAF3B] text-[#0C1209]' : 'bg-[#E1DBCF] text-[#7E796B] dark:bg-[#1E2E18] dark:text-[#9A9A8A]',
                    ].join(' ')}>{count}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:min-w-[420px] xl:justify-end">
                <label className="relative min-w-[220px] flex-1 xl:max-w-[280px]">
                  <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#BBB6A7]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('search_placeholder')}
                    className="w-full rounded-[16px] border border-[#D8D4C8] bg-white/95 py-2.5 pl-9 pr-4 text-[13px] font-medium text-[#001201] outline-none transition-all focus:border-[#DDAF3B] focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.12)] focus:ring-0 dark:border-[#001A05] dark:bg-[#0D170B] dark:text-[#FFF9EC] dark:focus:border-[#DDAF3B]"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => tab === 'stations' ? setAddStationOpen(true) : setAddUserOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-[#DDAF3B] px-4 py-2.5 text-[13px] font-black text-[#0C1209] transition-colors hover:bg-[#B08A14] focus:outline-none focus:ring-2 focus:ring-[#DDAF3B]/40"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  {t('btn_add_user')}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-[28px] border border-[#E1DBCF] bg-white/88 p-5 shadow-[0_24px_80px_rgba(26,26,10,0.07)] backdrop-blur-xl dark:border-[#1E2E18] dark:bg-[#101A0D]/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          {tab === 'stations' ? (
            <>
              <AdminStationsManagement stations={stations} loading={loading} error={fetchError} query={query} onAction={handleStationAction} onEdit={setEditStation} onDelete={setDeleteStation} />
              {stationMeta && (
                <AdminPagination
                  page={stationPage}
                  totalPages={stationMeta.total_pages}
                  total={stationMeta.total}
                  perPage={STATIONS_PER_PAGE}
                  onPageChange={setStationPage}
                  loading={loading}
                />
              )}
            </>
          ) : (
            <AdminClientsList
              query={query}
              onAction={handleClientAction}
              onCountChange={setClientCount}
              onEditUser={setEditUser}
              onDeleteUser={setDeleteUser}
              refreshKey={clientsRefreshKey}
            />
          )}
        </section>
      </div>

      <AdminAddUserModal    open={addUserOpen}    onClose={() => setAddUserOpen(false)} />
      <AdminEditUserModal
        open={!!editUser}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={handleUserSaved}
      />
      <AdminDeleteUserModal
        open={!!deleteUser}
        user={deleteUser}
        onClose={() => setDeleteUser(null)}
        onDeleted={handleUserDeleted}
      />
      <AdminAddStationModal
        open={addStationOpen}
        onClose={() => setAddStationOpen(false)}
        onCreated={() => { setStationsRefreshKey((k) => k + 1); toastSuccess(t('action_success')); }}
      />
      <AdminEditStationModal
        open={!!editStation}
        station={
          editStation
            ? {
                id: editStation.id,
                name: editStation.name,
                legal_name: editStation.legal_name ?? null,
                address: editStation.address ?? '',
                city: editStation.city ?? '',
                service_scope: editStation.service_scope ?? null,
                description: editStation.description ?? null,
                status: editStation.status,
                is_open: editStation.is_open ?? false,
              }
            : null
        }
        onClose={() => setEditStation(null)}
        onSaved={handleStationSaved}
      />
      <AdminDeleteStationModal
        open={!!deleteStation}
        station={deleteStation}
        onClose={() => setDeleteStation(null)}
        onDeleted={handleStationDeleted}
      />
    </div>
  );
}

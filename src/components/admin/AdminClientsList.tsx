'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getFromApi } from '@/services';
import { AdminPagination } from './ui/AdminPagination';

const STATUS: Record<string, { dot: string; text: string; label: string }> = {
  active:               { dot: 'bg-[#22C55E]', text: 'text-[#166534] dark:text-[#86EFAC]', label: 'status_active' },
  suspended:            { dot: 'bg-[#F97316]', text: 'text-[#9A3412] dark:text-[#FDBA74]', label: 'status_suspended' },
  blocked:              { dot: 'bg-[#F43F5E]', text: 'text-[#9F1239] dark:text-[#FDA4AF]', label: 'status_blocked' },
  pending_verification: { dot: 'bg-[#C49A1E]', text: 'text-[#7A5E0A] dark:text-[#F0D98C]', label: 'status_pending' },
};

interface ClientRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
}

interface PaginationMeta { total: number; page: number; per_page: number; total_pages: number; }

function initials(first: string | null, last: string | null) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}
function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const PER_PAGE = 20;

interface Props {
  query: string;
  onAction: (id: string, action: 'activate' | 'suspend' | 'unblock') => Promise<void>;
  onCountChange?: (count: number) => void;
  onEditUser?:    (user: ClientRow) => void;
  onDeleteUser?:  (user: ClientRow) => void;
  refreshKey?:    number;
}

export function AdminClientsList({ query, onAction, onCountChange, onEditUser, onDeleteUser, refreshKey }: Props) {
  const t = useTranslations('admin_clients');
  const [clients, setClients]       = useState<ClientRow[]>([]);
  const [meta, setMeta]             = useState<PaginationMeta | null>(null);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [confirmId, setConfirmId]   = useState<string | null>(null);
  const [busy, setBusy]             = useState<string | null>(null);
  const mountedRef                  = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setLoading(true);
    setFetchError(false);

    const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
    if (query) params.set('search', query);

    getFromApi(`/admin/users?${params}`)
      .then(([ok, data]) => {
        if (!mountedRef.current) return;
        if (ok) {
          const payload = (data as { data: { users: ClientRow[]; meta: PaginationMeta } }).data;
          setClients(payload?.users ?? []);
          setMeta(payload?.meta ?? null);
          onCountChange?.(payload?.meta?.total ?? 0);
        } else {
          setFetchError(true);
        }
      })
      .catch(() => { if (mountedRef.current) setFetchError(true); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [page, query, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Reset to page 1 when the search query changes — runs before the fetch effect */
  useEffect(() => { setPage(1); }, [query]);

  async function doAction(id: string, action: 'activate' | 'suspend' | 'unblock') {
    setBusy(id); setConfirmId(null);
    try {
      await onAction(id, action);
      if (action !== 'unblock') {
        setClients((prev) =>
          prev.map((c) => c.id === id ? { ...c, status: action === 'activate' ? 'active' : 'suspended' } : c)
        );
      }
    } finally { setBusy(null); }
  }

  const q        = query.toLowerCase();
  const filtered = q
    ? clients.filter((c) =>
        `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q)
      )
    : clients;

  if (loading) return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C49A1E] border-t-transparent" />
      <p className="text-[13px] text-[#999]">{t('loading')}</p>
    </div>
  );

  if (fetchError) return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <p className="text-[13px] font-semibold text-red-500">{t('error_load')}</p>
    </div>
  );

  if (!filtered.length) return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F3EE] dark:bg-[#131E10]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
      </div>
      <p className="text-[13px] font-semibold text-[#999]">{q ? t('empty_search') : t('empty_data')}</p>
    </div>
  );

  function renderStatus(client: (typeof clients)[number]) {
    const s = STATUS[client.status];
    if (!s) return null;
    return (
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-[#F4F1E8] px-2.5 py-1 text-[11.5px] font-bold dark:bg-[#171F12] ${s.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
      </span>
    );
  }

  const actionPrimary   = 'inline-flex items-center gap-1 rounded-[12px] bg-[#1A1A0A] px-3 py-1.5 text-[12px] font-bold text-[#F0EDD4] transition-all hover:bg-[#33321E] disabled:opacity-50 dark:bg-[#F0EDD4] dark:text-[#1A1A0A] dark:hover:bg-[#E1DBC8]';
  const actionSecondary = 'inline-flex items-center gap-1 rounded-[12px] border border-[#E1DBCF] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#5A554B] transition-all hover:border-[#C49A1E]/40 hover:bg-[#FCF6E5] hover:text-[#9A7A13] disabled:opacity-50 dark:border-[#1E2E18] dark:bg-[#0E170C] dark:text-[#A6A091] dark:hover:bg-[#1A2410] dark:hover:text-[#F0D98C]';
  const actionDanger    = 'inline-flex items-center gap-1 rounded-[12px] border border-[#F43F5E]/30 bg-[#FFF1F2] px-3 py-1.5 text-[12px] font-bold text-[#9F1239] transition-all hover:bg-[#FCE7EB] disabled:opacity-50 dark:border-[#F43F5E]/20 dark:bg-[#2A0A12] dark:text-[#FDA4AF]';

  function renderActions(client: (typeof clients)[number], compact = false) {
    const isConfirming = confirmId === client.id;
    const isBusy = busy === client.id;

    if (isConfirming) {
      return (
        <div className={compact ? 'flex flex-col gap-2' : 'flex flex-wrap justify-end gap-1.5'}>
          <button type="button" disabled={isBusy} onClick={() => doAction(client.id, 'suspend')} className={actionDanger}>
            {isBusy ? '…' : t('btn_confirm')}
          </button>
          <button type="button" onClick={() => setConfirmId(null)} className={actionSecondary}>
            {t('btn_cancel')}
          </button>
        </div>
      );
    }

    if (client.status === 'active') {
      return (
        <button type="button" disabled={isBusy} onClick={() => setConfirmId(client.id)} className={actionSecondary}>
          {t('btn_suspend')}
        </button>
      );
    }

    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        <button type="button" disabled={isBusy} onClick={() => doAction(client.id, 'activate')} className={actionPrimary}>
          {isBusy ? '…' : t('btn_activate')}
        </button>
        <button type="button" disabled={isBusy} onClick={() => doAction(client.id, 'unblock')} className={actionSecondary}>
          {isBusy ? '…' : t('btn_unblock')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-[28px] border border-[#E6DFD1] bg-white/90 shadow-[0_18px_60px_rgba(26,26,10,0.06)] dark:border-[#1E2E18] dark:bg-[#0E170C]/95">
        <div className="border-b border-[#E9E4D8] bg-[#FCFBF8] px-5 py-4 text-[11px] font-black uppercase tracking-[0.22em] text-[#A7A091] dark:border-[#1E2E18] dark:bg-[#0D150B] dark:text-[#8E9988]">
          {q ? t('empty_search') : t('tab_clients')}
        </div>

        {/* Mobile card layout */}
        <div className="space-y-3 p-4 md:hidden">
          {filtered.map((client) => (
            <article key={client.id} className="rounded-[24px] border border-[#E8E3D7] bg-[#FBFAF7] p-4 shadow-[0_12px_30px_rgba(26,26,10,0.05)] dark:border-[#1E2E18] dark:bg-[#111A0D]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#1A1A0A]/5 text-[12px] font-black text-[#1A1A0A] ring-1 ring-inset ring-[#1A1A0A]/8 dark:bg-[#F0EDD4]/8 dark:text-[#F0EDD4] dark:ring-[#F0EDD4]/10">
                    {initials(client.first_name, client.last_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-black text-[#1A1A0A] dark:text-[#F0EDD4]">{client.first_name ?? ''} {client.last_name ?? ''}</p>
                    <p className="mt-0.5 text-[12px] text-[#979083] dark:text-[#A0A090]">{formatDate(client.created_at)}</p>
                  </div>
                </div>
                {renderStatus(client)}
              </div>

              <div className="mt-4 grid gap-2">
                <div className="rounded-[16px] bg-white px-3 py-2.5 text-[13px] text-[#555] shadow-[0_1px_0_rgba(26,26,10,0.04)] dark:bg-[#0C150B] dark:text-[#C8C2B3]">{client.email}</div>
                <div className="rounded-[16px] bg-white px-3 py-2.5 text-[13px] text-[#555] shadow-[0_1px_0_rgba(26,26,10,0.04)] dark:bg-[#0C150B] dark:text-[#C8C2B3]">{client.phone ?? '—'}</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {renderActions(client, true)}
                {onEditUser && (
                  <button type="button" onClick={() => onEditUser(client)} title={t('btn_edit')}
                    className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-[#E1DBCF] bg-white text-[#888] transition-colors hover:border-[#C49A1E]/40 hover:bg-[#FCF6E5] hover:text-[#9A7A13] dark:border-[#1E2E18] dark:bg-[#0E170C] dark:text-[#A0A090]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                )}
                {onDeleteUser && (
                  <button type="button" onClick={() => onDeleteUser(client)} title={t('btn_delete')}
                    className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-red-200/60 bg-white text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:bg-[#0E170C] dark:text-red-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Desktop table layout */}
        <div className="hidden md:block">
          <div className="grid grid-cols-[40px_1fr_1fr_120px_200px] items-center gap-4 border-b border-[#E9E4D8] bg-[#FCFBF8] px-5 py-3 dark:border-[#1E2E18] dark:bg-[#0D150B]">
            {['', t('col_account'), t('col_contact'), t('col_status'), t('col_actions')].map((h, i) => (
              <span key={i} className={`text-[11px] font-black uppercase tracking-[0.22em] text-[#AAA395] dark:text-[#8F998A] ${i === 4 ? 'text-right' : ''}`}>{h}</span>
            ))}
          </div>

          <div>
            {filtered.map((client) => {
              const isConfirming = confirmId === client.id;

              return (
                <div key={client.id}
                  className={[
                    'grid grid-cols-[40px_1fr_1fr_120px_200px] items-center gap-4 border-b border-[#F2EFE8] px-5 py-4 transition-colors duration-150 last:border-0',
                    isConfirming
                      ? 'bg-[#FFF7F8] dark:bg-[#1A0808]'
                      : 'bg-white hover:bg-[#FCFBF6] dark:border-[#1A2A14] dark:bg-[#111A0D] dark:hover:bg-[#161F12]',
                  ].join(' ')}>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#1A1A0A]/5 text-[12px] font-black text-[#1A1A0A] ring-1 ring-inset ring-[#1A1A0A]/8 dark:bg-[#F0EDD4]/8 dark:text-[#F0EDD4] dark:ring-[#F0EDD4]/10">
                    {initials(client.first_name, client.last_name)}
                  </div>

                  <div className="min-w-0">
                    <p className="block truncate text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
                      {client.first_name ?? ''} {client.last_name ?? ''}
                    </p>
                    <p className="truncate text-[12px] text-[#979083] dark:text-[#A0A090]">{formatDate(client.created_at)}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-[#5A554B] dark:text-[#C8C2B3]">{client.email}</p>
                    <p className="truncate text-[12px] text-[#A8A293] dark:text-[#A0A090]">{client.phone ?? '—'}</p>
                  </div>

                  <div>{renderStatus(client)}</div>

                  <div className="flex items-center justify-end gap-1.5">
                    {renderActions(client)}
                    {onEditUser && (
                      <button type="button" onClick={() => onEditUser(client)} title={t('btn_edit')}
                        className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-[#E1DBCF] bg-white text-[#888] transition-colors hover:border-[#C49A1E]/40 hover:bg-[#FCF6E5] hover:text-[#9A7A13] dark:border-[#1E2E18] dark:bg-[#0E170C] dark:text-[#A0A090] dark:hover:bg-[#1A2410] dark:hover:text-[#F0D98C]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                    )}
                    {onDeleteUser && (
                      <button type="button" onClick={() => onDeleteUser(client)} title={t('btn_delete')}
                        className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-red-200/60 bg-white text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:bg-[#0E170C] dark:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {meta && (
        <AdminPagination
          page={page}
          totalPages={meta.total_pages}
          total={meta.total}
          perPage={PER_PAGE}
          onPageChange={setPage}
          loading={loading}
        />
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

// MOCK DATA — replace with API call before shipping (GET /admin/clients)
const MOCK_CLIENTS = process.env.NODE_ENV === 'development' ? [
  { id: 'c1', first_name: 'Client',  last_name: 'A', email: 'client.a@example.com', phone: '+1 555 000 0001', status: 'active',    created_at: '2025-11-15T10:00:00Z' },
  { id: 'c2', first_name: 'Client',  last_name: 'B', email: 'client.b@example.com', phone: '+1 555 000 0002', status: 'suspended', created_at: '2025-12-03T14:30:00Z' },
  { id: 'c3', first_name: 'Client',  last_name: 'C', email: 'client.c@example.com', phone: '+1 555 000 0003', status: 'active',    created_at: '2026-01-20T09:15:00Z' },
  { id: 'c4', first_name: 'Client',  last_name: 'D', email: 'client.d@example.com', phone: '+1 555 000 0004', status: 'active',    created_at: '2026-02-05T16:00:00Z' },
  { id: 'c5', first_name: 'Client',  last_name: 'E', email: 'client.e@example.com', phone: '+1 555 000 0005', status: 'suspended', created_at: '2026-02-28T11:45:00Z' },
  { id: 'c6', first_name: 'Client',  last_name: 'F', email: 'client.f@example.com', phone: '+1 555 000 0006', status: 'active',    created_at: '2026-03-10T08:00:00Z' },
] : [];

const AVATAR_COLORS = ['#C49A1E', '#5A8A50', '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4'];

const STATUS: Record<string, { badge: string; dot: string; label: string }> = {
  active:    { badge: 'bg-[#F0FDF4] text-[#166534] ring-1 ring-[#86EFAC]/40', dot: 'bg-[#22C55E]', label: 'status_active' },
  suspended: { badge: 'bg-[#FFF7ED] text-[#9A3412] ring-1 ring-[#FDBA74]/40', dot: 'bg-[#F97316]', label: 'status_suspended' },
};

function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function initials(first: string, last: string) { return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase(); }
function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

interface Props {
  query: string;
  onAction: (id: string, action: 'activate' | 'suspend' | 'unblock') => Promise<void>;
}

export function AdminClientsList({ query, onAction }: Props) {
  const t = useTranslations('admin_clients');
  const [clients, setClients]     = useState(MOCK_CLIENTS);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy]           = useState<string | null>(null);

  async function doAction(id: string, action: 'activate' | 'suspend' | 'unblock') {
    setBusy(id); setConfirmId(null);
    try {
      await onAction(id, action);
      if (action !== 'unblock') {
        setClients((prev) => prev.map((c) => c.id === id ? { ...c, status: action === 'activate' ? 'active' : 'suspended' } : c));
      }
    } finally { setBusy(null); }
  }

  const q        = query.toLowerCase();
  const filtered = q
    ? clients.filter((c) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q))
    : clients;

  if (!filtered.length) return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F3EE] dark:bg-[#131E10]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
      </div>
      <p className="text-[13px] font-semibold text-[#999]">{q ? t('empty_search') : t('empty_data')}</p>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#E8E4DC] shadow-sm dark:border-[#1E2E18]">
      {/* Table header */}
      <div className="grid grid-cols-[40px_1fr_1fr_120px_160px] items-center gap-4 border-b border-[#E8E4DC] bg-[#F9F8F5] px-5 py-3 dark:border-[#1E2E18] dark:bg-[#0E1A0C]">
        {['', t('col_account'), t('col_contact'), t('col_status'), t('col_actions')].map((h, i) => (
          <span key={i} className={`text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#4A4A3A] ${i === 4 ? 'text-right' : ''}`}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      {filtered.map((client, idx) => {
        const s            = STATUS[client.status];
        const isConfirming = confirmId === client.id;
        const isBusy       = busy === client.id;
        const color        = avatarColor(client.first_name);

        return (
          <div key={client.id}
            className={[
              'grid grid-cols-[40px_1fr_1fr_120px_160px] items-center gap-4 border-b px-5 py-3.5 transition-colors duration-150 last:border-0',
              isConfirming
                ? 'border-red-100 bg-red-50 dark:border-[#2A1010] dark:bg-[#1A0808]'
                : idx % 2 === 0
                  ? 'border-[#F2EFE8] bg-white hover:bg-[#FEFCF5] dark:border-[#1A2A14] dark:bg-[#131E10] dark:hover:bg-[#182416]'
                  : 'border-[#F2EFE8] bg-[#FAFAF7] hover:bg-[#FEFCF5] dark:border-[#1A2A14] dark:bg-[#111C0E] dark:hover:bg-[#182416]',
            ].join(' ')}>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-black text-white"
              style={{ background: color }}>
              {initials(client.first_name, client.last_name)}
            </div>

            <div className="min-w-0">
              {/* TODO: link to /admin/clients/:id once the detail page is built */}
              <p className="block truncate text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
                {client.first_name} {client.last_name}
              </p>
              <p className="truncate text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{formatDate(client.created_at)}</p>
            </div>

            <div className="min-w-0">
              <p className="truncate text-[12px] text-[#555] dark:text-[#9A9A8A]">{client.email}</p>
              <p className="truncate text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">{client.phone}</p>
            </div>

            {s ? (
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
              </span>
            ) : <span />}

            <div className="flex justify-end gap-1.5">
              {isConfirming ? (
                <>
                  <button type="button" disabled={isBusy} onClick={() => doAction(client.id, 'suspend')}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-600 disabled:opacity-50">
                    {isBusy ? '…' : t('btn_confirm')}
                  </button>
                  <button type="button" onClick={() => setConfirmId(null)}
                    className="rounded-lg border border-[#D8D4C8] px-3 py-1.5 text-[11px] font-semibold text-[#666] hover:bg-[#F5F3EE] dark:border-[#243020] dark:text-[#9A9A8A]">
                    {t('btn_cancel')}
                  </button>
                </>
              ) : client.status === 'active' ? (
                <button type="button" disabled={isBusy} onClick={() => setConfirmId(client.id)}
                  className="rounded-lg border border-orange-200 px-3 py-1.5 text-[11px] font-bold text-orange-600 hover:bg-orange-50 disabled:opacity-50 dark:border-orange-900/40 dark:text-orange-400 dark:hover:bg-orange-950/30">
                  {t('btn_suspend')}
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button type="button" disabled={isBusy} onClick={() => doAction(client.id, 'activate')}
                    className="rounded-lg border border-green-200 px-3 py-1.5 text-[11px] font-bold text-green-700 hover:bg-green-50 disabled:opacity-50 dark:border-green-900/40 dark:text-green-400 dark:hover:bg-green-950/30">
                    {isBusy ? '…' : t('btn_activate')}
                  </button>
                  <button type="button" disabled={isBusy} onClick={() => doAction(client.id, 'unblock')}
                    className="rounded-lg border border-blue-200 px-3 py-1.5 text-[11px] font-bold text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-950/30">
                    {isBusy ? '…' : t('btn_unblock')}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

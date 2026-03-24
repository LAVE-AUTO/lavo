'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

// TODO: connect to API once endpoint is available (GET /admin/clients)
const MOCK_CLIENTS = [
  { id: 'c1', first_name: 'Sophie',   last_name: 'Martin',   email: 'sophie.martin@gmail.com',   phone: '+1 514 555 0101', status: 'active',    created_at: '2025-11-15T10:00:00Z' },
  { id: 'c2', first_name: 'Jean',     last_name: 'Tremblay', email: 'jean.tremblay@outlook.com', phone: '+1 514 555 0202', status: 'suspended', created_at: '2025-12-03T14:30:00Z' },
  { id: 'c3', first_name: 'Marie',    last_name: 'Côté',     email: 'marie.cote@gmail.com',      phone: '+1 438 555 0303', status: 'active',    created_at: '2026-01-20T09:15:00Z' },
  { id: 'c4', first_name: 'Luc',      last_name: 'Gagnon',   email: 'luc.gagnon@hotmail.com',    phone: '+1 450 555 0404', status: 'active',    created_at: '2026-02-05T16:00:00Z' },
  { id: 'c5', first_name: 'Isabelle', last_name: 'Roy',      email: 'i.roy@email.ca',            phone: '+1 514 555 0505', status: 'suspended', created_at: '2026-02-28T11:45:00Z' },
  { id: 'c6', first_name: 'Marc',     last_name: 'Lavoie',   email: 'marc.lavoie@videotron.ca',  phone: '+1 438 555 0606', status: 'active',    created_at: '2026-03-10T08:00:00Z' },
];

const AVATAR_COLORS = ['#C49A1E', '#5A8A50', '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4'];
const LEFT_BAR: Record<string, string>  = { active: 'bg-[#00C851]', suspended: 'bg-[#FF8800]' };
const STATUS_BADGE: Record<string, string> = { active: 'bg-[#00C851]/10 text-[#00C851]', suspended: 'bg-[#FF8800]/10 text-[#FF8800]' };

function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
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
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-[#131E10]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
      </div>
      <p className="text-[13px] font-semibold text-[#999] dark:text-[#5A5A4A]">{t('empty_search')}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {filtered.map((client) => {
        const fullName     = `${client.first_name} ${client.last_name}`;
        const initials     = `${client.first_name[0]}${client.last_name[0]}`.toUpperCase();
        const color        = avatarColor(client.first_name);
        const isConfirming = confirmId === client.id;
        const isBusy       = busy === client.id;

        return (
          <div key={client.id} className={[
            'flex overflow-hidden rounded-xl border transition-all duration-200',
            isConfirming
              ? 'border-[#EF4444]/25 bg-[#FEF2F2] shadow-sm dark:border-[#3A1A1A] dark:bg-[#1C0A0A]'
              : 'border-[#ECEAE0] bg-white hover:border-[#D4C080]/50 hover:shadow-sm dark:border-[#1A2A14] dark:bg-[#131E10] dark:hover:border-[#2A3A20]',
          ].join(' ')}>

            <div className={`w-[3px] shrink-0 ${LEFT_BAR[client.status] ?? 'bg-[#E0DCD0]'}`} />

            <div className="flex flex-1 items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-black text-white"
                style={{ background: color }}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/clients/${client.id}` as Parameters<typeof Link>[0]['href']}
                    className="truncate text-[14px] font-bold text-[#1A1A0A] underline-offset-2 hover:text-[#C49A1E] hover:underline dark:text-[#F0EDD4]">
                    {fullName}
                  </Link>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${STATUS_BADGE[client.status] ?? 'bg-[#E0DCD0] text-[#888]'}`}>
                    {t(`status_${client.status}`)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">
                  {client.email} · {formatDate(client.created_at)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                {isConfirming ? (
                  <>
                    <span className="hidden text-[11px] font-semibold text-[#EF4444] sm:block">{t('confirm_suspend_hint')}</span>
                    <button type="button" disabled={isBusy} onClick={() => doAction(client.id, 'suspend')}
                      className="rounded-lg bg-[#EF4444] px-3.5 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-50">
                      {isBusy ? '…' : t('btn_confirm')}
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)}
                      className="rounded-lg border border-[#D8D4C8] px-3.5 py-1.5 text-[11px] font-semibold text-[#666] hover:bg-[#F0EDE0] dark:border-[#243020] dark:text-[#9A9A8A] dark:hover:bg-[#1A2A14]">
                      {t('btn_cancel')}
                    </button>
                  </>
                ) : client.status === 'active' ? (
                  <button type="button" disabled={isBusy} onClick={() => setConfirmId(client.id)}
                    className="rounded-lg border border-[#FF8800]/30 px-3.5 py-1.5 text-[11px] font-bold text-[#FF8800] transition-colors hover:bg-[#FF8800]/8 disabled:opacity-50">
                    {t('btn_suspend')}
                  </button>
                ) : (
                  <div className="flex gap-1.5">
                    <button type="button" disabled={isBusy} onClick={() => doAction(client.id, 'activate')}
                      className="rounded-lg border border-[#00C851]/30 px-3.5 py-1.5 text-[11px] font-bold text-[#00C851] transition-colors hover:bg-[#00C851]/8 disabled:opacity-50">
                      {isBusy ? '…' : t('btn_activate')}
                    </button>
                    <button type="button" disabled={isBusy} onClick={() => doAction(client.id, 'unblock')}
                      className="rounded-lg border border-[#3B82F6]/30 px-3.5 py-1.5 text-[11px] font-bold text-[#3B82F6] transition-colors hover:bg-[#3B82F6]/8 disabled:opacity-50">
                      {t('btn_unblock')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

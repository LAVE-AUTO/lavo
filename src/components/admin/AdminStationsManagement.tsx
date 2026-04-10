'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { StationRow } from './AdminMerchantsClients';

const STATUS: Record<string, { badge: string; dot: string; label: string }> = {
  active:    { badge: 'bg-[#F0FDF4] text-[#166534] ring-1 ring-[#86EFAC]/40', dot: 'bg-[#22C55E]', label: 'status_active' },
  suspended: { badge: 'bg-[#FFF7ED] text-[#9A3412] ring-1 ring-[#FDBA74]/40', dot: 'bg-[#F97316]', label: 'status_suspended' },
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}
function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

interface Props {
  stations: StationRow[]; loading: boolean; error: boolean; query: string;
  onAction: (id: string, action: 'activate' | 'suspend') => Promise<void>;
}

export function AdminStationsManagement({ stations, loading, error, query, onAction }: Props) {
  const t = useTranslations('admin_clients');
  const [confirmId, setConfirmId]         = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'suspend' | null>(null);
  const [busy, setBusy]                   = useState<string | null>(null);

  function requestConfirm(id: string, action: 'activate' | 'suspend') {
    setConfirmId(id);
    setConfirmAction(action);
  }

  async function doAction(id: string, action: 'activate' | 'suspend') {
    setBusy(id); setConfirmId(null); setConfirmAction(null);
    try { await onAction(id, action); } finally { setBusy(null); }
  }

  if (loading) return (
    <div className="overflow-hidden rounded-xl border border-[#E8E4DC] dark:border-[#1E2E18]">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`flex items-center gap-4 border-b border-[#F2EFE8] px-5 py-4 last:border-0 dark:border-[#1A2A14] ${i === 0 ? 'bg-[#F9F8F5] dark:bg-[#0E1A0C]' : 'bg-white dark:bg-[#131E10]'}`}>
          <div className="h-9 w-9 animate-pulse rounded-xl bg-[#E8E4DC] dark:bg-[#1E2E18]" style={{ opacity: 1 - i * 0.15 }} />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 w-36 animate-pulse rounded bg-[#E8E4DC] dark:bg-[#1E2E18]" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-[#F0EDE6] dark:bg-[#162010]" />
          </div>
        </div>
      ))}
    </div>
  );

  if (error) return <p className="text-[13px] text-red-500">{t('error_load')}</p>;

  const managed  = stations.filter((s) => s.status === 'active' || s.status === 'suspended');
  const q        = query.toLowerCase();
  const filtered = q ? managed.filter((s) => s.name.toLowerCase().includes(q) || (s.city ?? '').toLowerCase().includes(q)) : managed;

  if (!filtered.length) return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F3EE] dark:bg-[#131E10]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
      </div>
      <p className="text-[13px] font-semibold text-[#999]">{q ? t('empty_search') : t('empty_stations')}</p>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#E8E4DC] shadow-sm dark:border-[#1E2E18]">
      {/* Table header */}
      <div className="grid grid-cols-[40px_1fr_1fr_120px_140px] items-center gap-4 border-b border-[#E8E4DC] bg-[#F9F8F5] px-5 py-3 dark:border-[#1E2E18] dark:bg-[#0E1A0C]">
        {['', t('col_account'), t('col_location'), t('col_status'), t('col_actions')].map((h, i) => (
          <span key={i} className={`text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] dark:text-[#8A8A7A] ${i === 4 ? 'text-right' : ''}`}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      {filtered.map((station, idx) => {
        const s            = STATUS[station.status];
        const isConfirming = confirmId === station.id;
        const isBusy       = busy === station.id;

        return (
          <div key={station.id}
            className={[
              'grid grid-cols-[40px_1fr_1fr_120px_140px] items-center gap-4 border-b px-5 py-3.5 transition-colors duration-150 last:border-0',
              isConfirming
                ? confirmAction === 'suspend'
                  ? 'border-red-100 bg-red-50 dark:border-[#2A1010] dark:bg-[#1A0808]'
                  : 'border-green-100 bg-green-50 dark:border-[#0A2A14] dark:bg-[#0A1A10]'
                : idx % 2 === 0
                  ? 'border-[#F2EFE8] bg-white hover:bg-[#FEFCF5] dark:border-[#1A2A14] dark:bg-[#131E10] dark:hover:bg-[#182416]'
                  : 'border-[#F2EFE8] bg-[#FAFAF7] hover:bg-[#FEFCF5] dark:border-[#1A2A14] dark:bg-[#111C0E] dark:hover:bg-[#182416]',
            ].join(' ')}>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C49A1E]/12 text-[11px] font-black text-[#C49A1E]">
              {initials(station.name)}
            </div>

            <div className="min-w-0">
              <Link href={`/admin/stations/${station.id}` as Parameters<typeof Link>[0]['href']}
                className="block truncate text-[13px] font-bold text-[#1A1A0A] underline-offset-2 hover:text-[#C49A1E] hover:underline dark:text-[#F0EDD4]">
                {station.name}
              </Link>
              <p className="truncate text-[11px] text-[#BBBBAA] dark:text-[#8A8A7A]">{formatDate(station.created_at)}</p>
            </div>

            <p className="truncate text-[12px] text-[#777] dark:text-[#6A6A5A]">{station.city ?? '—'}</p>

            {s ? (
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
              </span>
            ) : <span />}

            <div className="flex justify-end gap-1.5">
              {isConfirming ? (
                <>
                  <button type="button" disabled={isBusy}
                    onClick={() => confirmAction && doAction(station.id, confirmAction)}
                    className={[
                      'rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50',
                      confirmAction === 'suspend' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700',
                    ].join(' ')}>
                    {isBusy ? '…' : t('btn_confirm')}
                  </button>
                  <button type="button" onClick={() => { setConfirmId(null); setConfirmAction(null); }}
                    className="rounded-lg border border-[#D8D4C8] px-3 py-1.5 text-[11px] font-semibold text-[#666] hover:bg-[#F5F3EE] dark:border-[#243020] dark:text-[#9A9A8A]">
                    {t('btn_cancel')}
                  </button>
                </>
              ) : station.status === 'active' ? (
                <button type="button" disabled={isBusy} onClick={() => requestConfirm(station.id, 'suspend')}
                  className="rounded-lg border border-orange-200 px-3 py-1.5 text-[11px] font-bold text-orange-600 hover:bg-orange-50 disabled:opacity-50 dark:border-orange-900/40 dark:text-orange-400 dark:hover:bg-orange-950/30">
                  {isBusy ? '…' : t('btn_suspend')}
                </button>
              ) : (
                <button type="button" disabled={isBusy} onClick={() => requestConfirm(station.id, 'activate')}
                  className="rounded-lg border border-green-200 px-3 py-1.5 text-[11px] font-bold text-green-700 hover:bg-green-50 disabled:opacity-50 dark:border-green-900/40 dark:text-green-400 dark:hover:bg-green-950/30">
                  {isBusy ? '…' : t('btn_activate')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

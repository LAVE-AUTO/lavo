'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { StationRow } from './AdminMerchantsClients';

const LEFT_BAR: Record<string, string> = {
  active:    'bg-[#00C851]',
  suspended: 'bg-[#FF8800]',
};
const STATUS_BADGE: Record<string, string> = {
  active:    'bg-[#00C851]/10 text-[#00C851]',
  suspended: 'bg-[#FF8800]/10 text-[#FF8800]',
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
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy]           = useState<string | null>(null);

  async function doAction(id: string, action: 'activate' | 'suspend') {
    setBusy(id); setConfirmId(null);
    try { await onAction(id, action); } finally { setBusy(null); }
  }

  if (loading) return (
    <div className="flex flex-col gap-2">
      {[...Array(5)].map((_, i) => <div key={i} className="h-[72px] animate-pulse rounded-xl bg-white dark:bg-[#131E10]" style={{ opacity: 1 - i * 0.15 }} />)}
    </div>
  );
  if (error) return <p className="text-[13px] text-[#EF4444]">{t('error_load')}</p>;

  const managed  = stations.filter((s) => s.status === 'active' || s.status === 'suspended');
  const q        = query.toLowerCase();
  const filtered = q ? managed.filter((s) => s.name.toLowerCase().includes(q) || (s.city ?? '').toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q)) : managed;

  if (!filtered.length) return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-[#131E10]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C49A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
      </div>
      <p className="text-[13px] font-semibold text-[#999] dark:text-[#5A5A4A]">{q ? t('empty_search') : t('empty_stations')}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {filtered.map((station) => {
        const isConfirming = confirmId === station.id;
        const isBusy       = busy === station.id;
        return (
          <div key={station.id} className={[
            'flex overflow-hidden rounded-xl border transition-all duration-200',
            isConfirming
              ? 'border-[#EF4444]/25 bg-[#FEF2F2] shadow-sm dark:border-[#3A1A1A] dark:bg-[#1C0A0A]'
              : 'border-[#ECEAE0] bg-white hover:border-[#D4C080]/50 hover:shadow-sm dark:border-[#1A2A14] dark:bg-[#131E10] dark:hover:border-[#2A3A20]',
          ].join(' ')}>

            {/* Status left bar */}
            <div className={`w-[3px] shrink-0 ${LEFT_BAR[station.status] ?? 'bg-[#E0DCD0] dark:bg-[#243020]'}`} />

            <div className="flex flex-1 items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C49A1E]/10 text-[12px] font-black text-[#C49A1E]">
                {initials(station.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/stations/${station.id}` as Parameters<typeof Link>[0]['href']}
                    className="truncate text-[14px] font-bold text-[#1A1A0A] underline-offset-2 hover:text-[#C49A1E] hover:underline dark:text-[#F0EDD4]">
                    {station.name}
                  </Link>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${STATUS_BADGE[station.status] ?? 'bg-[#E0DCD0] text-[#888]'}`}>
                    {t(`status_${station.status}`)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#BBBBAA] dark:text-[#4A4A3A]">
                  {station.city ?? '—'} · {formatDate(station.created_at)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                {isConfirming ? (
                  <>
                    <span className="hidden text-[11px] font-semibold text-[#EF4444] sm:block">{t('confirm_suspend_hint')}</span>
                    <button type="button" disabled={isBusy} onClick={() => doAction(station.id, 'suspend')}
                      className="rounded-lg bg-[#EF4444] px-3.5 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-50">
                      {isBusy ? '…' : t('btn_confirm')}
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)}
                      className="rounded-lg border border-[#D8D4C8] px-3.5 py-1.5 text-[11px] font-semibold text-[#666] hover:bg-[#F0EDE0] dark:border-[#243020] dark:text-[#9A9A8A] dark:hover:bg-[#1A2A14]">
                      {t('btn_cancel')}
                    </button>
                  </>
                ) : station.status === 'active' ? (
                  <button type="button" disabled={isBusy} onClick={() => setConfirmId(station.id)}
                    className="rounded-lg border border-[#FF8800]/30 px-3.5 py-1.5 text-[11px] font-bold text-[#FF8800] transition-colors hover:bg-[#FF8800]/8 disabled:opacity-50">
                    {t('btn_suspend')}
                  </button>
                ) : (
                  <button type="button" disabled={isBusy} onClick={() => doAction(station.id, 'activate')}
                    className="rounded-lg border border-[#00C851]/30 px-3.5 py-1.5 text-[11px] font-bold text-[#00C851] transition-colors hover:bg-[#00C851]/8 disabled:opacity-50">
                    {isBusy ? '…' : t('btn_activate')}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

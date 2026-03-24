'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { StationRow } from './AdminMerchantsClients';

const STATUS_STYLES: Record<string, string> = {
  active:                   'bg-[#00C851]/10 text-[#00C851]',
  suspended:                'bg-[#FF8800]/10 text-[#FF8800]',
  pending_admin_validation: 'bg-[#C49A1E]/10 text-[#C49A1E]',
  rejected:                 'bg-[#EF4444]/10 text-[#EF4444]',
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

interface Props {
  stations: StationRow[];
  loading: boolean;
  error: boolean;
  onAction: (id: string, action: 'activate' | 'suspend') => Promise<void>;
}

export function AdminStationsManagement({ stations, loading, error, onAction }: Props) {
  const t = useTranslations('admin_clients');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy]           = useState<string | null>(null);

  async function doAction(id: string, action: 'activate' | 'suspend') {
    setBusy(id);
    setConfirmId(null);
    try {
      await onAction(id, action);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return (
    <div className="flex flex-col gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F0EDE0] dark:bg-[#0E1A0A]" />
      ))}
    </div>
  );

  if (error) return (
    <p className="text-[13px] text-[#EF4444]">{t('error_load')}</p>
  );

  const managed = stations.filter((s) => s.status === 'active' || s.status === 'suspended');

  if (!managed.length) return (
    <p className="text-[13px] text-[#AAAAAA] dark:text-[#5A5A4A]">{t('empty_stations')}</p>
  );

  return (
    <div className="flex flex-col gap-2">
      {managed.map((station) => {
        const isConfirming = confirmId === station.id;
        const isBusy       = busy === station.id;
        const badgeClass   = STATUS_STYLES[station.status] ?? 'bg-[#E0DCD0] text-[#888]';

        return (
          <div key={station.id}
            className="flex items-center gap-4 rounded-xl border border-[#F0EDE0] bg-[#FAFAF5] px-5 py-3.5 transition-shadow duration-150 hover:shadow-sm dark:border-[#1E2E18] dark:bg-[#111A0E]">

            {/* Avatar */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C49A1E]/15 text-[12px] font-black text-[#C49A1E]">
              {initials(station.name)}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/admin/stations/${station.id}` as Parameters<typeof Link>[0]['href']}
                  className="truncate text-[13px] font-bold text-[#1A1A0A] hover:text-[#C49A1E] dark:text-[#F0EDD4]">
                  {station.name}
                </Link>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${badgeClass}`}>
                  {t(`status_${station.status}`) }
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-[#AAAAAA] dark:text-[#5A5A4A]">
                {station.city ?? '—'} · {formatDate(station.created_at)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              {isConfirming ? (
                <>
                  <button type="button" disabled={isBusy} onClick={() => doAction(station.id, 'suspend')}
                    className="rounded-lg bg-[#EF4444]/10 px-3 py-1.5 text-[11px] font-bold text-[#EF4444] hover:bg-[#EF4444]/20 disabled:opacity-50">
                    {isBusy ? '…' : t('btn_confirm')}
                  </button>
                  <button type="button" onClick={() => setConfirmId(null)}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-[#888] hover:bg-[#F0EDE0] dark:hover:bg-[#1A2A14]">
                    {t('btn_cancel')}
                  </button>
                </>
              ) : station.status === 'active' ? (
                <button type="button" disabled={isBusy} onClick={() => setConfirmId(station.id)}
                  className="rounded-lg border border-[#FF8800]/30 px-3 py-1.5 text-[11px] font-bold text-[#FF8800] hover:bg-[#FF8800]/8 disabled:opacity-50">
                  {t('btn_suspend')}
                </button>
              ) : (
                <button type="button" disabled={isBusy} onClick={() => doAction(station.id, 'activate')}
                  className="rounded-lg border border-[#00C851]/30 px-3 py-1.5 text-[11px] font-bold text-[#00C851] hover:bg-[#00C851]/8 disabled:opacity-50">
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

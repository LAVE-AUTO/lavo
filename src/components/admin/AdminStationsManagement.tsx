'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { intlDateLocale } from '@/helpers/date-helper';
import { Link } from '@/i18n/navigation';
import type { StationRow } from './AdminMerchantsClients';

const STATUS: Record<string, { badge: string; dot: string; label: string }> = {
  active:    { badge: 'bg-[#F0FDF4] text-[#166534] ring-1 ring-[#86EFAC]/40', dot: 'bg-[#22C55E]', label: 'status_active' },
  suspended: { badge: 'bg-[#FFF7ED] text-[#9A3412] ring-1 ring-[#FDBA74]/40', dot: 'bg-[#F97316]', label: 'status_suspended' },
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}
function formatDate(d: string, locale: string) {
  try { return new Date(d).toLocaleDateString(intlDateLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

interface Props {
  stations: StationRow[]; loading: boolean; error: boolean; query: string;
  onAction: (id: string, action: 'activate' | 'suspend') => Promise<void>;
  onEdit:   (station: StationRow) => void;
  onDelete: (station: StationRow) => void;
}

export function AdminStationsManagement({ stations, loading, error, query, onAction, onEdit, onDelete }: Props) {
  const t = useTranslations('admin_clients');
  const locale = useLocale();
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
    <div className="overflow-hidden rounded-xl border border-[#FFF9EC] dark:border-[#1E2E18]">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`flex items-center gap-4 border-b border-[#F2EFE8] px-5 py-4 last:border-0 dark:border-[#1A2A14] ${i === 0 ? 'bg-[#F9F8F5] dark:bg-[#0E1A0C]' : 'bg-white dark:bg-[#131E10]'}`}>
          <div className="h-9 w-9 animate-pulse rounded-xl bg-[#FFF9EC] dark:bg-[#1E2E18]" style={{ opacity: 1 - i * 0.15 }} />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 w-36 animate-pulse rounded bg-[#FFF9EC] dark:bg-[#1E2E18]" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-[#F0EDE6] dark:bg-[#162010]" />
          </div>
        </div>
      ))}
    </div>
  );

  if (error) return <p className="text-[13px] text-red-500">{t('error_load')}</p>;

  const q        = query.toLowerCase();
  const filtered = q ? stations.filter((s) => s.name.toLowerCase().includes(q) || (s.city ?? '').toLowerCase().includes(q)) : stations;

  function renderStatus(station: StationRow) {
    const s = STATUS[station.status];
    return s ? (
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${s.badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{t(s.label)}
      </span>
    ) : null;
  }

  function renderActionButton(station: StationRow, compact = false) {
    const isConfirming = confirmId === station.id;
    const isBusy = busy === station.id;

    if (isConfirming) {
      return (
        <div className={compact ? 'flex flex-col gap-2' : 'flex flex-wrap justify-end gap-2'}>
          <button type="button" disabled={isBusy}
            onClick={() => confirmAction && doAction(station.id, confirmAction)}
            className={[
              'rounded-[14px] px-4 py-2 text-[12px] font-bold text-white transition-colors disabled:opacity-50',
              confirmAction === 'suspend' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700',
            ].join(' ')}>
            {isBusy ? '…' : t('btn_confirm')}
          </button>
          <button type="button" onClick={() => { setConfirmId(null); setConfirmAction(null); }}
            className="rounded-[14px] border border-[#D8D4C8] px-4 py-2 text-[12px] font-semibold text-foreground/65 transition-colors hover:bg-[#F5F3EE] dark:border-[#001A05] dark:text-[#B0BFB1] dark:hover:bg-[#182214]">
            {t('btn_cancel')}
          </button>
        </div>
      );
    }

    if (station.status === 'active') {
      return (
        <button type="button" disabled={isBusy} onClick={() => requestConfirm(station.id, 'suspend')}
          className="rounded-[14px] border border-orange-200 px-4 py-2 text-[12px] font-bold text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-50 dark:border-orange-900/40 dark:text-orange-400 dark:hover:bg-orange-950/30">
          {isBusy ? '…' : t('btn_suspend')}
        </button>
      );
    }

    return (
      <button type="button" disabled={isBusy} onClick={() => requestConfirm(station.id, 'activate')}
        className="rounded-[14px] border border-green-200 px-4 py-2 text-[12px] font-bold text-green-700 transition-colors hover:bg-green-50 disabled:opacity-50 dark:border-green-900/40 dark:text-green-400 dark:hover:bg-green-950/30">
        {isBusy ? '…' : t('btn_activate')}
      </button>
    );
  }

  if (!filtered.length) return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F3EE] dark:bg-[#131E10]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
      </div>
      <p className="text-[13px] font-semibold text-[#999]">{q ? t('empty_search') : t('empty_stations')}</p>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#E6DFD1] bg-white/90 shadow-[0_18px_60px_rgba(26,26,10,0.06)] dark:border-[#1E2E18] dark:bg-[#0E170C]/95">
      <div className="border-b border-[#E9E4D8] bg-[#FCFBF8] px-5 py-4 text-[11px] font-black uppercase tracking-[0.22em] text-[#A7A091] dark:border-[#1E2E18] dark:bg-[#0D150B] dark:text-[#8E9988]">
        {q ? t('empty_search') : t('tab_stations')}
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {filtered.map((station) => {
          return (
            <article key={station.id} className="rounded-[24px] border border-[#E8E3D7] bg-[#FBFAF7] p-4 shadow-[0_12px_30px_rgba(26,26,10,0.05)] dark:border-[#1E2E18] dark:bg-[#111A0D]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#DDAF3B]/12 text-[12px] font-black text-[#DDAF3B]">
                    {initials(station.name)}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/admin/stations/${station.id}` as Parameters<typeof Link>[0]['href']}
                      className="block truncate text-[14px] font-black text-[#001201] underline-offset-2 hover:text-[#DDAF3B] hover:underline dark:text-[#FFF9EC]">
                      {station.name}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-[#979083] dark:text-[#B0BFB1]">{formatDate(station.created_at, locale)}</p>
                  </div>
                </div>
                {renderStatus(station)}
              </div>

              <div className="mt-4 rounded-[16px] bg-white px-3 py-2.5 text-[13px] text-foreground/70 shadow-[0_1px_0_rgba(26,26,10,0.04)] dark:bg-[#0C150B] dark:text-[#C8C2B3]">
                {station.city ?? '-'}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {renderActionButton(station, true)}
                <button type="button" onClick={() => onEdit(station)} title={t('btn_edit')}
                  className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-[#E1DBCF] bg-white text-foreground/55 transition-colors hover:border-[#DDAF3B]/40 hover:bg-[#FCF6E5] hover:text-[#9A7A13] dark:border-[#1E2E18] dark:bg-[#0E170C] dark:text-[#B0BFB1]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
                <button type="button" onClick={() => onDelete(station)} title={t('btn_delete')}
                  className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-red-200/60 bg-white text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:bg-[#0E170C] dark:text-red-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden md:block">
        <div className="grid grid-cols-[40px_1fr_1fr_120px_180px] items-center gap-4 border-b border-[#E9E4D8] bg-[#FCFBF8] px-5 py-3 dark:border-[#1E2E18] dark:bg-[#0D150B]">
          {['', t('col_account'), t('col_location'), t('col_status'), t('col_actions')].map((h, i) => (
            <span key={i} className={`text-[11px] font-black uppercase tracking-[0.22em] text-[#AAA395] dark:text-[#8F998A] ${i === 4 ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>

        <div>
          {filtered.map((station, idx) => {
            const isConfirming = confirmId === station.id;

            return (
              <div key={station.id}
                className={[
                  'grid grid-cols-[40px_1fr_1fr_120px_180px] items-center gap-4 border-b px-5 py-4 transition-colors duration-150 last:border-0',
                  isConfirming
                    ? confirmAction === 'suspend'
                      ? 'border-red-100 bg-red-50/80 dark:border-[#2A1010] dark:bg-[#1A0808]'
                      : 'border-green-100 bg-green-50/80 dark:border-[#0A2A14] dark:bg-[#0A1A10]'
                    : idx % 2 === 0
                      ? 'border-[#F2EFE8] bg-white hover:bg-[#FEFCF5] dark:border-[#1A2A14] dark:bg-[#111A0D] dark:hover:bg-[#182416]'
                      : 'border-[#F2EFE8] bg-[#FAFAF7] hover:bg-[#FEFCF5] dark:border-[#1A2A14] dark:bg-[#0F180B] dark:hover:bg-[#182416]',
                ].join(' ')}>

                <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-[#DDAF3B]/12 text-[12px] font-black text-[#DDAF3B]">
                  {initials(station.name)}
                </div>

                <div className="min-w-0">
                  <Link href={`/admin/stations/${station.id}` as Parameters<typeof Link>[0]['href']}
                    className="block truncate text-[13px] font-bold text-[#001201] underline-offset-2 hover:text-[#DDAF3B] hover:underline dark:text-[#FFF9EC]">
                    {station.name}
                  </Link>
                  <p className="truncate text-[12px] text-[#BBBBAA] dark:text-[#B0BFB1]">{formatDate(station.created_at, locale)}</p>
                </div>

                <p className="truncate text-[13px] text-[#777] dark:text-[#C8C2B3]">{station.city ?? '-'}</p>

                <div>{renderStatus(station)}</div>

                <div className="flex items-center justify-end gap-1.5">
                  {renderActionButton(station)}
                  <button type="button" onClick={() => onEdit(station)} title={t('btn_edit')}
                    className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-[#E1DBCF] bg-white text-foreground/55 transition-colors hover:border-[#DDAF3B]/40 hover:bg-[#FCF6E5] hover:text-[#9A7A13] dark:border-[#1E2E18] dark:bg-[#0E170C] dark:text-[#B0BFB1] dark:hover:bg-[#1A2410] dark:hover:text-[#F0D98C]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button type="button" onClick={() => onDelete(station)} title={t('btn_delete')}
                    className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-red-200/60 bg-white text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:bg-[#0E170C] dark:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

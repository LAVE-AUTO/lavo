'use client';

import Link from 'next/link';
import { useCallback, useState, useMemo, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getFromApi } from '@/services/axios-service';
import { ReceiptModal } from './ReceiptModal';
import { PageSpinner } from '@/components/ui/PageSpinner';

type PeriodKey = 'all' | 'week' | 'month' | '3months' | 'year';
type StatusKey = 'all' | 'completed' | 'cancelled';

type HistoryReservation = {
  id: string;
  stationName: string;
  stationAddress: string;
  vehicleFormatLabel: string | null;
  entryType: 'reservation' | 'queue';
  amountPaid: number;
  /** Tip portion of amountPaid; used for the receipt's items breakdown. */
  tipAmount: number | null;
  status: 'completed' | 'cancelled';
  createdAt: string;
};

type HistoryApiEntry = {
  id: string;
  title: string;
  status: string;
  entry_type: 'reservation' | 'queue';
  created_at: string;
  station: { name: string | null; address: string | null; city: string | null };
  vehicle_format_label: string | null;
  amount_paid: string;
  tip_amount?: string | null;
};

type HistoryApiResponse = {
  data: {
    items: HistoryApiEntry[];
  };
};

const HISTORY_STATUSES: HistoryReservation['status'][] = ['completed', 'cancelled'];

function getPeriodStart(period: PeriodKey): Date | null {
  if (period === 'all') return null;
  const d = new Date();
  if (period === 'week')    d.setDate(d.getDate() - 7);
  if (period === 'month')   d.setMonth(d.getMonth() - 1);
  if (period === '3months') d.setMonth(d.getMonth() - 3);
  if (period === 'year')    d.setFullYear(d.getFullYear() - 1);
  return d;
}

function formatAmount(amount: number): string {
  return `${amount.toFixed(2)}$`;
}

export function ClientHistoryView() {
  const t      = useTranslations('history');
  const locale = useLocale();

  const [entries, setEntries] = useState<HistoryReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [status, setStatus] = useState<StatusKey>('all');
  const [selected, setSelected] = useState<HistoryReservation | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    /* Backend caps `limit` at 100 (validators/history.ts). Use the max so we
     * surface as many entries as possible in a single fetch; pagination can
     * be added later if users routinely have more than 100 historical items. */
    const [ok, data] = await getFromApi<HistoryApiResponse>('/history/client?limit=100');

    const raw = ok && data && typeof data === 'object' && 'data' in data
      ? (data as HistoryApiResponse).data?.items
      : null;

    if (Array.isArray(raw)) {
      setEntries(
        raw
          .filter((entry) => entry.status === 'completed' || entry.status === 'cancelled')
          .map((entry) => ({
            id: entry.id,
            stationName: entry.station.name ?? entry.title,
            stationAddress: [entry.station.address, entry.station.city].filter(Boolean).join(', '),
            vehicleFormatLabel: entry.vehicle_format_label,
            entryType: entry.entry_type,
            amountPaid: Number.parseFloat(entry.amount_paid) || 0,
            tipAmount: entry.tip_amount != null ? Number.parseFloat(entry.tip_amount) || 0 : null,
            status: entry.status as HistoryReservation['status'],
            createdAt: entry.created_at,
          })),
      );
    } else {
      setEntries([]);
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let aborted = false;
    (async () => {
      await loadEntries();
      if (aborted) return;
    })();
    return () => { aborted = true; };
  }, [loadEntries]);

  const filtered = useMemo(() => {
    const start = getPeriodStart(period);
    return entries
      .filter((e) => status === 'all' || e.status === status)
      .filter((e) => !start || new Date(e.createdAt) >= start)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [entries, period, status]);

  const totalSpent = useMemo(
    () => filtered
      .filter((e) => e.status === 'completed')
      .reduce((sum, e) => sum + e.amountPaid, 0),
    [filtered],
  );

  const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: 'all',     label: t('period_all') },
    { key: 'week',    label: t('period_week') },
    { key: 'month',   label: t('period_month') },
    { key: '3months', label: t('period_3months') },
    { key: 'year',    label: t('period_year') },
  ];

  const STATUSES: { key: StatusKey; label: string }[] = [
    { key: 'all',       label: t('status_all') },
    { key: 'completed', label: t('status_completed') },
    { key: 'cancelled', label: t('status_cancelled') },
  ];

  if (loading) return <PageSpinner py="py-20" />;

  return (
    <div className="animate-fade-in">

      {loadError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-6 rounded-2xl border border-[#E8472A]/20 bg-[#E8472A]/6 px-4 py-5 text-center dark:border-[#E8472A]/30 dark:bg-[#E8472A]/10"
        >
          <p className="text-[14px] font-semibold text-[#B2351F] dark:text-[#F0A090]">{t('error_load')}</p>
          <button
            type="button"
            onClick={loadEntries}
            className="mt-3 rounded-full border border-[#C49A1E]/40 px-4 py-2 text-[13px] font-semibold text-[#C49A1E] transition-colors hover:bg-[#C49A1E]/10"
          >
            {t('btn_retry')}
          </button>
        </div>
      )}

      {/* Stats */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl p-4 border border-[#D0D0C0] dark:border-tab-inactive text-center">
            <div className="text-[24px] font-black text-[#0A0A14] dark:text-white leading-none">{filtered.length}</div>
            <div className="text-[11px] text-[#666] dark:text-[#B0B0A0] mt-1.5 uppercase tracking-wider font-bold">
              {t('total_entries')}
            </div>
          </div>
          <div className="bg-[#E8E8D8] dark:bg-dark-card rounded-xl p-4 border border-[#D0D0C0] dark:border-tab-inactive text-center">
            <div className="text-[24px] font-black text-gold leading-none">{formatAmount(totalSpent)}</div>
            <div className="text-[11px] text-[#666] dark:text-[#B0B0A0] mt-1.5 uppercase tracking-wider font-bold">
              {t('total_spent')}
            </div>
          </div>
        </div>
      )}

      {/* Period filter */}
      <div className="mb-4">
        <p className="text-[11px] font-black text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-2">
          {t('filter_period')}
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={[
                'px-3 py-1.5 rounded-full text-[13px] font-bold transition-colors',
                period === key
                  ? 'bg-gold text-dark-bg'
                  : 'bg-[#E0E0D0] dark:bg-dark-card text-[#555] dark:text-[#C0C0B0] hover:bg-[#D0D0C0] dark:hover:bg-tab-inactive',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="mb-6">
        <p className="text-[11px] font-black text-[#555] dark:text-[#A0A090] uppercase tracking-wider mb-2">
          {t('filter_status')}
        </p>
        <div className="flex gap-1.5">
          {STATUSES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              className={[
                'px-3 py-1.5 rounded-full text-[13px] font-bold transition-colors',
                status === key
                  ? key === 'completed' ? 'bg-Hurryline-success text-white'
                  : key === 'cancelled' ? 'bg-Hurryline-error text-white'
                  : 'bg-gold text-dark-bg'
                  : 'bg-[#E0E0D0] dark:bg-dark-card text-[#555] dark:text-[#C0C0B0] hover:bg-[#D0D0C0] dark:hover:bg-tab-inactive',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <HistoryEmpty t={t} />
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              locale={locale}
              t={t}
              onSelect={() => setSelected(entry)}
            />
          ))}
        </div>
      )}

      {/* Receipt modal */}
      {selected && (
        <ReceiptModal entry={selected} locale={locale} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History card                                                         */
/* ------------------------------------------------------------------ */

interface HistoryCardProps {
  entry: HistoryReservation;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  onSelect: () => void;
}

function HistoryCard({ entry: e, locale, t, onSelect }: HistoryCardProps) {
  const dateLabel = new Date(e.createdAt).toLocaleDateString(
    locale === 'en' ? 'en-CA' : 'fr-CA',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );

  const typeLabel = e.entryType === 'queue' ? t('receipt_entry_type_queue') : t('receipt_entry_type_reservation');

  const isCompleted = e.status === 'completed';

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left bg-[#E8E8D8] dark:bg-dark-card rounded-xl border border-[#D0D0C0] dark:border-tab-inactive p-4 hover:border-gold/30 transition-colors"
    >
      <div className="flex gap-3 items-center">
        <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-[#D0D0C0] dark:bg-tab-inactive">
          <div className="flex h-full w-full items-center justify-center text-[11px] font-black uppercase tracking-wide text-[#777] dark:text-[#B0B0A0]">SW</div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[15px] font-bold text-[#0A0A14] dark:text-white leading-tight line-clamp-1">
              {e.stationName}
            </span>
            <span className={[
              'shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold',
              isCompleted
                ? 'bg-Hurryline-success/15 text-Hurryline-success'
                : 'bg-Hurryline-error/15 text-Hurryline-error',
            ].join(' ')}>
              {t(`status_${e.status}`)}
            </span>
          </div>

          <p className="text-[13px] text-[#666] dark:text-[#B0B0A0] mt-0.5 truncate">
            {[e.vehicleFormatLabel, typeLabel].filter(Boolean).join(' · ')}
          </p>

          <div className="flex items-center gap-3 mt-1.5 text-[13px]">
            <span className="text-[#777] dark:text-[#C0C0B0]">{dateLabel}</span>
            <span className="ml-auto font-black text-gold">{formatAmount(e.amountPaid)}</span>
          </div>
        </div>

        {/* Chevron - only for completed (receipt available) */}
        {isCompleted && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#af8408" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                          */
/* ------------------------------------------------------------------ */

function HistoryEmpty({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[#E0E0D0] dark:bg-dark-card flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9A9A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <div>
        <p className="text-[16px] font-bold text-[#0A0A14] dark:text-white">{t('empty_title')}</p>
        <p className="text-[14px] text-[#666] dark:text-[#B0B0A0] mt-1 max-w-xs">{t('empty_desc')}</p>
      </div>
      <Link
        href="/stations"
        className="rounded-full bg-gold px-5 py-2.5 text-[13px] font-bold text-dark-bg transition-colors hover:bg-gold-hover"
      >
        {t('empty_cta')}
      </Link>
    </div>
  );
}

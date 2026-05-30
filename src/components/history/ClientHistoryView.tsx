'use client';

import Link from 'next/link';
import { useCallback, useState, useMemo, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getFromApi } from '@/services/axios-service';
import { ReceiptModal } from './ReceiptModal';
import { HistoryCard, type HistoryReservation } from './HistoryCard';
import { PageSpinner } from '@/components/ui/PageSpinner';

type PeriodKey = 'all' | 'week' | 'month' | '3months' | 'year';
type StatusKey = 'all' | 'completed' | 'cancelled';

type HistoryApiEntry = {
  id: string;
  title: string;
  status: string;
  entry_type: 'reservation' | 'queue';
  created_at: string;
  station: { name: string | null; address: string | null; city: string | null };
  vehicle_format_label: string | null;
  service_name: string | null;
  service_category: string | null;
  amount_paid: string;
  tip_amount?: string | null;
};

type HistoryApiResponse = { data: { items: HistoryApiEntry[] } };

function getPeriodStart(period: PeriodKey): Date | null {
  if (period === 'all') return null;
  const d = new Date();
  if (period === 'week')    d.setDate(d.getDate() - 7);
  if (period === 'month')   d.setMonth(d.getMonth() - 1);
  if (period === '3months') d.setMonth(d.getMonth() - 3);
  if (period === 'year')    d.setFullYear(d.getFullYear() - 1);
  return d;
}

function formatAmount(amount: number, locale: string): string {
  return `${amount.toLocaleString(locale === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}$`;
}

export function ClientHistoryView() {
  const t = useTranslations('history');
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
    /* Backend caps `limit` at 100 (validators/history.ts). */
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
            serviceName: entry.service_name,
            serviceCategory: entry.service_category,
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

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  const filtered = useMemo(() => {
    const start = getPeriodStart(period);
    return entries
      .filter((e) => status === 'all' || e.status === status)
      .filter((e) => !start || new Date(e.createdAt) >= start)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [entries, period, status]);

  /* KPIs span the filtered view so they match the visible list. */
  const totalSpent = useMemo(
    () => filtered.filter((e) => e.status === 'completed').reduce((sum, e) => sum + e.amountPaid, 0),
    [filtered],
  );
  const completedCount = useMemo(
    () => filtered.filter((e) => e.status === 'completed').length,
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
    <div className="animate-fade-in space-y-6">

      {loadError && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-2xl border border-Hurryline-error/20 bg-Hurryline-error/8 px-4 py-5 text-center dark:border-Hurryline-error/30 dark:bg-Hurryline-error/10"
        >
          <p className="text-[14px] font-semibold text-[#B2351F] dark:text-[#F0A090]">{t('error_load')}</p>
          <button
            type="button"
            onClick={loadEntries}
            className="mt-3 rounded-full border border-gold/40 px-4 py-2 text-[13px] font-semibold text-gold transition-colors hover:bg-gold/10 cursor-pointer"
          >
            {t('btn_retry')}
          </button>
        </div>
      )}

      {/* KPIs */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label={t('total_entries')}
            value={String(filtered.length)}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="13" x2="15" y2="13" />
                <line x1="9" y1="17" x2="15" y2="17" />
              </svg>
            }
          />
          <KpiCard
            label={t('total_spent')}
            value={formatAmount(totalSpent, locale)}
            sub={completedCount > 0 ? t('kpi_completed_x', { count: completedCount }) : undefined}
            highlight
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            }
          />
        </div>
      )}

      {/* Filters - period + status grouped in one card for cohesion */}
      {entries.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <FilterStrip
            label={t('filter_period')}
            items={PERIODS}
            value={period}
            onChange={setPeriod}
          />
          <div className="border-t border-border/60 dark:border-border">
            <FilterStrip
              label={t('filter_status')}
              items={STATUSES}
              value={status}
              onChange={setStatus}
              variantByKey={(k) => k === 'completed' ? 'success' : k === 'cancelled' ? 'error' : 'gold'}
            />
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <HistoryEmpty t={t} />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              locale={locale}
              onSelect={() => setSelected(entry)}
            />
          ))}
        </div>
      )}

      {selected && (
        <ReceiptModal entry={selected} locale={locale} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI card                                                             */
/* ------------------------------------------------------------------ */

function KpiCard({
  label, value, sub, icon, highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-border">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
          {icon}
        </span>
        <span className="text-[10.5px] font-black text-foreground/65 dark:text-[#B0BFB1] uppercase tracking-[0.15em]">{label}</span>
      </div>
      <p className={`mt-3 text-[24px] sm:text-[26px] font-black leading-none ${highlight ? 'text-gold' : 'text-foreground'}`}>
        {value}
      </p>
      {sub && (
        <p className="mt-1.5 text-[11px] font-semibold text-foreground/55 dark:text-[#8A8A82]">{sub}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filter strip                                                         */
/* ------------------------------------------------------------------ */

interface FilterStripProps<T extends string> {
  label: string;
  items: { key: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  variantByKey?: (key: T) => 'gold' | 'success' | 'error';
}

function FilterStrip<T extends string>({ label, items, value, onChange, variantByKey }: FilterStripProps<T>) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-[10.5px] font-black text-foreground/65 dark:text-[#B0BFB1] uppercase tracking-[0.15em] mb-2.5">{label}</p>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
        {items.map(({ key, label: l }) => {
          const isActive = value === key;
          const variant = variantByKey ? variantByKey(key) : 'gold';
          const activeClass =
            variant === 'success' ? 'bg-Hurryline-success text-white'
            : variant === 'error' ? 'bg-Hurryline-error text-white'
            : 'bg-gold text-dark-bg';
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={[
                'shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors cursor-pointer',
                isActive
                  ? activeClass
                  : 'bg-white/70 dark:bg-tab-inactive text-foreground/70 hover:bg-surface/60 dark:hover:bg-tab-inactive',
              ].join(' ')}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                          */
/* ------------------------------------------------------------------ */

function HistoryEmpty({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center bg-surface rounded-2xl border border-border">
      <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <div className="px-6">
        <p className="text-[16px] font-black text-foreground">{t('empty_title')}</p>
        <p className="text-[13.5px] text-foreground/65 mt-1 max-w-xs mx-auto leading-snug">{t('empty_desc')}</p>
      </div>
      <Link
        href="/stations"
        className="rounded-full bg-gold px-5 py-2.5 text-[13px] font-black text-dark-bg transition-colors hover:bg-gold-hover btn-shine"
      >
        {t('empty_cta')}
      </Link>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatMoneyPrefix } from '@/helpers/money';
import type { ReservationItem } from './types';

interface Props {
  items: ReservationItem[];
  view: 'weekly' | 'monthly';
  selectedDate: Date;
}

/* Status pill styling — colour-coded chip + label key (reuses the dashboard status keys). */
const STATUS_STYLE: Record<string, { dot: string; cls: string; key: string }> = {
  confirmed:       { dot: '#1E40AF', cls: 'bg-[#1E40AF]/12 text-[#1E40AF] dark:text-[#8AB4FF]', key: 'status_confirmed' },
  pending:         { dot: '#F59E0B', cls: 'bg-[#F59E0B]/15 text-[#92600A] dark:text-[#F5C451]', key: 'status_pending' },
  pending_payment: { dot: '#888888', cls: 'bg-[#888]/15 text-foreground/65', key: 'status_confirmed' },
  in_progress:     { dot: '#10B981', cls: 'bg-[#2ECC71]/15 text-[#0E8C45] dark:text-[#65E69A]', key: 'status_in_progress' },
  completed:       { dot: '#AAAAAA', cls: 'bg-[#999]/15 text-foreground/55', key: 'status_completed' },
  cancelled:       { dot: '#EF4444', cls: 'bg-[#FF383C]/12 text-[#B33B1F] dark:text-[#FF8866]', key: 'status_cancelled' },
  late:            { dot: '#F97316', cls: 'bg-[#F97316]/15 text-[#B5470F] dark:text-[#FFA866]', key: 'status_late' },
};

function styleFor(status: string) {
  return STATUS_STYLE[status] ?? STATUS_STYLE.confirmed;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOf(d: Date): Date {
  const m = new Date(d);
  const dow = m.getDay();
  m.setDate(m.getDate() - (dow === 0 ? 6 : dow - 1));
  m.setHours(0, 0, 0, 0);
  return m;
}

function isoWeekKey(d: Date): string {
  const thu = new Date(d);
  thu.setDate(d.getDate() + (4 - (d.getDay() || 7)));
  const year = thu.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const week = Math.ceil(((thu.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function formatTime(iso: string | null, locale: string): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** Revenue counted for a group: every non-cancelled entry with a recorded amount. */
function revenueOf(items: ReservationItem[]): number {
  return items.reduce((sum, r) => (r.status !== 'cancelled' && r.amountPaid ? sum + r.amountPaid : sum), 0);
}

const WEEKDAY_SHORT_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
const WEEKDAY_SHORT_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/* ------------------------------------------------------------------ */
/* Reservation row                                                      */
/* ------------------------------------------------------------------ */

function ReservationRow({
  item,
  locale,
  t,
}: {
  item: ReservationItem;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const s = styleFor(item.status);
  const secondary = [item.serviceName, item.vehicleFormat].filter(Boolean).join(' · ');

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#FBFAF4] dark:hover:bg-[#101A0C]">
      {/* Time column */}
      <div className="w-12 shrink-0 text-center">
        <span className="font-mono text-[12px] font-bold tabular-nums text-[#001201] dark:text-[#FFF9EC]">
          {formatTime(item.slotStart, locale)}
        </span>
      </div>

      <span className="h-8 w-px shrink-0" style={{ background: s.dot, opacity: 0.45 }} aria-hidden="true" />

      {/* Identity */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[#001201] dark:text-[#FFF9EC]">{item.clientName}</p>
        {secondary && (
          <p className="truncate text-[11.5px] text-foreground/55 dark:text-[#B0BFB1]">{secondary}</p>
        )}
      </div>

      {/* Status + amount */}
      <div className="flex shrink-0 items-center gap-2.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${s.cls}`}>
          {t(s.key)}
        </span>
        {item.amountPaid !== null && (
          <span className="w-14 text-right text-[12px] font-black text-[#DDAF3B]">{formatMoneyPrefix(item.amountPaid)}</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Group section (a day in weekly view, a week in monthly view)         */
/* ------------------------------------------------------------------ */

function GroupSection({
  label,
  sublabel,
  items,
  locale,
  t,
  highlight = false,
  /** When set, rows are sub-grouped by day with a small day label (monthly view). */
  subGroupByDay = false,
}: {
  label: string;
  sublabel?: string;
  items: ReservationItem[];
  locale: string;
  t: ReturnType<typeof useTranslations>;
  highlight?: boolean;
  subGroupByDay?: boolean;
}) {
  const revenue = revenueOf(items);
  const dayLabels = locale === 'en' ? WEEKDAY_SHORT_EN : WEEKDAY_SHORT_FR;

  const dayGroups = useMemo(() => {
    if (!subGroupByDay) return null;
    const map = new Map<string, ReservationItem[]>();
    for (const r of items) {
      if (!r.slotStart) continue;
      const d = new Date(r.slotStart);
      const key = isoDate(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rows]) => {
        const d = new Date(`${key}T00:00`);
        return { key, label: `${dayLabels[d.getDay()]} ${d.getDate()}`, rows };
      });
  }, [items, subGroupByDay, dayLabels]);

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors dark:bg-dark-bg ${
        highlight ? 'border-[#DDAF3B]/60 ring-1 ring-[#DDAF3B]/30' : 'border-[#E7E3D4] dark:border-[#1A2A14]'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${highlight ? 'bg-[#DDAF3B]/10' : 'bg-[#F7F5EC] dark:bg-[#101A0C]'}`}>
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[13px] font-black text-[#001201] dark:text-[#FFF9EC]">{label}</span>
          {sublabel && <span className="truncate text-[11px] font-semibold text-foreground/55 dark:text-[#B0BFB1]">{sublabel}</span>}
          {highlight && (
            <span className="shrink-0 rounded-full bg-[#DDAF3B] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-dark-bg">
              {t('grouped_today')}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-[#DDAF3B]/20 px-2 py-0.5 text-[10px] font-black text-[#9A7A0A] dark:text-[#E8C040]">
            {items.length}
          </span>
          {revenue > 0 && (
            <span className="text-[11px] font-black text-[#0E8C45] dark:text-[#65E69A]">{formatMoneyPrefix(revenue)}</span>
          )}
        </div>
      </div>

      {/* Body */}
      {items.length === 0 ? (
        <p className="px-4 py-3 text-[12px] font-medium text-[#B0B0A0] dark:text-foreground/45">{t('grouped_empty_day')}</p>
      ) : dayGroups ? (
        <div className="divide-y divide-[#F0EDE0] dark:divide-[#1A2A14]">
          {dayGroups.map((g) => (
            <div key={g.key}>
              <div className="bg-[#FBFAF4] px-4 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-foreground/45 dark:bg-[#0C140A] dark:text-[#B0BFB1]/70">
                {g.label}
              </div>
              <div className="divide-y divide-[#F4F2E8] dark:divide-[#162012]">
                {g.rows.map((item) => <ReservationRow key={item.id} item={item} locale={locale} t={t} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-[#F0EDE0] dark:divide-[#1A2A14]">
          {items.map((item) => <ReservationRow key={item.id} item={item} locale={locale} t={t} />)}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                                */
/* ------------------------------------------------------------------ */

export function DashboardGroupedPanel({ items, view, selectedDate }: Props) {
  const locale = useLocale();
  const t = useTranslations('station_dashboard');
  const dayLabels = locale === 'en' ? WEEKDAY_SHORT_EN : WEEKDAY_SHORT_FR;
  const todayKey = isoDate(new Date());

  const groups = useMemo(() => {
    if (view === 'weekly') {
      const mon = mondayOf(selectedDate);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        const key = isoDate(d);
        const dayItems = items
          .filter((r) => r.slotStart && isoDate(new Date(r.slotStart)) === key)
          .sort((a, b) => (a.slotStart ?? '').localeCompare(b.slotStart ?? ''));
        const dayName = d.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-FR', { weekday: 'long' });
        return {
          key,
          label: `${dayLabels[d.getDay()]} ${d.getDate()}`,
          sublabel: dayName.charAt(0).toUpperCase() + dayName.slice(1),
          items: dayItems,
          highlight: key === todayKey,
          subGroupByDay: false,
        };
      });
    }

    // monthly: group by ISO week, rows then sub-grouped by day inside each week
    const weekMap = new Map<string, { label: string; sublabel: string; items: ReservationItem[] }>();
    for (const r of items) {
      if (!r.slotStart) continue;
      const d = new Date(r.slotStart);
      const weekKey = isoWeekKey(d);
      if (!weekMap.has(weekKey)) {
        const mon = mondayOf(d);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        const fmt = (dt: Date) => `${dt.getDate()} ${dt.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-FR', { month: 'short' })}`;
        weekMap.set(weekKey, { label: `${fmt(mon)} – ${fmt(sun)}`, sublabel: '', items: [] });
      }
      weekMap.get(weekKey)!.items.push(r);
    }
    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({ key, ...val, highlight: false, subGroupByDay: true }));
  }, [items, view, selectedDate, locale, dayLabels, todayKey]);

  const totalCount = items.length;
  const totalRevenue = useMemo(() => revenueOf(items), [items]);

  if (totalCount === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#DDAF3B]/10">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DDAF3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <p className="text-[15px] font-black text-[#001201] dark:text-[#FFF9EC]">{t('grouped_empty_title')}</p>
        <p className="max-w-xs text-[12.5px] text-foreground/55 dark:text-[#B0BFB1]">{t('grouped_empty_desc')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Period summary */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-[#E7E3D4] bg-[#F7F5EC] px-4 py-2.5 dark:border-[#1A2A14] dark:bg-[#101A0C]">
        <div className="flex items-center gap-2">
          <span className="text-[20px] font-black leading-none text-[#001201] dark:text-[#FFF9EC]">{totalCount}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55 dark:text-[#B0BFB1]">{t('grouped_period_reservations')}</span>
        </div>
        <span className="h-6 w-px bg-[#E0DDCC] dark:bg-[#1A2A14]" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <span className="text-[20px] font-black leading-none text-[#0E8C45] dark:text-[#65E69A]">{formatMoneyPrefix(totalRevenue)}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55 dark:text-[#B0BFB1]">{t('grouped_period_revenue')}</span>
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <GroupSection
              key={g.key}
              label={g.label}
              sublabel={g.sublabel}
              items={g.items}
              locale={locale}
              t={t}
              highlight={g.highlight}
              subGroupByDay={g.subGroupByDay}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

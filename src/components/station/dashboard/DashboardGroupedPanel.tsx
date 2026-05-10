'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import type { ReservationItem } from './DashboardReservationsPanel';

interface Props {
  items: ReservationItem[];
  view: 'weekly' | 'monthly';
  selectedDate: Date;
}

const STATUS_DOT: Record<string, string> = {
  confirmed:       '#3B82F6',
  pending:         '#F59E0B',
  pending_payment: '#888',
  in_progress:     '#10B981',
  completed:       '#AAA',
  cancelled:       '#EF4444',
  late:            '#F97316',
};

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

function ReservationRow({ item, locale }: { item: ReservationItem; locale: string }) {
  const dot = STATUS_DOT[item.status] ?? '#888';
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-4">
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 h-2 w-2 rounded-full" style={{ background: dot }} />
        <span className="text-[13px] font-semibold text-[#1A1A0A] dark:text-[#F0EDD4] truncate">
          {item.clientName}
        </span>
        {item.vehicleFormat && (
          <span className="shrink-0 text-[11px] text-[#888] dark:text-[#A0A090]">{item.vehicleFormat}</span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 text-[12px]">
        {item.slotStart && (
          <span className="font-mono text-[#666] dark:text-[#A0A090]">{formatTime(item.slotStart, locale)}</span>
        )}
        {item.amountPaid !== null && (
          <span className="font-bold text-[#C49A1E]">{item.amountPaid.toFixed(2)} $</span>
        )}
      </div>
    </div>
  );
}

function DaySection({ label, items, locale }: { label: string; items: ReservationItem[]; locale: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-[#888] dark:text-[#A0A090]">{label}</span>
        {items.length > 0 && (
          <span className="rounded-full bg-[#C49A1E]/20 px-2 py-0.5 text-[10px] font-black text-[#C49A1E]">
            {items.length}
          </span>
        )}
      </div>
      <div className="rounded-xl border border-[#E0DCD0] bg-white dark:border-[#1A2A14] dark:bg-[#111A0E] divide-y divide-[#F0EDE0] dark:divide-[#1A2A14]">
        {items.length === 0 ? (
          <p className="px-4 py-3 text-[12px] text-[#B0B0A0] dark:text-[#666]">—</p>
        ) : (
          items.map((item) => <ReservationRow key={item.id} item={item} locale={locale} />)
        )}
      </div>
    </div>
  );
}

const WEEKDAY_SHORT_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
const WEEKDAY_SHORT_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function DashboardGroupedPanel({ items, view, selectedDate }: Props) {
  const locale = useLocale();
  const dayLabels = locale === 'en' ? WEEKDAY_SHORT_EN : WEEKDAY_SHORT_FR;

  const grouped = useMemo(() => {
    if (view === 'weekly') {
      const mon = mondayOf(selectedDate);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        return d;
      });
      return days.map((d) => {
        const key = isoDate(d);
        const dayItems = items.filter((r) => r.slotStart && isoDate(new Date(r.slotStart)) === key);
        const label = `${dayLabels[d.getDay()]} ${d.getDate()}`;
        return { key, label, items: dayItems };
      });
    }

    // monthly: group by ISO week
    const weekMap = new Map<string, { label: string; items: ReservationItem[] }>();
    for (const r of items) {
      if (!r.slotStart) continue;
      const d = new Date(r.slotStart);
      const weekKey = isoWeekKey(d);
      if (!weekMap.has(weekKey)) {
        const mon = mondayOf(d);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        const fmt = (dt: Date) =>
          `${dt.getDate()} ${dt.toLocaleDateString(locale === 'en' ? 'en-CA' : 'fr-FR', { month: 'short' })}`;
        weekMap.set(weekKey, { label: `${fmt(mon)} – ${fmt(sun)}`, items: [] });
      }
      weekMap.get(weekKey)!.items.push(r);
    }
    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({ key, ...val }));
  }, [items, view, selectedDate, locale, dayLabels]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {grouped.map((g) => (
        <DaySection key={g.key} label={g.label} items={g.items} locale={locale} />
      ))}
    </div>
  );
}

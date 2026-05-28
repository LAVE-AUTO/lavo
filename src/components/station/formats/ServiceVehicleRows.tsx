'use client';

import { useTranslations } from 'next-intl';
import { TextField } from '@/components/station/config/TextField';
import type { ServiceVehicleEntry, VehicleFormat } from './types';

interface Props {
  formats: VehicleFormat[];
  entries: ServiceVehicleEntry[];
  onChange: (entries: ServiceVehicleEntry[]) => void;
  searchQuery?: string;
  unavailableMessage?: string;
}

export function ServiceVehicleRows({
  formats,
  entries,
  onChange,
  searchQuery,
  unavailableMessage,
}: Props) {
  const t = useTranslations('station_services');

  const normalizedQuery = (searchQuery || '').trim().toLowerCase();
  const visibleEntries = normalizedQuery
    ? entries.filter((e) => e.vehicle_label.toLowerCase().includes(normalizedQuery))
    : entries;

  function update(formatId: string, field: keyof ServiceVehicleEntry, value: string | number | boolean) {
    onChange(entries.map((e) => (e.vehicle_format_id === formatId ? { ...e, [field]: value } : e)));
  }

  if (formats.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#FFF9EC] p-3 text-[13px] text-foreground/55 dark:border-[#001A05] dark:text-[#5A5A4A]">
        {t('no_formats')}
      </p>
    );
  }

  if (visibleEntries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#FFF9EC] p-3 text-[13px] text-foreground/55 dark:border-[#001A05] dark:text-[#5A5A4A]">
        {unavailableMessage || t('format_not_in_list')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {visibleEntries.map((entry) => (
        <div
          key={entry.vehicle_format_id}
          className="flex flex-wrap items-end gap-3 rounded-xl bg-[#FFF9EC] px-3 py-3 dark:bg-[#001201]"
        >
          {/* Format label */}
          <span className="w-[80px] shrink-0 self-center text-[11px] font-black uppercase tracking-[0.6px] text-[#DDAF3B]">
            {entry.vehicle_label}
          </span>

          {/* Price */}
          <div className="min-w-[110px] flex-1">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.6px] text-foreground/55 dark:text-[#5A5A4A]">
              {t('vehicle_col_price')}
            </p>
            <TextField
              value={entry.price}
              onChange={(v) => update(entry.vehicle_format_id, 'price', v)}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              suffix={<span className="text-[11px] font-bold text-[#BBBBAA] dark:text-[#5A5A4A]">$</span>}
              disabled={!entry.is_active}
            />
          </div>

          {/* Duration */}
          <div className="min-w-[110px] flex-1">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.6px] text-foreground/55 dark:text-[#5A5A4A]">
              {t('vehicle_col_duration')}
            </p>
            <TextField
              value={String(entry.duration_min)}
              onChange={(v) => {
                const n = parseInt(v, 10);
                update(entry.vehicle_format_id, 'duration_min', isNaN(n) ? 1 : n);
              }}
              type="number"
              inputMode="numeric"
              min={1}
              step={5}
              suffix={<span className="text-[11px] font-bold text-[#BBBBAA] dark:text-[#5A5A4A]">min</span>}
              disabled={!entry.is_active}
            />
          </div>

          {/* Active toggle */}
          <button
            type="button"
            onClick={() => update(entry.vehicle_format_id, 'is_active', !entry.is_active)}
            aria-pressed={entry.is_active}
            className={`shrink-0 self-end rounded-lg px-3 py-2 text-[11px] font-bold transition-all ${
              entry.is_active
                ? 'bg-[#DDAF3B] text-[#001201] hover:opacity-85'
                : 'border border-[#FFF9EC] bg-white text-[#AAA] hover:border-[#DDAF3B]/40 dark:border-[#001A05] dark:bg-[#182214] dark:text-[#5A5A4A]'
            }`}
          >
            {entry.is_active ? t('vehicle_active') : '-'}
          </button>
        </div>
      ))}
    </div>
  );
}

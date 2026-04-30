'use client';

import { useTranslations } from 'next-intl';
import type { ServiceVehicleEntry, VehicleFormat } from './types';

interface Props {
  formats: VehicleFormat[];
  entries: ServiceVehicleEntry[];
  onChange: (entries: ServiceVehicleEntry[]) => void;
  searchQuery?: string;
  unavailableMessage?: string;
}

const inputClass =
  'w-full rounded-[6px] border border-[#D8D4C8] bg-[#F7F6F2] px-2.5 py-2 text-[13px] text-[#1A1A0A] outline-none transition-colors focus:border-[#C49A1E] focus:bg-white dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:focus:bg-[#182214]';

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
      <p className="rounded-[8px] border border-dashed border-[#D8D4C8] p-3 text-[13px] text-[#888] dark:border-[#243020] dark:text-[#5A5A4A]">
        {t('no_formats')}
      </p>
    );
  }

  if (visibleEntries.length === 0) {
    return (
      <p className="rounded-[8px] border border-dashed border-[#D8D4C8] p-3 text-[13px] text-[#888] dark:border-[#243020] dark:text-[#5A5A4A]">
        {unavailableMessage || t('format_not_in_list')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {visibleEntries.map((entry) => (
        <div
          key={entry.vehicle_format_id}
          className="flex items-center gap-2.5 rounded-[10px] bg-[#F7F6F0] px-3 py-2.5 dark:bg-[#0F1A0C]"
        >
          {/* Format label */}
          <span className="w-[76px] shrink-0 text-[11px] font-black tracking-[.06em] text-[#C49A1E] uppercase">
            {entry.vehicle_label}
          </span>

          {/* Price */}
          <div className="flex-1">
            <div className="mb-1 text-[8px] font-bold tracking-[.06em] text-[#888] uppercase dark:text-[#5A5A4A]">
              {t('vehicle_col_price')}
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={entry.price}
              onChange={(e) => update(entry.vehicle_format_id, 'price', e.target.value)}
              disabled={!entry.is_active}
              className={inputClass + ' disabled:opacity-40'}
            />
          </div>

          {/* Duration */}
          <div className="flex-1">
            <div className="mb-1 text-[8px] font-bold tracking-[.06em] text-[#888] uppercase dark:text-[#5A5A4A]">
              {t('vehicle_col_duration')}
            </div>
            <input
              type="number"
              min="1"
              step="1"
              value={entry.duration_min}
              onChange={(e) => { const n = parseInt(e.target.value, 10); update(entry.vehicle_format_id, 'duration_min', isNaN(n) ? 1 : n); }}
              disabled={!entry.is_active}
              className={inputClass + ' disabled:opacity-40'}
            />
          </div>

          {/* Staff */}
          <div className="w-[52px] shrink-0">
            <div className="mb-1 text-[8px] font-bold tracking-[.06em] text-[#888] uppercase dark:text-[#5A5A4A]">
              {t('vehicle_col_staff')}
            </div>
            <input
              type="number"
              min="0"
              step="1"
              value={entry.staff_required}
              onChange={(e) => { const n = parseInt(e.target.value, 10); update(entry.vehicle_format_id, 'staff_required', isNaN(n) ? 0 : n); }}
              disabled={!entry.is_active}
              className={inputClass + ' disabled:opacity-40'}
            />
          </div>

          {/* Active toggle */}
          <button
            type="button"
            onClick={() => update(entry.vehicle_format_id, 'is_active', !entry.is_active)}
            className={`mt-4 w-[52px] shrink-0 rounded-[6px] py-2 text-[11px] font-bold transition-all ${
              entry.is_active
                ? 'bg-[#C49A1E] text-[#0C1209]'
                : 'border border-[#D8D4C8] bg-[#F0EDE4] text-[#AAA] dark:border-[#243020] dark:bg-[#1A1A0A] dark:text-[#5A5A4A]'
            }`}
          >
            {entry.is_active ? t('vehicle_active') : '—'}
          </button>
        </div>
      ))}
    </div>
  );
}

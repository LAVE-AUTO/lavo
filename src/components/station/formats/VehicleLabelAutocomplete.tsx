'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';

const SUGGESTIONS_FR = [
  'Micro / Mini', 'Compact', 'Berline', 'Coupé', 'Décapotable',
  'Hatchback', 'Break', 'SUV', 'VUS', 'Crossover',
  'Minivan', 'Fourgonnette', 'Pickup', 'Camion léger',
  'Véhicule électrique', 'Véhicule hybride',
];

const SUGGESTIONS_EN = [
  'Micro / Mini', 'Compact', 'Sedan', 'Coupe', 'Convertible',
  'Hatchback', 'Wagon', 'SUV', 'Crossover', 'Minivan',
  'Van', 'Pickup Truck', 'Light Truck', 'Electric Vehicle', 'Hybrid',
];

/* Quick picks shown as chips on focus (most common) */
const QUICK_FR = ['Compact', 'Berline', 'SUV', 'Fourgonnette', 'Pickup'];
const QUICK_EN = ['Compact', 'Sedan', 'SUV', 'Van', 'Pickup Truck'];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  existingLabels: string[];
  locale: string;
  placeholder: string;
}

export function VehicleLabelAutocomplete({
  value, onChange, onEnter, existingLabels, locale, placeholder,
}: Props) {
  const t = useTranslations('station_services');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const all = locale === 'en' ? SUGGESTIONS_EN : SUGGESTIONS_FR;
  const quicks = locale === 'en' ? QUICK_EN : QUICK_FR;

  const filtered = value.trim().length >= 2
    ? all.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
    : [];

  const showDropdown = open && filtered.length > 0;
  const showChips = open && value.trim().length < 2;

  const pick = useCallback((label: string) => {
    onChange(label);
    setOpen(false);
    setHighlighted(-1);
    setTimeout(() => onEnter?.(), 50);
  }, [onChange, onEnter]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) {
      if (e.key === 'Enter') onEnter?.();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0) pick(filtered[highlighted]);
      else onEnter?.();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  /* Scroll highlighted item into view */
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const el = listRef.current.children[highlighted] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlighted]);

  const isUsed = (label: string) =>
    existingLabels.some((l) => l.toLowerCase() === label.toLowerCase());

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-[8px] border border-[#D8D4C8] bg-[#F7F6F2] px-3 py-2.5 transition-all focus-within:border-[#C49A1E] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:bg-[#0F1A0C] dark:focus-within:border-[#C49A1E] dark:focus-within:bg-[#182214]">
        {/* Car icon */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="shrink-0 text-[#BBBBAA] dark:text-[#4A4A3A]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 17H3a1 1 0 01-1-1v-5l2.5-6h13L20 11v5a1 1 0 01-1 1h-2M5 17a2 2 0 104 0m6 0a2 2 0 104 0M5 17h10" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={value}
          maxLength={100}
          required
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setHighlighted(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-[13px] text-[#1A1A0A] outline-none placeholder:text-[#BBBBAA] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A]"
        />
        {value && (
          <button type="button" onClick={() => { onChange(''); inputRef.current?.focus(); }}
            className="shrink-0 text-[#BBBBAA] transition-colors hover:text-[#888] dark:text-[#4A4A3A]" aria-label="Clear">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filtered dropdown */}
      {showDropdown && (
        <ul ref={listRef}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[200px] overflow-y-auto rounded-[10px] border border-[#E8E4DC] bg-white py-1 shadow-lg dark:border-[#243020] dark:bg-[#182214]">
          {filtered.map((s, i) => (
            <li key={s}>
              <button type="button" onMouseDown={() => pick(s)}
                className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] transition-colors ${
                  highlighted === i ? 'bg-[#FDF8EC] text-[#C49A1E] dark:bg-[#1A1A08]' : 'text-[#1A1A0A] dark:text-[#F0EDD4]'
                } ${isUsed(s) ? 'opacity-40' : 'hover:bg-[#F7F6F0] dark:hover:bg-[#0F1A0C]'}`}
              >
                <span className="font-medium">{s}</span>
                {isUsed(s) && (
                  <span className="text-[10px] text-[#BBBBAA] dark:text-[#4A4A3A]">
                    {t('label_added')}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Quick-pick chips on focus */}
      {showChips && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-[10px] border border-[#E8E4DC] bg-white p-3 shadow-lg dark:border-[#243020] dark:bg-[#182214]">
          <p className="mb-2 text-[10px] font-bold tracking-[.07em] text-[#BBBBAA] uppercase dark:text-[#4A4A3A]">
            {t('label_common_types')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quicks.map((q) => (
              <button
                key={q} type="button" onMouseDown={() => pick(q)}
                disabled={isUsed(q)}
                className={`rounded-[20px] border px-3 py-1 text-[12px] font-semibold transition-all ${
                  isUsed(q)
                    ? 'border-[#E0DCD0] text-[#CCCCCC] dark:border-[#1A2A14] dark:text-[#3A3A2A]'
                    : 'border-[#D8D4C8] text-[#5A5A4A] hover:border-[#C49A1E] hover:text-[#C49A1E] dark:border-[#243020] dark:text-[#9A9A8A]'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-[#CCCCBB] dark:text-[#3A3A2A]">
            {t('label_custom_name')}
          </p>
        </div>
      )}
    </div>
  );
}

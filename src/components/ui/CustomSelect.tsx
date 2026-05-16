'use client';

import { useState, useRef, useEffect, useId } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

/* ------------------------------------------------------------------ */
/* CustomSelect - single value, branded look                            */
/* ------------------------------------------------------------------ */

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function CustomSelect({ options, value, onChange, placeholder }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);
  const triggerLabel = selectedOption && value ? selectedOption.label : placeholder;
  const isActive = open || value !== '';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={[
          'w-full flex items-center justify-between px-3 sm:px-3.5 py-2.5 rounded-xl border text-[13.5px] sm:text-[14px] font-semibold transition-all duration-150 select-none cursor-pointer',
          isActive
            ? 'border-gold bg-gold/5 dark:bg-gold/10 text-[#1A1A1A] dark:text-white'
            : 'border-[#E0E0D0] dark:border-tab-inactive bg-[#F5F5EE] dark:bg-tab-inactive text-[#555] dark:text-[#C0C0B0]',
        ].join(' ')}
      >
        <span className={`truncate ${value ? 'text-[#1A1A1A] dark:text-white' : ''}`}>{triggerLabel}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 ml-1 transition-transform duration-200 ${open ? 'rotate-180 text-gold' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white dark:bg-dark-surface border border-[#E0E0D0] dark:border-tab-inactive rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 max-h-60 overflow-y-auto animate-fade-in"
        >
          {options.map((opt) => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                role="option"
                aria-selected={isSel}
                className={[
                  'w-full flex items-center justify-between px-3.5 py-2.5 text-[14px] font-semibold text-left transition-colors duration-100 cursor-pointer',
                  isSel
                    ? 'text-gold bg-gold/5 dark:bg-gold/10'
                    : 'text-[#1A1A1A] dark:text-white hover:bg-[#F5F5EE] dark:hover:bg-tab-inactive',
                ].join(' ')}
              >
                <span>{opt.label}</span>
                {isSel && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-gold">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CustomMultiSelect - same visual language with checkbox markers       */
/* ------------------------------------------------------------------ */

interface CustomMultiSelectProps {
  options: SelectOption[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder: string;
}

export function CustomMultiSelect({ options, selected, onToggle, placeholder }: CustomMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectedLabels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  const triggerLabel =
    selectedLabels.length === 0 ? placeholder
    : selectedLabels.length === 1 ? selectedLabels[0]
    : `${selectedLabels[0]} +${selectedLabels.length - 1}`;

  const isActive = open || selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={[
          'w-full flex items-center justify-between px-3 sm:px-3.5 py-2.5 rounded-xl border text-[13.5px] sm:text-[14px] font-semibold transition-all duration-150 select-none cursor-pointer',
          isActive
            ? 'border-gold bg-gold/5 dark:bg-gold/10 text-[#1A1A1A] dark:text-white'
            : 'border-[#E0E0D0] dark:border-tab-inactive bg-[#F5F5EE] dark:bg-tab-inactive text-[#555] dark:text-[#C0C0B0]',
        ].join(' ')}
      >
        <span className={`truncate ${selected.length > 0 ? 'text-[#1A1A1A] dark:text-white' : ''}`}>{triggerLabel}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 ml-1 transition-transform duration-200 ${open ? 'rotate-180 text-gold' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && options.length === 0 && (
        <div
          id={listboxId}
          className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white dark:bg-dark-surface border border-[#E0E0D0] dark:border-tab-inactive rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 px-3.5 py-3 text-[13px] text-[#555] dark:text-[#B0B0A0] animate-fade-in"
        >
          -
        </div>
      )}

      {open && options.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white dark:bg-dark-surface border border-[#E0E0D0] dark:border-tab-inactive rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 max-h-52 overflow-y-auto animate-fade-in"
        >
          {options.map((opt) => {
            const isSel = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggle(opt.value)}
                role="option"
                aria-selected={isSel}
                className={[
                  'w-full flex items-center justify-between px-3.5 py-2.5 text-[14px] font-semibold text-left transition-colors duration-100 cursor-pointer',
                  isSel
                    ? 'text-gold bg-gold/5 dark:bg-gold/10'
                    : 'text-[#1A1A1A] dark:text-white hover:bg-[#F5F5EE] dark:hover:bg-tab-inactive',
                ].join(' ')}
              >
                <span>{opt.label}</span>
                {isSel && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-gold">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

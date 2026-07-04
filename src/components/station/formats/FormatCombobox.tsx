'use client';

import { useEffect, useRef, useState, useId } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Premium suggestions offered in the dropdown. */
  suggestions: string[];
  /** Labels already in the catalogue — shown but not selectable. */
  takenLabels?: string[];
  placeholder: string;
  takenHint: string;
  invalid?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
}

/**
 * Editable combobox: the admin can pick a premium suggestion OR type a custom
 * format name. Matches the platform charte (rounded-xl, gold accent, animated
 * chevron, shadowed panel). Unlike a native <select>, free text is always
 * allowed and there is no unselectable placeholder option.
 */
export function FormatCombobox({
  value,
  onChange,
  suggestions,
  takenLabels = [],
  placeholder,
  takenHint,
  invalid = false,
  autoFocus = false,
  maxLength = 100,
}: Props) {
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

  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const query = norm(value);
  const filtered = query
    ? suggestions.filter((s) => norm(s).includes(query))
    : suggestions;
  const takenSet = new Set(takenLabels.map(norm));

  return (
    <div ref={ref} className="relative">
      <div
        className={[
          'flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all duration-150',
          invalid
            ? 'border-Hurryline-error focus-within:border-Hurryline-error'
            : value || open
              ? 'border-gold bg-gold/5 dark:bg-gold/10'
              : 'border-[#E0E0D0] bg-[#FFF9EC] dark:border-border dark:bg-tab-inactive focus-within:border-gold',
        ].join(' ')}
      >
        <input
          type="text"
          value={value}
          autoFocus={autoFocus}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-[#001201] outline-none placeholder:font-normal placeholder:text-[#AAA] dark:text-white dark:placeholder:text-[#B0BFB1]"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Suggestions"
          className="shrink-0 text-foreground/55 dark:text-[#B0BFB1]"
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
            className={`transition-transform duration-200 ${open ? 'rotate-180 text-gold' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {open && filtered.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-56 overflow-y-auto rounded-xl border border-[#E0E0D0] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-fade-in dark:border-border dark:bg-surface dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        >
          {filtered.map((opt) => {
            const taken = takenSet.has(norm(opt));
            const selected = norm(opt) === query;
            return (
              <button
                key={opt}
                type="button"
                disabled={taken}
                onClick={() => { onChange(opt); setOpen(false); }}
                role="option"
                aria-selected={selected}
                className={[
                  'flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[14px] font-semibold transition-colors duration-100',
                  taken
                    ? 'cursor-not-allowed text-[#AAA] dark:text-[#5A5A4A]'
                    : selected
                      ? 'bg-gold/5 text-gold dark:bg-gold/10'
                      : 'text-[#001201] hover:bg-[#FFF9EC] dark:text-white dark:hover:bg-tab-inactive',
                ].join(' ')}
              >
                <span>{opt}</span>
                {taken && <span className="ml-2 shrink-0 text-[11px] font-medium">{takenHint}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

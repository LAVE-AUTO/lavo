'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ChangeEvent,
} from 'react';
import {
  getCountries,
  getCountryCallingCode,
  type Country,
} from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import labels from 'react-phone-number-input/locale/en.json';

/* ------------------------------------------------------------------ */
/*  Country select dropdown                                            */
/* ------------------------------------------------------------------ */

function CountrySelect({
  value,
  onChange,
  hasError,
}: {
  value: Country;
  onChange: (country: Country) => void;
  hasError: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const countries = useMemo(() => {
    return getCountries().map((code) => ({
      code,
      name: (labels as Record<string, string>)[code] || code,
      dial: `+${getCountryCallingCode(code)}`,
    }));
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Auto-focus search when dropdown opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  const toggle = useCallback(() => {
    setIsOpen((v) => !v);
    setSearch('');
  }, []);

  const handleSelect = useCallback(
    (code: Country) => {
      onChange(code);
      setIsOpen(false);
      setSearch('');
    },
    [onChange],
  );

  const dialCode = `+${getCountryCallingCode(value)}`;
  const FlagIcon = flags[value];

  const filtered = useMemo(() => {
    if (!search) return countries;
    const q = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [countries, search]);

  const triggerClasses = [
    'flex items-center gap-1.5 px-3 py-3 bg-white dark:bg-surface border-[1.5px] rounded-lg',
    'outline-none transition-all duration-150 whitespace-nowrap',
    hasError
      ? 'border-Hurryline-error bg-[#FFF8F7] dark:bg-[#2A1A18]'
      : 'border-[#CCCCCC] dark:border-border focus:border-gold dark:focus:border-gold focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.18)] dark:focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.15)]',
  ].join(' ');

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        className={triggerClasses}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select country"
      >
        <span className="w-5 h-4 inline-flex items-center">
          {FlagIcon && <FlagIcon title="" />}
        </span>
        <span className="text-[15px] font-medium text-[#001201] dark:text-white">
          {dialCode}
        </span>
        <svg
          className={`w-2.5 h-2.5 text-foreground/55 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white dark:bg-surface border border-[#CCCCCC] dark:border-border rounded-lg shadow-lg overflow-hidden">
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#EEEEEE] dark:border-border">
            <svg
              className="w-3.5 h-3.5 text-foreground/55 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-[14px] text-[#001201] dark:text-white placeholder-[#AAAAAA] outline-none"
              placeholder="Search country..."
              autoComplete="off"
            />
          </div>

          {/* Country list */}
          <ul className="max-h-56 overflow-y-auto" role="listbox">
            {filtered.map((c) => {
              const selected = c.code === value;
              const ItemFlag = flags[c.code];
              return (
                <li key={c.code} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => handleSelect(c.code)}
                    className={[
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                      selected
                        ? 'bg-[#F5F0E0] dark:bg-surface font-semibold'
                        : 'hover:bg-[#F8F8F6] dark:hover:bg-dark-surface',
                    ].join(' ')}
                  >
                    <span className="w-5 h-4 inline-flex items-center shrink-0">
                      {ItemFlag && <ItemFlag title="" />}
                    </span>
                    <span className="flex-1 text-[14px] text-[#001201] dark:text-white truncate">
                      {c.name}
                    </span>
                    <span className="text-[13px] text-foreground/55 dark:text-[#999] tabular-nums">
                      {c.dial}
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-[13px] text-foreground/55 text-center">
                No results
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PhoneInput - country select + local number input, side by side     */
/* ------------------------------------------------------------------ */

export interface PhoneInputValue {
  country: Country;
  localNumber: string;
}

interface PhoneInputProps {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: PhoneInputValue;
  onChange: (value: PhoneInputValue) => void;
  error?: string;
}

export function PhoneInput({
  label,
  required,
  placeholder,
  value,
  onChange,
  error,
}: PhoneInputProps) {
  const handleCountryChange = useCallback(
    (country: Country) => {
      onChange({ ...value, country });
    },
    [value, onChange],
  );

  const handleNumberChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, localNumber: e.target.value });
    },
    [value, onChange],
  );

  const inputClasses = [
    'w-full px-4 py-3 bg-white dark:bg-surface border-[1.5px] rounded-lg',
    'text-[16px] text-[#001201] dark:text-white placeholder-[#AAAAAA] dark:placeholder-[#4A5A46]',
    'outline-none transition-all duration-150',
    error
      ? 'border-Hurryline-error bg-[#FFF8F7] dark:bg-[#2A1A18] focus:shadow-[0_0_0_3px_rgba(232,71,42,0.2)]'
      : 'border-[#CCCCCC] dark:border-border focus:border-gold dark:focus:border-gold focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.18)] dark:focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.15)]',
  ].join(' ');

  return (
    <div className="mb-4">
      <label className="block text-[15px] font-semibold text-[#001201] dark:text-white mb-1.5 tracking-wide">
        {label}
        {required && <span className="text-gold ml-0.5">*</span>}
      </label>

      <div className="flex gap-2">
        <CountrySelect
          value={value.country}
          onChange={handleCountryChange}
          hasError={!!error}
        />
        <input
          type="tel"
          value={value.localNumber}
          onChange={handleNumberChange}
          placeholder={placeholder}
          className={inputClasses}
          autoComplete="tel-national"
        />
      </div>

      {error && (
        <p className="mt-1.5 text-[13px] font-medium text-Hurryline-error flex items-center gap-1">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      )}
    </div>
  );
}

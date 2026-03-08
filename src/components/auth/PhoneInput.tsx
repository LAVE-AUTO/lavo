'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ElementType,
} from 'react';
import PhoneInputLib, {
  getCountryCallingCode,
  type Value,
  type Country,
} from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

/* ------------------------------------------------------------------ */
/*  Custom country select (replaces the ugly native <select>)          */
/* ------------------------------------------------------------------ */

interface CountryOption {
  value?: string;
  label?: string;
  divider?: boolean;
}

interface CountrySelectProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  options: CountryOption[];
  iconComponent: ElementType;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

function LavorCountrySelect({
  value,
  onChange,
  options,
  iconComponent: Icon,
}: CountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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
    (code: string | undefined) => {
      onChange(code);
      setIsOpen(false);
      setSearch('');
    },
    [onChange]
  );

  const dialCode = value ? `+${getCountryCallingCode(value as Country)}` : '';

  const filtered = useMemo(() => {
    if (!search) return options.filter((o) => !o.divider);
    const q = search.toLowerCase();
    return options.filter((o) => {
      if (o.divider || !o.value) return false;
      const labelMatch = (o.label || '').toLowerCase().includes(q);
      let dialMatch = false;
      try {
        dialMatch = `+${getCountryCallingCode(o.value as Country)}`.includes(q);
      } catch { /* skip */ }
      return labelMatch || dialMatch || o.value.toLowerCase().includes(q);
    });
  }, [options, search]);

  return (
    <div className="lavo-country-select" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={toggle}
        className="lavo-country-select__trigger"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select country"
      >
        <span className="lavo-country-select__flag">
          {value ? <Icon country={value} label="" /> : <Icon label="International" />}
        </span>
        <span className="lavo-country-select__dial">{dialCode}</span>
        <svg
          className={`lavo-country-select__chevron ${isOpen ? 'lavo-country-select__chevron--open' : ''}`}
          width="10"
          height="10"
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

      {/* Dropdown panel */}
      {isOpen && (
        <div className="lavo-country-select__dropdown">
          {/* Search bar */}
          <div className="lavo-country-select__search-wrap">
            <svg
              className="lavo-country-select__search-icon"
              width="14"
              height="14"
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
              className="lavo-country-select__search"
              placeholder="Search country..."
              autoComplete="off"
            />
          </div>

          {/* Country list */}
          <ul ref={listRef} className="lavo-country-select__list" role="listbox">
            {filtered.map((opt) => {
              if (!opt.value) return null;
              let code = '';
              try {
                code = `+${getCountryCallingCode(opt.value as Country)}`;
              } catch { /* skip */ }
              const selected = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`lavo-country-select__option ${selected ? 'lavo-country-select__option--selected' : ''}`}
                  >
                    <span className="lavo-country-select__option-flag">
                      <Icon country={opt.value} label="" />
                    </span>
                    <span className="lavo-country-select__option-label">{opt.label}</span>
                    <span className="lavo-country-select__option-dial">{code}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="lavo-country-select__empty">No results</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PhoneInput wrapper                                                 */
/* ------------------------------------------------------------------ */

interface PhoneInputProps {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (fullPhone: string) => void;
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
  return (
    <div className="mb-4">
      <label className="block text-[15px] font-semibold text-[#1A1A1A] dark:text-white mb-1.5 tracking-wide">
        {label}
        {required && <span className="text-gold ml-0.5">*</span>}
      </label>

      <PhoneInputLib
        international
        defaultCountry="CA"
        placeholder={placeholder}
        value={(value || undefined) as Value | undefined}
        onChange={(val) => onChange(val || '')}
        countrySelectComponent={LavorCountrySelect}
        className={[
          'lavo-phone-input',
          error ? 'lavo-phone-input--error' : '',
        ].join(' ')}
      />

      {error && (
        <p className="mt-1.5 text-[13px] font-medium text-lavo-error flex items-center gap-1">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      )}
    </div>
  );
}

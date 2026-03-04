'use client';

import { type ChangeEvent } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-lavo-muted"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/**
 * Controlled search bar for the station list.
 * Calls onChange on every keystroke — filtering is handled by the parent.
 */
export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="flex items-center gap-2.5 px-4 py-3 bg-white dark:bg-dark-card border border-[#DDDDCC] dark:border-[#3A4A36] rounded-[10px] focus-within:border-gold dark:focus-within:border-gold transition-colors duration-150">
      <SearchIcon />
      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[14px] text-[#1A1A1A] dark:text-white placeholder-lavo-muted outline-none"
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-lavo-muted hover:text-[#1A1A1A] dark:hover:text-white transition-colors"
          aria-label="Effacer la recherche"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

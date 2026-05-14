'use client';

import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';

const CANADIAN_CITIES = [
  // Quebec
  'Montreal', 'Quebec', 'Laval', 'Longueuil', 'Sherbrooke', 'Saguenay',
  'Trois-Rivieres', 'Terrebonne', 'Saint-Jean-sur-Richelieu', 'Repentigny',
  'Brossard', 'Drummondville', 'Saint-Jerome', 'Granby', 'Blainville',
  'Mirabel', 'Levis', 'Joliette', 'Gatineau', 'Vaudreuil-Dorion',
  'Boucherville', 'Dollard-des-Ormeaux', 'Mascouche', 'Rimouski', 'Chateauguay',
  // Ontario
  'Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton',
  'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor',
  'Richmond Hill', 'Ajax', 'Oakville', 'Whitby', 'Burlington',
  'Sudbury', 'Thunder Bay', 'Barrie', 'Guelph', 'Cambridge',
  'Kingston', 'Oshawa', 'Pickering', 'St. Catharines',
  // British Columbia
  'Vancouver', 'Surrey', 'Burnaby', 'Richmond', 'Kelowna',
  'Abbotsford', 'Coquitlam', 'Langley', 'Saanich', 'Delta',
  'Kamloops', 'Prince George', 'Chilliwack', 'Nanaimo', 'Victoria',
  // Alberta
  'Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert',
  'Medicine Hat', 'Grande Prairie', 'Airdrie', 'Spruce Grove', 'Cochrane',
  // Manitoba
  'Winnipeg', 'Brandon', 'Steinbach', 'Portage la Prairie',
  // Saskatchewan
  'Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw',
  // Nova Scotia
  'Halifax', 'Dartmouth', 'Sydney', 'Truro',
  // New Brunswick
  'Moncton', 'Saint John', 'Fredericton', 'Dieppe',
  // Newfoundland
  "St. John's", 'Mount Pearl', 'Corner Brook',
  // PEI
  'Charlottetown', 'Summerside',
  // Territories
  'Yellowknife', 'Whitehorse', 'Iqaluit',
];

interface CityAutocompleteProps {
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

const PIN_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

/**
 * City text input with Canadian city autocomplete suggestions.
 * Shows matches from CANADIAN_CITIES when the user types 2+ characters.
 * Supports keyboard navigation (arrow keys, Enter, Escape).
 */
export function CityAutocomplete({ label, required, value, error, onChange }: CityAutocompleteProps) {
  const t = useTranslations('station_apply');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen]           = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = 'field-city';
  const listId  = `${inputId}-list`;
  const errorId = `${inputId}-error`;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    onChange(val);
    if (val.length >= 2) {
      const q = val.toLowerCase();
      const matches = CANADIAN_CITIES.filter((c) => c.toLowerCase().startsWith(q)).slice(0, 6);
      setSuggestions(matches);
      setIsOpen(matches.length > 0);
      setActiveIdx(-1);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }

  function select(city: string) {
    onChange(city);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIdx(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      select(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="mb-4 relative" ref={containerRef}>
      <label
        htmlFor={inputId}
        className="block text-[15px] font-semibold text-[#1A1A1A] dark:text-white mb-1.5 tracking-wide"
      >
        {label}
        {required && <span className="text-gold ml-0.5">*</span>}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={isOpen ? listId : undefined}
          aria-activedescendant={activeIdx >= 0 ? `${listId}-opt-${activeIdx}` : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          value={value}
          placeholder={t('city_placeholder')}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          className={[
            'w-full pl-4 pr-10 py-3 bg-white dark:bg-dark-card border-[1.5px] rounded-lg',
            'text-[16px] text-[#1A1A1A] dark:text-white placeholder-[#AAAAAA] dark:placeholder-[#4A5A46]',
            'outline-none transition-all duration-150',
            error
              ? 'border-Hurryline-error bg-[#FFF8F7] dark:bg-[#2A1A18]'
              : 'border-[#CCCCCC] dark:border-tab-inactive focus:border-gold dark:focus:border-gold focus:shadow-[0_0_0_3px_rgba(196,154,30,0.18)] dark:focus:shadow-[0_0_0_3px_rgba(196,154,30,0.15)]',
          ].join(' ')}
        />
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#CCCCCC] dark:text-[#4A5A46]">
          {PIN_ICON}
        </span>
      </div>

      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-white dark:bg-dark-card border border-[#E0E0E0] dark:border-[#2A3826] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          {suggestions.map((city, i) => (
            <li
              key={city}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={() => select(city)}
              className={[
                'flex items-center gap-3 px-4 py-2.5 text-[15px] cursor-pointer transition-colors duration-100',
                i === activeIdx
                  ? 'bg-gold/10 text-gold'
                  : 'text-[#1A1A1A] dark:text-white hover:bg-[#F8F8F8] dark:hover:bg-dark-surface',
              ].join(' ')}
            >
              <span className={i === activeIdx ? 'text-gold' : 'text-[#CCCCCC] dark:text-[#4A5A46]'}>
                {PIN_ICON}
              </span>
              {city}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-[13px] font-medium text-Hurryline-error flex items-center gap-1">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      )}
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';

const CANADIAN_CITIES = [
  'Montreal', 'Quebec', 'Laval', 'Longueuil', 'Sherbrooke', 'Saguenay',
  'Trois-Rivieres', 'Terrebonne', 'Saint-Jean-sur-Richelieu', 'Repentigny',
  'Brossard', 'Drummondville', 'Saint-Jerome', 'Granby', 'Blainville',
  'Mirabel', 'Levis', 'Joliette', 'Gatineau', 'Vaudreuil-Dorion',
  'Boucherville', 'Dollard-des-Ormeaux', 'Mascouche', 'Rimouski', 'Chateauguay',
  'Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton',
  'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor',
  'Richmond Hill', 'Ajax', 'Oakville', 'Whitby', 'Burlington',
  'Sudbury', 'Thunder Bay', 'Barrie', 'Guelph', 'Cambridge',
  'Kingston', 'Oshawa', 'Pickering', 'St. Catharines',
  'Vancouver', 'Surrey', 'Burnaby', 'Richmond', 'Kelowna',
  'Abbotsford', 'Coquitlam', 'Langley', 'Saanich', 'Delta',
  'Kamloops', 'Prince George', 'Chilliwack', 'Nanaimo', 'Victoria',
  'Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert',
  'Medicine Hat', 'Grande Prairie', 'Airdrie', 'Spruce Grove', 'Cochrane',
  'Winnipeg', 'Brandon', 'Steinbach', 'Portage la Prairie',
  'Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw',
  'Halifax', 'Dartmouth', 'Sydney', 'Truro',
  'Moncton', 'Saint John', 'Fredericton', 'Dieppe',
  "St. John's", 'Mount Pearl', 'Corner Brook',
  'Charlottetown', 'Summerside', 'Yellowknife', 'Whitehorse', 'Iqaluit',
];

const inputBase =
  'w-full rounded-lg border bg-transparent px-3 py-2 text-[13px] text-[#1A1A0A] outline-none transition-all dark:text-[#F0EDD4]';
const inputIdle =
  'border-[#D8D4C8] focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.10)] dark:border-[#243020] dark:focus:border-[#C49A1E]';
const inputError = 'border-red-400 focus:border-red-400';

interface Props {
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  placeholder: string;
  onChange: (value: string) => void;
}

export function AdminCityInput({ label, required, value, error, placeholder, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen]           = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = 'admin-field-city';
  const listId  = `${inputId}-list`;

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
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(suggestions[activeIdx]); }
    else if (e.key === 'Escape') setIsOpen(false);
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative flex flex-col gap-1.5" ref={containerRef}>
      <label htmlFor={inputId} className="text-[12px] font-bold text-[#555] dark:text-[#9A9A8A]">
        {label}{required && <span className="ml-0.5 text-[#C49A1E]">*</span>}
      </label>
      <input
        id={inputId} type="text" autoComplete="off" value={value} placeholder={placeholder}
        role="combobox" aria-expanded={isOpen} aria-autocomplete="list"
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={activeIdx >= 0 ? `${listId}-opt-${activeIdx}` : undefined}
        onChange={handleChange} onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
        className={`${inputBase} ${error ? inputError : inputIdle}`}
      />
      {isOpen && (
        <ul id={listId} role="listbox"
          className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-[#E8E4DC] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.10)] dark:border-[#1E2E18] dark:bg-[#0F1A0C]">
          {suggestions.map((city, i) => (
            <li key={city} id={`${listId}-opt-${i}`} role="option" aria-selected={i === activeIdx}
              onMouseDown={() => select(city)}
              className={[
                'cursor-pointer px-3 py-2 text-[12px] transition-colors',
                i === activeIdx ? 'bg-[#C49A1E]/12 text-[#C49A1E]' : 'text-[#1A1A0A] hover:bg-[#F5F3EE] dark:text-[#F0EDD4] dark:hover:bg-[#1A2A14]',
              ].join(' ')}>
              {city}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-[11px] font-semibold text-red-500">{error}</p>}
    </div>
  );
}

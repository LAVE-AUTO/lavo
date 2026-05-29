'use client';

import type { ReactNode, InputHTMLAttributes } from 'react';

type Props = {
  value: string;
  onChange: (next: string) => void;
  prefixIcon?: ReactNode;
  prefixBadge?: string;
  suffix?: ReactNode;
  invalid?: boolean;
  inputClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'prefix'>;

export function TextField({
  value,
  onChange,
  prefixIcon,
  prefixBadge,
  suffix,
  invalid = false,
  disabled = false,
  inputClassName = '',
  type = 'text',
  ...rest
}: Props) {
  // For type="number", drop `step` from the HTML attribute: with `min` set, the
  // browser enforces a step grid anchored on `min` (e.g. min=1, step=5 → only
  // 1, 6, 11… are valid → "60" is rejected). Free typing + visible bounds is the
  // expected merchant UX. The same prop is still useful for stepper components
  // that read it for their +/- buttons (NumberStepper).
  const inputProps = type === 'number' ? { ...rest, step: undefined } : rest;
  const borderColor = invalid
    ? 'border-[#EF4444]/60 focus-within:border-[#EF4444] focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
    : 'border-[#FFF9EC] hover:border-[#D0C8B0] focus-within:border-[#DDAF3B] focus-within:shadow-[0_0_0_3px_rgba(221, 175, 59,0.12)] dark:border-[#001A05] dark:hover:border-[#2E3C2A]';

  const disabledClasses = disabled
    ? 'cursor-not-allowed border-[#FFF9EC] opacity-60 dark:border-[#1A2A14]'
    : borderColor;

  return (
    <div
      className={`group relative flex items-stretch overflow-hidden rounded-xl border bg-white transition-all duration-150 dark:bg-dark-bg ${disabledClasses}`}
    >
      {prefixIcon && (
        <span
          className="flex shrink-0 items-center pl-3 text-[#AAAAAA] transition-colors group-focus-within:text-[#DDAF3B] dark:text-[#5A5A4A]"
          aria-hidden="true"
        >
          {prefixIcon}
        </span>
      )}
      {prefixBadge && (
        <span className="flex shrink-0 select-none items-center border-r border-[#F0EDE0] bg-[#FAF8F2] px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-foreground/55 dark:border-[#1A2A14] dark:bg-[#0A1208] dark:text-[#B0BFB1]">
          {prefixBadge}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`flex-1 bg-transparent px-3 py-2.5 text-[13px] text-[#001201] outline-none placeholder:text-[#BBBBAA] disabled:cursor-not-allowed dark:text-[#FFF9EC] dark:placeholder:text-[#4A4A3A] ${inputClassName}`}
        {...inputProps}
      />
      {suffix && (
        <span className="flex shrink-0 items-center pr-3" aria-hidden="true">
          {suffix}
        </span>
      )}
    </div>
  );
}

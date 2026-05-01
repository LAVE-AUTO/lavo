'use client';

import type { TextareaHTMLAttributes } from 'react';

type Props = {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  showCounter?: boolean;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>;

export function Textarea({
  value,
  onChange,
  invalid = false,
  showCounter = false,
  disabled = false,
  rows = 3,
  maxLength,
  ...rest
}: Props) {
  const borderColor = invalid
    ? 'border-[#EF4444]/60 focus-within:border-[#EF4444] focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
    : 'border-[#E0DCD0] hover:border-[#D0C8B0] focus-within:border-[#C49A1E] focus-within:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:border-[#243020] dark:hover:border-[#2E3C2A]';

  const disabledClasses = disabled
    ? 'cursor-not-allowed border-[#E8E4DC] opacity-60 dark:border-[#1A2A14]'
    : borderColor;

  const showCount = showCounter && typeof maxLength === 'number';
  const remaining = showCount ? Math.max(0, (maxLength as number) - value.length) : 0;
  const overUsage = showCount && value.length / (maxLength as number) > 0.85;

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-white transition-all duration-150 dark:bg-[#0F1A0C] ${disabledClasses}`}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        className="resize-none bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-[#1A1A0A] outline-none placeholder:text-[#BBBBAA] disabled:cursor-not-allowed dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A]"
        {...rest}
      />
      {showCount && (
        <div className="flex justify-end border-t border-[#F0EDE0] px-3 py-1 dark:border-[#1A2A14]">
          <span
            className={`font-mono text-[10px] font-semibold tabular-nums transition-colors ${
              overUsage ? 'text-[#C49A1E]' : 'text-[#BBBBAA] dark:text-[#5A5A4A]'
            }`}
            aria-live="polite"
          >
            {value.length}/{maxLength} · {remaining}
          </span>
        </div>
      )}
    </div>
  );
}

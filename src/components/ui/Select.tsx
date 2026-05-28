'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Label displayed above the select. */
  label?: string;
  /** Placeholder option shown when no value is selected. */
  placeholder?: string;
  /** Error message displayed below the select. Adds red border styling. */
  error?: string;
}

/**
 * Branded select with custom chevron, optional label, placeholder, and error state.
 * Forwards its ref to the underlying <select> element.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, placeholder, error, className = '', id, children, ...props },
  ref
) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={selectId}
          className="text-[13px] font-medium text-foreground/70 dark:text-Hurryline-muted"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={[
            'w-full appearance-none rounded-[10px] border bg-white dark:bg-surface',
            'text-[#1A1A1A] dark:text-white px-3 py-2.5 text-[15px]',
            'outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-colors',
            'pr-9 cursor-pointer',
            error
              ? 'border-Hurryline-error focus:ring-Hurryline-error/30'
              : 'border-[#CCCCCC] dark:border-border',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        {/* Custom chevron */}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-Hurryline-muted">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      {error && (
        <p className="text-[12px] text-Hurryline-error font-medium">{error}</p>
      )}
    </div>
  );
});

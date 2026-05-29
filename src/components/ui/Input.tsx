'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label displayed above the input. */
  label?: string;
  /** Error message displayed below the input. Adds red border styling. */
  error?: string;
  /** Icon rendered on the left side inside the input. */
  leftIcon?: ReactNode;
  /** Icon rendered on the right side inside the input. */
  rightIcon?: ReactNode;
}

/**
 * Branded text input with optional label, error state, and icon slots.
 * Forwards its ref to the underlying <input> element.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, leftIcon, rightIcon, className = '', id, ...props },
  ref
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[13px] font-medium text-foreground/70 dark:text-Hurryline-muted"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 flex items-center text-Hurryline-muted pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            'w-full rounded-[10px] border bg-white dark:bg-surface text-[#001201] dark:text-white',
            'px-3 py-2.5 text-[15px] placeholder:text-Hurryline-muted',
            'outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-colors',
            error
              ? 'border-Hurryline-error focus:ring-Hurryline-error/30'
              : 'border-[#CCCCCC] dark:border-border',
            leftIcon ? 'pl-9' : '',
            rightIcon ? 'pr-9' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 flex items-center text-Hurryline-muted">
            {rightIcon}
          </span>
        )}
      </div>
      {error && (
        <p className="text-[12px] text-Hurryline-error font-medium">{error}</p>
      )}
    </div>
  );
});

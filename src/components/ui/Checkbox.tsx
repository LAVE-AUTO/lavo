'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Optional label rendered inline next to the checkbox. */
  label?: ReactNode;
}

/**
 * Branded checkbox with gold accent and optional inline label.
 * Forwards its ref to the underlying <input> element.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, className = '', id, ...props }, ref) {
    const checkboxId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    if (!label) {
      return (
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className={['accent-gold w-4 h-4 rounded cursor-pointer', className]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
      );
    }

    return (
      <label
        htmlFor={checkboxId}
        className="flex items-center gap-2 cursor-pointer select-none"
      >
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className={['accent-gold w-4 h-4 rounded shrink-0', className]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        <span className="text-[14px] text-[#333] dark:text-white">{label}</span>
      </label>
    );
  }
);

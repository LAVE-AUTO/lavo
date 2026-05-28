'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  error?: string;
  rightIcon?: ReactNode;
}

/**
 * Labeled form input with optional right icon and inline error message.
 *
 * @param label    - Field label text
 * @param required - Shows a gold asterisk when true
 * @param error    - Error message displayed below the input
 * @param rightIcon - Node rendered on the right side (e.g. eye toggle)
 */
export function FormField({
  label,
  required,
  error,
  rightIcon,
  id,
  className,
  ...inputProps
}: FormFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="mb-4">
      <label
        htmlFor={inputId}
        className="block text-[15px] font-semibold text-[#001201] dark:text-white mb-1.5 tracking-wide"
      >
        {label}
        {required && <span className="text-gold ml-0.5">*</span>}
      </label>

      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          className={[
            'w-full px-4 py-3 bg-white dark:bg-surface border-[1.5px] rounded-lg',
            'text-[16px] text-[#001201] dark:text-white placeholder-[#AAAAAA] dark:placeholder-[#B0BFB1]',
            'outline-none transition-all duration-150',
            error
              ? 'border-Hurryline-error bg-[#FFF9EC] dark:bg-[#391C01] focus:shadow-[0_0_0_3px_rgba(232,71,42,0.2)]'
              : 'border-[#CCCCCC] dark:border-border focus:border-gold dark:focus:border-gold focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.18)] dark:focus:shadow-[0_0_0_3px_rgba(221, 175, 59,0.15)]',
            rightIcon ? 'pr-11' : '',
            className ?? '',
          ]
            .join(' ')
            .trim()}
          {...inputProps}
        />
        {rightIcon && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/55">
            {rightIcon}
          </span>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-[13px] font-medium text-Hurryline-error flex items-center gap-1">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      )}
    </div>
  );
}

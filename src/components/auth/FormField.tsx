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

  return (
    <div className="mb-4">
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
          className={[
            'w-full px-4 py-3 bg-white dark:bg-[#1E2A1A] border-[1.5px] rounded-lg',
            'text-[16px] text-[#1A1A1A] dark:text-white placeholder-[#AAAAAA] dark:placeholder-[#4A5A46]',
            'outline-none transition-all duration-150',
            error
              ? 'border-lavo-error bg-[#FFF8F7] dark:bg-[#2A1A18] focus:shadow-[0_0_0_3px_rgba(232,71,42,0.2)]'
              : 'border-[#CCCCCC] dark:border-[#3A4A36] focus:border-gold dark:focus:border-gold focus:shadow-[0_0_0_3px_rgba(196,154,30,0.18)] dark:focus:shadow-[0_0_0_3px_rgba(196,154,30,0.15)]',
            rightIcon ? 'pr-11' : '',
            className ?? '',
          ]
            .join(' ')
            .trim()}
          {...inputProps}
        />
        {rightIcon && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#888]">
            {rightIcon}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-[13px] font-medium text-lavo-error flex items-center gap-1">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      )}
    </div>
  );
}

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
        className="block text-[13px] font-semibold text-[#1A1A1A] dark:text-white mb-1.5 tracking-wide"
      >
        {label}
        {required && <span className="text-gold ml-0.5">*</span>}
      </label>

      <div className="relative">
        <input
          id={inputId}
          className={[
            'w-full px-4 py-3 bg-white border-[1.5px] rounded-lg',
            'text-[14px] text-[#1A1A1A] placeholder-[#AAAAAA]',
            'outline-none transition-colors duration-150',
            error
              ? 'border-lavo-error bg-[#FFF8F7]'
              : 'border-[#CCCCCC] focus:border-gold',
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
        <p className="mt-1.5 text-[12px] font-medium text-lavo-error flex items-center gap-1">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      )}
    </div>
  );
}

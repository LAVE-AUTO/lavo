'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Label displayed above the textarea. */
  label?: string;
  /** Error message displayed below the textarea. Adds red border styling. */
  error?: string;
}

/**
 * Branded textarea with optional label and error state.
 * Forwards its ref to the underlying <textarea> element.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, className = '', id, ...props }, ref) {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-[13px] font-medium text-foreground/70 dark:text-Hurryline-muted"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={[
            'w-full rounded-[10px] border bg-white dark:bg-surface text-[#1A1A1A] dark:text-white',
            'px-3 py-2.5 text-[15px] placeholder:text-Hurryline-muted resize-y min-h-[100px]',
            'outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-colors',
            error
              ? 'border-Hurryline-error focus:ring-Hurryline-error/30'
              : 'border-[#CCCCCC] dark:border-border',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {error && (
          <p className="text-[12px] text-Hurryline-error font-medium">{error}</p>
        )}
      </div>
    );
  }
);

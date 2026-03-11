'use client';

import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button while true. */
  loading?: boolean;
  /** Stretches the button to its container's full width. */
  fullWidth?: boolean;
  children?: ReactNode;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'py-2 px-4 text-[14px]',
  md: 'py-2.5 px-5 text-[15px]',
  lg: 'py-3.5 px-6 text-[16px]',
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'btn-shine bg-gold hover:bg-gold-hover active:scale-[0.98] disabled:opacity-70 ' +
    'text-dark-bg font-bold tracking-wide rounded-[10px] transition-all duration-150',
  secondary:
    'border border-[#CCCCCC] dark:border-tab-inactive bg-transparent hover:border-gold ' +
    'text-[#1A1A1A] dark:text-white font-semibold rounded-[10px] transition-colors disabled:opacity-50',
  ghost:
    'bg-transparent text-gold hover:text-gold-hover font-semibold transition-colors disabled:opacity-50',
  danger:
    'bg-lavo-error hover:bg-[#D03020] active:scale-[0.98] disabled:opacity-70 ' +
    'text-white font-bold rounded-[10px] transition-all duration-150',
};

/**
 * Branded button component with variant, size, loading, and full-width support.
 *
 * @param variant  - Visual style: primary | secondary | ghost | danger (default: primary)
 * @param size     - Size preset: sm | md | lg (default: lg)
 * @param loading  - Renders a spinner and disables interaction when true
 * @param fullWidth - Expands the button to 100% width of its container
 */
export function Button({
  variant = 'primary',
  size = 'lg',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      disabled={disabled || loading}
      className={[
        'flex items-center justify-center gap-2 cursor-pointer',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

import { type ReactNode } from 'react';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export interface AlertProps {
  variant?: AlertVariant;
  /** Optional title rendered in bold above the message. */
  title?: string;
  children?: ReactNode;
  className?: string;
}

const VARIANT_CONFIG: Record<
  AlertVariant,
  { containerClass: string; iconPath: string; iconColor: string }
> = {
  success: {
    containerClass:
      'bg-Hurryline-success/10 border-l-4 border-Hurryline-success text-Hurryline-success',
    iconPath: 'M5 13l4 4L19 7',
    iconColor: 'text-Hurryline-success',
  },
  error: {
    containerClass:
      'bg-Hurryline-error/10 border-l-4 border-Hurryline-error text-Hurryline-error',
    iconPath: 'M6 18L18 6M6 6l12 12',
    iconColor: 'text-Hurryline-error',
  },
  warning: {
    containerClass:
      'bg-yellow-400/10 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-400',
    iconPath: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
  },
  info: {
    containerClass:
      'bg-blue-400/10 border-l-4 border-blue-500 text-blue-700 dark:text-blue-400',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    iconColor: 'text-blue-500 dark:text-blue-400',
  },
};

/**
 * Inline alert banner with icon, colored border, and optional title.
 *
 * @param variant - Success | error | warning | info (default: info)
 * @param title   - Optional bold heading above the message
 */
export function Alert({ variant = 'info', title, children, className = '' }: AlertProps) {
  const { containerClass, iconPath, iconColor } = VARIANT_CONFIG[variant];

  return (
    <div
      role="alert"
      className={[
        'flex gap-3 rounded-[10px] px-4 py-3 text-[14px]',
        containerClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        className={['w-5 h-5 shrink-0 mt-[1px]', iconColor].join(' ')}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
      <div className="flex flex-col gap-0.5">
        {title && <span className="font-semibold">{title}</span>}
        <span>{children}</span>
      </div>
    </div>
  );
}

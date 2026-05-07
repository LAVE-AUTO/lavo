import { type HTMLAttributes, type ReactNode } from 'react';

export type CardVariant = 'default' | 'elevated' | 'flat' | 'station';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Visual style preset.
   * - default:  white/dark-card bg, subtle shadow, rounded-[10px]
   * - elevated: used for auth forms - larger shadow, same bg
   * - flat:     no shadow, border only
   * - station:  card used for station list items - slightly tinted bg
   */
  variant?: CardVariant;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default:
    'bg-white dark:bg-dark-card shadow-sm rounded-[10px]',
  elevated:
    'bg-white dark:bg-dark-card shadow-md rounded-[10px]',
  flat:
    'bg-white dark:bg-dark-card border border-[#CCCCCC] dark:border-tab-inactive rounded-[10px]',
  station:
    'bg-[#E0E0D0] dark:bg-dark-surface rounded-[10px] shadow-sm',
};

/**
 * Generic container card with branded variant presets.
 *
 * @param variant - Visual style preset (default: 'default')
 */
export function Card({
  variant = 'default',
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={[VARIANT_CLASSES[variant], className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

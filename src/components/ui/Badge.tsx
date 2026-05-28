import { type ReactNode } from 'react';

export type BadgeVariant =
  | 'tag'
  | 'status-open'
  | 'status-closed'
  | 'status-pending'
  | 'status-active'
  | 'status-rejected'
  | 'status-suspended'
  | 'distance'
  | 'verified'
  | 'pill';

export interface BadgeProps {
  variant?: BadgeVariant;
  children?: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  tag:
    'bg-surface dark:bg-surface text-[#444] dark:text-Hurryline-muted ' +
    'text-[11px] font-medium px-2.5 py-0.5 rounded-full',
  'status-open':
    'bg-Hurryline-success/15 text-Hurryline-success text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
  'status-closed':
    'bg-Hurryline-error/15 text-Hurryline-error text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
  'status-pending':
    'bg-yellow-400/15 text-yellow-600 dark:text-yellow-400 text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
  'status-active':
    'bg-Hurryline-success/15 text-Hurryline-success text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
  'status-rejected':
    'bg-Hurryline-error/15 text-Hurryline-error text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
  'status-suspended':
    'bg-orange-400/15 text-orange-600 dark:text-orange-400 text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
  distance:
    'bg-[#1A1A1A]/60 text-white text-[11px] font-medium px-2 py-0.5 rounded-md',
  verified:
    'bg-gold/15 text-gold text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
  pill:
    'bg-gold text-dark-bg text-[11px] font-bold px-2.5 py-0.5 rounded-full',
};

/**
 * Compact label badge with semantic variant presets.
 *
 * @param variant - Visual preset (default: 'tag')
 */
export function Badge({ variant = 'tag', className = '', children }: BadgeProps) {
  return (
    <span
      className={['inline-flex items-center', VARIANT_CLASSES[variant], className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}

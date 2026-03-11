import { type ReactNode } from 'react';

export interface SectionHeaderProps {
  title: string;
  /** Optional numeric count rendered in a pill next to the title. */
  count?: number;
  /** Optional node rendered on the right side (e.g. a "See all" link). */
  action?: ReactNode;
  /** Show a gold accent bar on the left of the title (default: false). */
  accentBar?: boolean;
  className?: string;
}

/**
 * Reusable section heading with optional count pill, right-side action, and gold accent bar.
 *
 * @param title     - Section label text
 * @param count     - Item count shown as a pill
 * @param action    - Right-aligned slot (links, buttons, etc.)
 * @param accentBar - Renders a gold left-border accent when true
 */
export function SectionHeader({
  title,
  count,
  action,
  accentBar = false,
  className = '',
}: SectionHeaderProps) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-3',
        accentBar ? 'pl-3 border-l-4 border-gold' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center gap-2">
        <h2 className="text-[16px] font-bold text-[#1A1A1A] dark:text-white leading-none">
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-[11px] font-bold bg-gold/20 text-gold px-2 py-0.5 rounded-full leading-none">
            {count}
          </span>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

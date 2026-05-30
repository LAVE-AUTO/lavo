import { type ReactNode } from 'react';

export interface EmptyStateProps {
  /** SVG icon or any React node rendered at the top. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional action button or link rendered below the description. */
  action?: ReactNode;
  className?: string;
}

/**
 * Centered empty / no-results state with icon, title, description, and optional action.
 *
 * @param icon        - Illustrative icon (SVG recommended, ~48px)
 * @param title       - Primary message (e.g. "Aucune station trouvee")
 * @param description - Secondary hint text
 * @param action      - Call-to-action rendered below the description
 */
export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center gap-3 py-16 px-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && (
        <div className="text-Hurryline-muted mb-1" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-[16px] font-semibold text-[#333] dark:text-white">{title}</p>
      {description && (
        <p className="text-[14px] text-Hurryline-muted max-w-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

import type { ReactNode } from 'react';

/**
 * Minimal passthrough layout for the (public) route group.
 * Auth pages (login, register, etc.) use this - no navbar or footer.
 * Pages that need the full layout (stations) have their own nested layout.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

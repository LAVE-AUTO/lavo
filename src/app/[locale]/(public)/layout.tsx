import type { ReactNode } from 'react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';

/**
 * Public layout: sticky navbar + page content + footer.
 * Applies to all public-facing pages (home, stations, auth pages, etc.).
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicNavbar />
      <div className="flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>
        <PublicFooter />
      </div>
    </>
  );
}

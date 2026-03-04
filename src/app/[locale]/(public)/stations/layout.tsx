import type { ReactNode } from 'react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { BottomNav } from '@/components/layout/BottomNav';

/**
 * Layout for all public station pages (list + detail + apply).
 * Desktop: sticky top navbar + page content + footer.
 * Mobile: sticky top navbar (logo/controls only) + page content + fixed bottom nav (no footer).
 */
export default function StationsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicNavbar />
      <div className="flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>
        {/* Footer: desktop only */}
        <div className="hidden sm:block">
          <PublicFooter />
        </div>
      </div>
      {/* Bottom nav: mobile only */}
      <BottomNav />
    </>
  );
}

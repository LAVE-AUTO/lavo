import type { ReactNode } from 'react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { BottomNav } from '@/components/layout/BottomNav';

/**
 * Layout for all public station pages (list, detail, onboarding).
 * Desktop: sticky top navbar + page content + footer.
 * Mobile: sticky top navbar (logo/controls only) + page content + fixed bottom nav (no footer).
 */
export default function StationsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Stations handle spacing themselves to avoid an extra bar under the navbar on mobile */}
      <PublicNavbar withTopSpacer={false} withMobileScrollSpacer={false} />
      <div className="flex flex-col min-h-screen pt-[60px]">
        {/* Bottom padding on mobile so content doesn't sit under the fixed BottomNav */}
        <div className="flex-1 pb-16 sm:pb-0">{children}</div>
        {/* Footer: desktop only */}
        <div className="hidden sm:block">
        </div>
      </div>
      {/* Bottom nav: mobile only */}
      <BottomNav />
    </>
  );
}

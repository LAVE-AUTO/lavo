import type { ReactNode } from 'react';
import { BrandPanel } from './BrandPanel';

interface AuthPageLayoutProps {
  children: ReactNode;
}

/**
 * Split-screen layout for all auth pages.
 *
 * Desktop (lg+): left brand panel (45%) + right form panel (55%).
 * Mobile: full-width form panel only.
 */
export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left brand panel — visible on desktop only */}
      <aside className="hidden lg:block lg:w-[42%] xl:w-[45%] shrink-0 sticky top-0 h-screen">
        <BrandPanel />
      </aside>

      {/* Right form panel */}
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen auth-form-bg overflow-y-auto px-6 py-10">
        {children}
      </main>
    </div>
  );
}

import type { ReactNode } from 'react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicNavbar />
      <div className="flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>
      </div>
      <BottomNav />
    </>
  );
}

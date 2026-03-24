import type { ReactNode } from 'react';
import { AdminTopNav } from './AdminTopNav';
import { AdminSidebar } from './AdminSidebar';

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F5F5EE] dark:bg-[#0C1209]">
      <AdminTopNav />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

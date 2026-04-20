'use client';

import { type ReactNode, useState, useCallback } from 'react';
import { AdminTopNav } from './AdminTopNav';
import { AdminSidebar } from './AdminSidebar';

export function AdminShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar  = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-[#F5F5EE] dark:bg-[#0C1209]">
      <AdminTopNav onToggleSidebar={toggleSidebar} />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar open={sidebarOpen} onClose={closeSidebar} />
        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

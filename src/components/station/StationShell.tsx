'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { StationTopNav } from './StationTopNav';
import { StationSidebar } from './StationSidebar';

interface StationShellProps {
  children: ReactNode;
  stationName?: string;
}

export function StationShell({ children, stationName }: StationShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-[#FFF9EC] dark:bg-dark-bg">
      <StationTopNav
        stationName={stationName}
        onToggleSidebar={() => setMobileSidebarOpen((v) => !v)}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Mobile backdrop */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <StationSidebar
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
        <main className="flex flex-1 min-h-0 flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

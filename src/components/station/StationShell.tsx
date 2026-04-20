import type { ReactNode } from 'react';
import { StationTopNav } from './StationTopNav';
import { StationSidebar } from './StationSidebar';

interface StationShellProps {
  children: ReactNode;
  stationName?: string;
  notifCount?: number;
}

export function StationShell({ children, stationName, notifCount }: StationShellProps) {
  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-[#F5F5EE] dark:bg-[#0C1209]">
      <StationTopNav stationName={stationName} notifCount={notifCount} />
      <div className="flex flex-1 overflow-hidden">
        <StationSidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { StationTopNav } from './StationTopNav';
import { StationSidebar } from './StationSidebar';

interface StationShellProps {
  children: ReactNode;
  stationName?: string;
}

export function StationShell({ children, stationName }: StationShellProps) {
  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-[#FFF9EC] dark:bg-[#001201]">
      <StationTopNav stationName={stationName} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <StationSidebar />
        <main className="flex flex-1 min-h-0 flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

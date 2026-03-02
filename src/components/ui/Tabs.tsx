import type { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTabId: string;
  onTabChange?: (id: string) => void;
}

export function Tabs({ tabs, activeTabId, onTabChange }: TabsProps) {
  return (
    <div>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange?.(tab.id)}
          aria-pressed={tab.id === activeTabId}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}


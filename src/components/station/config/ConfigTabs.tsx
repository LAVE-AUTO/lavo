'use client';

import type { ReactNode } from 'react';

export type ConfigTabId = 'commerce' | 'hours' | 'capacity' | 'notifications' | 'payments';

export interface ConfigTab {
  id: ConfigTabId;
  label: string;
  icon: ReactNode;
}

interface Props {
  tabs: ConfigTab[];
  active: ConfigTabId;
  onChange: (id: ConfigTabId) => void;
}

export function ConfigTabs({ tabs, active, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Settings sections"
      className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-[#FFF9EC] bg-white/95 px-2 backdrop-blur-md dark:border-[#1A2A14] dark:bg-dark-bg/95"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`config-panel-${tab.id}`}
            id={`config-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-[13px] font-semibold transition-colors duration-150 ${
              isActive
                ? 'text-[#DDAF3B]'
                : 'text-foreground/55 hover:text-[#001201] dark:text-[#B0BFB1] dark:hover:text-[#FFF9EC]'
            }`}
          >
            <span
              className={`transition-colors ${
                isActive ? 'text-[#DDAF3B]' : 'text-[#AAAAAA] dark:text-[#5A5A4A]'
              }`}
              aria-hidden="true"
            >
              {tab.icon}
            </span>
            <span>{tab.label}</span>
            {isActive && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-t-full bg-[#DDAF3B]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

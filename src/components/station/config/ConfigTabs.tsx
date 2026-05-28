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
      className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-[#E0DCD0] bg-white/95 px-2 backdrop-blur-md dark:border-[#1A2A14] dark:bg-[#111A0E]/95"
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
                ? 'text-[#C49A1E]'
                : 'text-foreground/55 hover:text-[#1A1A0A] dark:text-[#9A9A8A] dark:hover:text-[#F0EDD4]'
            }`}
          >
            <span
              className={`transition-colors ${
                isActive ? 'text-[#C49A1E]' : 'text-[#AAAAAA] dark:text-[#5A5A4A]'
              }`}
              aria-hidden="true"
            >
              {tab.icon}
            </span>
            <span>{tab.label}</span>
            {isActive && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-t-full bg-[#C49A1E]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

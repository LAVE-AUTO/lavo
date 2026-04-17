'use client';

import { type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  /** Optional icon rendered before the label. */
  icon?: ReactNode;
  /** Optional count badge rendered after the label. */
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTabId: string;
  onTabChange?: (id: string) => void;
  className?: string;
}

/**
 * Horizontally scrollable tab strip with a gold active indicator.
 *
 * @param tabs        - Array of tab descriptors
 * @param activeTabId - ID of the currently active tab
 * @param onTabChange - Called with the ID of the clicked tab
 */
export function Tabs({ tabs, activeTabId, onTabChange, className = '' }: TabsProps) {
  return (
    <div
      role="tablist"
      className={[
        'flex gap-1 overflow-x-auto scrollbar-none border-b border-[#CCCCCC] dark:border-tab-inactive',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onTabChange?.(tab.id)}
            className={[
              'flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-[14px] font-semibold',
              'transition-colors border-b-2 -mb-px',
              isActive
                ? 'border-gold text-gold'
                : 'border-transparent text-lavo-muted hover:text-[#1A1A1A] dark:hover:text-white',
            ].join(' ')}
          >
            {tab.icon && (
              <span className="shrink-0" aria-hidden="true">
                {tab.icon}
              </span>
            )}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={[
                  'text-[11px] font-bold px-1.5 py-0.5 rounded-full',
                  isActive
                    ? 'bg-gold/20 text-gold'
                    : 'bg-[#CCCCCC]/40 dark:bg-tab-inactive/40 text-lavo-muted',
                ].join(' ')}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

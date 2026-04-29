'use client';

import { ReactNode, useState } from 'react';

interface SidebarSectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SidebarSection({ title, icon, defaultOpen = true, children }: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-150 text-[#666] hover:bg-[#E8E4D8] dark:text-[#A0A090] dark:hover:bg-[#182214]"
        aria-expanded={isOpen}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span className="flex-1 text-left">{title}</span>
        <span className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {isOpen && <div className="space-y-1 pl-3">{children}</div>}
    </div>
  );
}

'use client';

import { ReactNode, useState } from 'react';

interface SidebarSectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  collapsed?: boolean;
  children: ReactNode;
}

export function SidebarSection({
  title,
  icon,
  defaultOpen = true,
  collapsed = false,
  children,
}: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // When the parent sidebar is collapsed (icon-only), drop the title row entirely
  // and just show the items so the column stays a clean strip of icons.
  if (collapsed) {
    return <div className="flex flex-col gap-1">{children}</div>;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1px] text-foreground/55 transition-colors duration-150 hover:bg-[#FFF9EC] dark:text-[#B0BFB1] dark:hover:bg-[#182214]"
        aria-expanded={isOpen}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="flex-1 text-left">{title}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && <div className="flex flex-col gap-1 pl-1">{children}</div>}
    </div>
  );
}

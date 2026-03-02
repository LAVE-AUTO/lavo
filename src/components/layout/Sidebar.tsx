import type { ReactNode } from 'react';

export interface SidebarProps {
  children?: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return <aside>{children}</aside>;
}


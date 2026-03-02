import type { ReactNode } from 'react';

export interface AdminLayoutProps {
  children?: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return <div>{children}</div>;
}


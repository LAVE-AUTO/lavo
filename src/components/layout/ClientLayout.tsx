import type { ReactNode } from 'react';

export interface ClientLayoutProps {
  children?: ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  return <div>{children}</div>;
}


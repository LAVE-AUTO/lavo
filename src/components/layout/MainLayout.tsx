import type { ReactNode } from 'react';

export interface MainLayoutProps {
  children?: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return <div>{children}</div>;
}


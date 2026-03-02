import type { ReactNode } from 'react';

export interface StationLayoutProps {
  children?: ReactNode;
}

export function StationLayout({ children }: StationLayoutProps) {
  return <div>{children}</div>;
}


import type { ReactNode } from 'react';

export interface StationCardProps {
  children?: ReactNode;
}

export function StationCard({ children }: StationCardProps) {
  return <div>{children}</div>;
}


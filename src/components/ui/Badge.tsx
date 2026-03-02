import type { ReactNode } from 'react';

export interface BadgeProps {
  children?: ReactNode;
}

export function Badge({ children }: BadgeProps) {
  return <span>{children}</span>;
}


import type { ReactNode } from 'react';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export interface AlertProps {
  variant?: AlertVariant;
  children?: ReactNode;
}

export function Alert({ children }: AlertProps) {
  return <div>{children}</div>;
}


import type { ReactNode } from 'react';

export interface ReservationCardProps {
  children?: ReactNode;
}

export function ReservationCard({ children }: ReservationCardProps) {
  return <div>{children}</div>;
}


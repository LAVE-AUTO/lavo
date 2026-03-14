import type { ReactNode } from 'react';
import { StationShell } from '@/components/station/StationShell';

export default function StationLayout({ children }: { children: ReactNode }) {
  return <StationShell>{children}</StationShell>;
}

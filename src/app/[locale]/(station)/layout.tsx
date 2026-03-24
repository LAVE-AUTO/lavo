'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context';
import { getFromApi } from '@/services/axios-service';
import { StationShell } from '@/components/station/StationShell';

export default function StationLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isStation } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  const [stationName, setStationName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !isStation) {
      router.replace(`/${locale}/station/login`);
      return;
    }
    getFromApi('/station/me').then(([ok, data]) => {
      if (ok) {
        const name = (data as { data: { name: string } }).data?.name;
        if (name) setStationName(name);
      }
    });
  }, [isLoading, isAuthenticated, isStation, router, locale]);

  if (isLoading) return null;
  if (!isAuthenticated || !isStation) return null;

  return <StationShell stationName={stationName}>{children}</StationShell>;
}

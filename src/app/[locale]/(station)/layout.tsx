'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context';
import { StationShell } from '@/components/station/StationShell';

export default function StationLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isStation } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !isStation) {
      router.replace(`/${locale}/station/login`);
    }
  }, [isLoading, isAuthenticated, isStation, router, locale]);

  if (isLoading) return null;
  if (!isAuthenticated || !isStation) return null;

  return <StationShell>{children}</StationShell>;
}

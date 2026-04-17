'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context';

/**
 * Redirects authenticated users away from the landing page to their dashboard.
 * CLIENT → /stations, STATION → /station/dashboard, SUPER_ADMIN → /admin
 */
export function HomeRedirectGuard() {
  const { isAuthenticated, isLoading, isClient, isStation, isSuperAdmin } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    if (isClient) {
      router.replace(`/${locale}/stations`);
    } else if (isStation) {
      router.replace(`/${locale}/station/dashboard`);
    } else if (isSuperAdmin) {
      router.replace(`/${locale}/admin`);
    }
  }, [isLoading, isAuthenticated, isClient, isStation, isSuperAdmin, router, locale]);

  return null;
}

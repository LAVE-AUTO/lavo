'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context';

type AuthRedirectGuardProps = {
  children?: ReactNode;
};

/**
 * Client-side guard for public auth pages.
 *
 * - While auth is loading, renders nothing to avoid flicker.
 * - When authenticated, redirects users to the appropriate destination:
 *   CLIENT → /stations, STATION → /station/dashboard, SUPER_ADMIN → /admin
 * - When not authenticated, renders children as-is.
 */
export function AuthRedirectGuard({ children }: AuthRedirectGuardProps) {
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

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}


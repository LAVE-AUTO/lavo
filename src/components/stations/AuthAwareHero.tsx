'use client';

import { useAuth } from '@/context';
import type { ReactNode } from 'react';

/**
 * Client wrapper that hides the hero section when the user is authenticated.
 * Used on the stations page so logged-in users skip straight to the station list.
 *
 * To avoid a flash of the hero when the locale changes (FR/EN toggle) for an
 * already-authenticated user, we also hide the hero while the auth context is
 * still loading. Once auth has resolved, we either:
 * - return null for authenticated users, or
 * - render the hero for guests.
 */
export function AuthAwareHero({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // While auth state is loading, don't render the hero at all to prevent
  // a brief flash when toggling locale or refreshing.
  if (isLoading || isAuthenticated) return null;

  return <>{children}</>;
}

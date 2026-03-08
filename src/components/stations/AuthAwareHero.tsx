'use client';

import { useAuth } from '@/context';
import type { ReactNode } from 'react';

/**
 * Client wrapper that hides the hero section when the user is authenticated.
 * Used on the stations page so logged-in users skip straight to the station list.
 */
export function AuthAwareHero({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return null;

  return <>{children}</>;
}

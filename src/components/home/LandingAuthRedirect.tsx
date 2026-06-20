'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/auth-context';

/**
 * Redirects an already-authenticated visitor away from the public landing page
 * to their role home, so logged-in users never sit on the marketing landing.
 *
 * Client-side (the access token / role lives in React memory): once the session
 * has hydrated, route by role using the same targets as the post-login redirect.
 * Renders nothing.
 */
export function LandingAuthRedirect() {
  const router = useRouter();
  const { isAuthenticated, isLoading, isStation, isSuperAdmin } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (isStation) {
      router.replace('/station/dashboard');
    } else if (isSuperAdmin) {
      router.replace('/admin');
    } else {
      router.replace('/stations');
    }
  }, [isAuthenticated, isLoading, isStation, isSuperAdmin, router]);

  return null;
}

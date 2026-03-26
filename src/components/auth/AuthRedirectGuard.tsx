import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

type AuthRedirectGuardProps = {
  children?: ReactNode;
};

/**
 * Server-side guard for public auth pages.
 *
 * Reads the refresh_token httpOnly cookie server-side to avoid the client-side
 * flash where authenticated users briefly see the login form on slow connections.
 *
 * - If the refresh_token cookie is present, the user is likely authenticated:
 *   redirect to the home page (AuthProvider will handle role-specific redirect after hydration).
 * - If not present, render children (the auth page).
 *
 * Note: the access token is in React memory only, so the server cannot verify the
 * exact role. Redirecting to '/' is safe — AuthProvider will redirect further by role.
 */
export async function AuthRedirectGuard({ children }: AuthRedirectGuardProps) {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has('refresh_token');

  if (hasSession) {
    redirect('/');
  }

  return <>{children}</>;
}

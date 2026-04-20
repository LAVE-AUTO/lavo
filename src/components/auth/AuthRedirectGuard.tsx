import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { REFRESH_COOKIE_NAME } from '@/helpers/server-constants';

type AuthRedirectGuardProps = {
  locale: string;
  children?: ReactNode;
};

/**
 * Server-side guard for public auth pages.
 *
 * Reads the refresh_token httpOnly cookie server-side to avoid the client-side
 * flash where authenticated users briefly see the login form on slow connections.
 *
 * - If the refresh_token cookie is present, the user is likely authenticated:
 *   redirect to the locale-prefixed home page (AuthProvider will handle the
 *   role-specific redirect after hydration).
 * - If not present, render children (the auth page).
 *
 * The locale prefix prevents next-intl from issuing a second redirect from `/`
 * to `/{locale}/`.
 *
 * Note: the access token is in React memory only, so the server cannot verify the
 * exact role. Redirecting to `/{locale}/` is safe — AuthProvider will redirect
 * further by role once it hydrates the session.
 */
export async function AuthRedirectGuard({ locale, children }: AuthRedirectGuardProps) {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has(REFRESH_COOKIE_NAME);

  if (hasSession) {
    redirect(`/${locale}/`);
  }

  return <>{children}</>;
}

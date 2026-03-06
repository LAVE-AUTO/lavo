import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findOrCreateOAuthUser } from '@/server/auth/auth-service';
import { buildRefreshCookieOptions } from '@/lib/jwt';
import { REFRESH_COOKIE_NAME } from '@/helpers/constants';

/**
 * GET /api/v1/auth/oauth/finalize
 * Bridge between NextAuth OAuth callback and our custom JWT session.
 * Creates or retrieves the user, then redirects to /fr/auth/callback
 * with the tokens as query parameters for the frontend to store.
 *
 * This route is the redirect target configured in auth.ts.
 */
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const loginUrl = `${appUrl}/fr/login?error=oauth_failed`;

  const session = await auth();
  const { oauthEmail, oauthFirstName, oauthLastName } =
    (session as unknown) as Record<string, unknown>;

  if (!oauthEmail || typeof oauthEmail !== 'string') {
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { tokens } = await findOrCreateOAuthUser({
      email: oauthEmail,
      firstName: typeof oauthFirstName === 'string' ? oauthFirstName : '',
      lastName: typeof oauthLastName === 'string' ? oauthLastName : '',
    });

    const response = NextResponse.redirect(`${appUrl}/fr/auth/callback`);
    response.cookies.set(
      REFRESH_COOKIE_NAME,
      tokens.rawRefreshToken,
      buildRefreshCookieOptions(),
    );
    return response;
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

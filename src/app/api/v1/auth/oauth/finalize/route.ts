import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findOrCreateOAuthUser } from '@/server/auth/auth-service';
import { signJwt, buildCookieOptions } from '@/lib/jwt';

/**
 * GET /api/v1/auth/oauth/finalize
 * Bridge between NextAuth OAuth callback and our custom JWT session.
 * Creates or retrieves the user, issues our auth_token cookie, then redirects.
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
    const user = await findOrCreateOAuthUser({
      email: oauthEmail,
      firstName: typeof oauthFirstName === 'string' ? oauthFirstName : '',
      lastName: typeof oauthLastName === 'string' ? oauthLastName : '',
    });

    const jwt = await signJwt({
      sub: user.id,
      role: user.role,
      email: user.email,
      status: user.status,
    });

    const cookieOpts = buildCookieOptions(false);
    const response = NextResponse.redirect(`${appUrl}/fr/dashboard`);
    response.cookies.set(cookieOpts.name, jwt, cookieOpts);
    return response;
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

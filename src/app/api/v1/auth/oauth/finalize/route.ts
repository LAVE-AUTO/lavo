import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findOrCreateOAuthUser } from '@/server/auth/auth-service';
import { buildAccessCookieOptions, buildRefreshCookieOptions } from '@/lib/jwt';

/**
 * GET /api/v1/auth/oauth/finalize
 * Bridge between NextAuth OAuth callback and our custom JWT session.
 * Creates or retrieves the user, issues access + refresh cookies, then redirects.
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

    const accessOpts = buildAccessCookieOptions();
    const refreshOpts = buildRefreshCookieOptions(false);
    const response = NextResponse.redirect(`${appUrl}/fr/dashboard`);
    response.cookies.set(accessOpts.name, tokens.accessJwt, accessOpts);
    response.cookies.set(refreshOpts.name, tokens.rawRefreshToken, refreshOpts);
    return response;
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

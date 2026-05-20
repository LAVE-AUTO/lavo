import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

const LOCALES = ['fr', 'en'];

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Middleware chain:
 * 1. Authenticated users are redirected away from landing / auth pages
 * 2. Admin route guard checks for session cookie
 * 3. next-intl handles locale detection and redirects (e.g. / → /fr)
 *
 * Auth detection uses the `Hurryline_auth_role` non-httpOnly hint cookie
 * set by the client on login/refresh and cleared on logout. It is NOT used
 * for access control (that happens server-side via JWT) — only for fast UX
 * redirects so authenticated users never land on the login/landing screens.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const locale =
    LOCALES.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)) ?? LOCALES[0];

  /* --- 1. Redirect authenticated users away from public auth/landing pages --- */
  const authRole = request.cookies.get('Hurryline_auth_role')?.value;
  if (authRole) {
    const isPublicOnlyPath =
      pathname === `/${locale}` ||
      pathname === `/${locale}/login` ||
      pathname.startsWith(`/${locale}/login/`) ||
      pathname === `/${locale}/register` ||
      pathname.startsWith(`/${locale}/register/`) ||
      pathname === `/${locale}/station/login`;

    if (isPublicOnlyPath) {
      const dest =
        authRole === 'station' ? `/${locale}/station/dashboard` :
        authRole === 'admin'   ? `/${locale}/admin` :
                                 `/${locale}/stations`;
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  /* --- 2. Admin route guard --- */
  const isAdminPath = LOCALES.some(
    (l) => pathname === `/${l}/admin` || pathname.startsWith(`/${l}/admin/`)
  );
  if (isAdminPath) {
    const adminSession = request.cookies.get('Hurryline_admin_session');
    if (!adminSession?.value) {
      return NextResponse.redirect(new URL(`/${locale}/login/admin`, request.url));
    }
  }

  /* --- 3. next-intl locale handling (redirect / → /fr, negotiate locale, etc.) --- */
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(fr|en)/:path*'],
};

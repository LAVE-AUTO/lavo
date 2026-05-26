import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

const LOCALES = ['fr', 'en'];

const intlMiddleware = createIntlMiddleware(routing);

const isProd = process.env.NODE_ENV === 'production';

function buildCsp(nonce: string): string {
  if (!isProd) {
    return [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com https://cdn.pagesense.io`,
      "frame-src https://js.stripe.com",
      "connect-src 'self' https: ws: https://api.stripe.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net",
    ].join('; ');
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com https://www.googletagmanager.com https://cdn.pagesense.io`,
    "frame-src https://js.stripe.com",
    "connect-src 'self' https: https://api.stripe.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net",
    "upgrade-insecure-requests",
  ].join('; ');
}

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
 *
 * A per-request nonce is generated here and forwarded via `x-nonce` request
 * header so server components can read it with headers() and pass it to
 * <Script nonce={nonce}> tags. The matching CSP is set on every response so
 * Next.js inline hydration scripts are allowed in production.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

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
      const response = NextResponse.redirect(new URL(dest, request.url));
      response.headers.set('Content-Security-Policy', csp);
      return response;
    }
  }

  /* --- 2. Admin route guard --- */
  const isAdminPath = LOCALES.some(
    (l) => pathname === `/${l}/admin` || pathname.startsWith(`/${l}/admin/`)
  );
  if (isAdminPath) {
    const adminSession = request.cookies.get('Hurryline_admin_session');
    if (!adminSession?.value) {
      const response = NextResponse.redirect(new URL(`/${locale}/login/admin`, request.url));
      response.headers.set('Content-Security-Policy', csp);
      return response;
    }
  }

  /* --- 3. next-intl locale handling (redirect / → /fr, negotiate locale, etc.) --- */
  // Pass nonce via request header so next-intl forwards it to server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  const response = intlMiddleware(new NextRequest(request, { headers: requestHeaders }));
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/', '/(fr|en)/:path*'],
};

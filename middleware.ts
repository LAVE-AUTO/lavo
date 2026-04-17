import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

const LOCALES = ['fr', 'en'];

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Middleware chain:
 * 1. next-intl handles locale detection and redirect (e.g. / → /fr)
 * 2. Admin route guard checks for session cookie
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* --- Admin route guard --- */
  const isAdminPath = LOCALES.some(
    (locale) => pathname === `/${locale}/admin` || pathname.startsWith(`/${locale}/admin/`)
  );

  if (isAdminPath) {
    const adminSession = request.cookies.get('lavo_admin_session');
    if (!adminSession?.value) {
      const locale = LOCALES.find((l) => pathname.startsWith(`/${l}/`)) ?? LOCALES[0];
      const loginUrl = new URL(`/${locale}/login`, request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  /* --- next-intl locale handling (redirect / → /fr, negotiate locale, etc.) --- */
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(fr|en)/:path*'],
};

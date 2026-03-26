import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LOCALES = ['fr', 'en'];

/**
 * Server-side guard for admin routes.
 * Checks for the lavo_admin_session hint cookie set by AuthProvider on login.
 * This prevents unauthenticated users from receiving admin page HTML before
 * client-side JS runs. The backend JWT check remains the authoritative
 * security layer for all API calls.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminPath = LOCALES.some(
    (locale) => pathname === `/${locale}/admin` || pathname.startsWith(`/${locale}/admin/`)
  );

  if (!isAdminPath) return NextResponse.next();

  const adminSession = request.cookies.get('lavo_admin_session');
  if (!adminSession?.value) {
    const locale = LOCALES.find((l) => pathname.startsWith(`/${l}/`)) ?? LOCALES[0];
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/(fr|en)/admin', '/(fr|en)/admin/:path*'],
};

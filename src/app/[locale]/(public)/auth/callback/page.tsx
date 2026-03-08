'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context';
import type { AuthUser } from '@/context/auth-context';
import { Spinner } from '@/components/ui/Spinner';

/**
 * OAuth callback page.
 * The finalize route sets a refresh cookie then redirects here.
 * We call POST /auth/refresh to exchange the cookie for an access token + user,
 * store them in AuthContext and redirect by role.
 */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const { login } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

    fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error('refresh_failed');
        return res.json();
      })
      .then((json) => {
        const data = json.data ?? json;
        const token: string = data.access_token;
        const user: AuthUser = data.user;

        if (!token || !user) throw new Error('missing_data');

        login(token, user);

        const role = (user.role || '').toUpperCase();

        if (user.force_password_change) {
          router.push('/change-password');
        } else if (role === 'STATION') {
          router.push('/station');
        } else if (role === 'SUPER_ADMIN') {
          router.push('/admin');
        } else {
          router.push('/stations');
        }
      })
      .catch(() => {
        router.push('/login?error=oauth_failed');
      });
  }, [router, login]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-[15px] text-[#555] dark:text-[#C0C0B0]">Connexion en cours...</p>
      </div>
    </div>
  );
}

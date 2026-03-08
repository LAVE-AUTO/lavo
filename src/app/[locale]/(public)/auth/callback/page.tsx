'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context';
import type { AuthUser } from '@/context/auth-context';
import { Spinner } from '@/components/ui/Spinner';

/**
 * OAuth callback page.
 * Receives token + user data from the finalize route query params,
 * stores them in AuthContext and redirects by role.
 */
export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const token = searchParams.get('token');
    const userParam = searchParams.get('user');

    if (!token || !userParam) {
      router.push('/login?error=oauth_failed');
      return;
    }

    try {
      const user = JSON.parse(userParam) as AuthUser;
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
    } catch {
      router.push('/login?error=oauth_failed');
    }
  }, [searchParams, router, login]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-[15px] text-[#555] dark:text-[#C0C0B0]">Connexion en cours...</p>
      </div>
    </div>
  );
}

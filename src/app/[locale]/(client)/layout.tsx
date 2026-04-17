'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context';
import { useFcmToken } from '@/hooks/useFcmToken';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { BottomNav } from '@/components/layout/BottomNav';

export default function ClientLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isClient } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  // Silently registers the FCM device token once the user is authenticated.
  // Never blocks rendering; notification permission is optional.
  useFcmToken();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !isClient) {
      router.replace(`/${locale}/login`);
    }
  }, [isLoading, isAuthenticated, isClient, router, locale]);

  if (isLoading) return null;
  if (!isAuthenticated || !isClient) return null;

  return (
    <>
      <PublicNavbar />
      <div className="flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>
      </div>
      <BottomNav />
    </>
  );
}

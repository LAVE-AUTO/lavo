'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isSuperAdmin } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !isSuperAdmin) {
      router.replace(`/${locale}/login`);
    }
  }, [isLoading, isAuthenticated, isSuperAdmin, router, locale]);

  if (isLoading) return null;
  if (!isAuthenticated || !isSuperAdmin) return null;

  return <>{children}</>;
}

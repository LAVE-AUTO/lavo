'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context';
import { AdminShell } from '@/components/admin/AdminShell';
import { CommissionProvider } from '@/context/commission-context';
import { PageSpinner } from '@/components/ui/PageSpinner';

function AuthSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <PageSpinner />
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isSuperAdmin } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !isSuperAdmin) {
      router.replace(`/${locale}/login/admin`);
    }
  }, [isLoading, isAuthenticated, isSuperAdmin, router, locale]);

  if (isLoading) return <AuthSpinner />;
  if (!isAuthenticated || !isSuperAdmin) return null;

  return (
    <CommissionProvider>
      <AdminShell>{children}</AdminShell>
    </CommissionProvider>
  );
}

import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { BottomNav } from '@/components/layout/BottomNav';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav' });
  // User-specific page: keep it out of search indexes.
  return { title: t('profile'), robots: { index: false, follow: false } };
}

export default function ProfileLayout({ children }: { children: ReactNode }) {
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

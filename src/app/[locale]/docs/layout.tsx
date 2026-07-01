import type { ReactNode } from 'react';
import type { Metadata } from 'next';

// Internal API documentation — not for search indexes.
export const metadata: Metadata = {
  title: 'API Docs',
  robots: { index: false, follow: false },
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

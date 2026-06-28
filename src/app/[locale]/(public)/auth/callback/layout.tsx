import type { ReactNode } from 'react';
import type { Metadata } from 'next';

// OAuth callback bounce page — transient, must never be indexed.
export const metadata: Metadata = {
  title: 'Hurryline',
  robots: { index: false, follow: false },
};

export default function AuthCallbackLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

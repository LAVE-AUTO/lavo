import type { ReactNode } from 'react';
import type { Metadata } from 'next';

// Internal receipt preview tool — not for search indexes.
export const metadata: Metadata = {
  title: 'Hurryline',
  robots: { index: false, follow: false },
};

export default function ReceiptPreviewLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

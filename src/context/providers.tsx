'use client';

import type { ReactNode } from 'react';
import { Toast } from '@/components/ui/Toast';
import { LocationPermissionToast } from '@/components/ui/LocationPermissionToast';
import { UnverifiedEmailBanner } from '@/components/ui/UnverifiedEmailBanner';
import { AuthProvider } from './auth-context';
import { ThemeProvider } from './theme-context';
import { ToastProvider } from './toast-context';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Wraps the app with all context providers.
 * Order: Theme (outer) -> Auth -> Toast (inner).
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <UnverifiedEmailBanner />
          {children}
          <Toast />
          <LocationPermissionToast />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

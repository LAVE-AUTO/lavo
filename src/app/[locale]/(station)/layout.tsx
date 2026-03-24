'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context';
import { getFromApi } from '@/services/axios-service';
import { StationShell } from '@/components/station/StationShell';
import { StationRejectedView } from '@/components/station/StationRejectedView';

type StationState =
  | { kind: 'loading' }
  | { kind: 'ok'; name: string }
  | { kind: 'rejected'; name: string; reason: string | null };

export default function StationLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isStation } = useAuth();
  const router  = useRouter();
  const locale  = useLocale();

  const [state, setState] = useState<StationState>({ kind: 'loading' });

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !isStation) {
      router.replace(`/${locale}/station/login`);
      return;
    }

    getFromApi('/station/me').then(([ok, data]) => {
      if (ok) {
        const name = (data as { data: { name: string } }).data?.name ?? '';
        setState({ kind: 'ok', name });
        return;
      }

      const errCode = (data as { code?: string }).code;

      if (errCode === 'BUSINESS_REJECTED') {
        // Fetch rejection reason from the status endpoint (no active check)
        getFromApi('/station/status').then(([statusOk, statusData]) => {
          const name =
            statusOk
              ? (statusData as { data: { name: string } }).data?.name ?? ''
              : '';
          const reason =
            statusOk
              ? ((statusData as { data: { rejection_reason: string | null } }).data?.rejection_reason ?? null)
              : null;
          setState({ kind: 'rejected', name, reason });
        });
        return;
      }

      // Any other error (BUSINESS_NOT_APPROVED = pending) — continue with empty name
      setState({ kind: 'ok', name: '' });
    });
  }, [isLoading, isAuthenticated, isStation, router, locale]);

  if (isLoading || state.kind === 'loading') return null;
  if (!isAuthenticated || !isStation) return null;

  if (state.kind === 'rejected') {
    return <StationRejectedView stationName={state.name} rejectionReason={state.reason} />;
  }

  return <StationShell stationName={state.name || undefined}>{children}</StationShell>;
}

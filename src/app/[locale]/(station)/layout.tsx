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

    let mounted = true;

    getFromApi('/station/me').then(([ok, data]) => {
      if (!mounted) return;

      if (ok) {
        const name = (data as { data: { name: string } }).data?.name ?? '';
        setState({ kind: 'ok', name });
        return;
      }

      const errCode = (data as { code?: string }).code;

      if (errCode === 'BUSINESS_REJECTED') {
        // Fetch rejection reason from the status endpoint (no active check required)
        getFromApi('/station/status').then(([statusOk, statusData]) => {
          if (!mounted) return;
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

      // BUSINESS_NOT_APPROVED (pending) or other non-fatal error — show shell with empty name
      setState({ kind: 'ok', name: '' });
    });

    return () => { mounted = false; };
  }, [isLoading, isAuthenticated, isStation, router, locale]);

  if (isLoading || state.kind === 'loading') return null;
  if (!isAuthenticated || !isStation) return null;

  if (state.kind === 'rejected') {
    return <StationRejectedView stationName={state.name} rejectionReason={state.reason} />;
  }

  return <StationShell stationName={state.name || undefined}>{children}</StationShell>;
}

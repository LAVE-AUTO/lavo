'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context';
import { getFromApi } from '@/services/axios-service';
import { StationShell } from '@/components/station/StationShell';
import { StationRejectedBanner } from '@/components/station/StationRejectedBanner';
import { StationPendingView } from '@/components/station/StationPendingView';
import { PageSpinner } from '@/components/ui/PageSpinner';

function AuthSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <PageSpinner />
    </div>
  );
}

type StationState =
  | { kind: 'loading' }
  | { kind: 'ok'; name: string }
  | { kind: 'pending'; name: string }
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
        const payload = (data as { data: { name?: string; status?: string } }).data;
        const name = payload?.name ?? '';
        const status = payload?.status ?? 'active';

        if (status === 'pending_admin_validation') {
          setState({ kind: 'pending', name });
          return;
        }

        if (status === 'rejected') {
          getFromApi('/station/status').then(([statusOk, statusData]) => {
            if (!mounted) return;
            const reason = statusOk
              ? ((statusData as { data: { rejection_reason: string | null } }).data?.rejection_reason ?? null)
              : null;
            setState({ kind: 'rejected', name, reason });
          });
          return;
        }

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

      if (errCode === 'BUSINESS_NOT_APPROVED') {
        // Fetch station name from status endpoint (no active check required)
        getFromApi('/station/status').then(([statusOk, statusData]) => {
          if (!mounted) return;
          const name = statusOk
            ? (statusData as { data: { name: string } }).data?.name ?? ''
            : '';
          setState({ kind: 'pending', name });
        });
        return;
      }

      // Other non-fatal error - show shell
      setState({ kind: 'ok', name: '' });
    });

    return () => { mounted = false; };
  }, [isLoading, isAuthenticated, isStation, router, locale]);

  if (isLoading || state.kind === 'loading') return <AuthSpinner />;
  if (!isAuthenticated || !isStation) return null;

  if (state.kind === 'pending') {
    return (
      <StationShell stationName={state.name}>
        <StationPendingView />
        {children}
      </StationShell>
    );
  }

  if (state.kind === 'rejected') {
    return (
      <StationShell stationName={state.name}>
        <StationRejectedBanner reason={state.reason} />
        {children}
      </StationShell>
    );
  }

  return <StationShell stationName={state.name || undefined}>{children}</StationShell>;
}

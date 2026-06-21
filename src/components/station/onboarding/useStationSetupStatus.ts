'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getFromApi } from '@/services/axios-service';

export type SetupStepKey = 'photos' | 'hours' | 'posts' | 'services' | 'payment';

export interface StationSetupStatus {
  loading: boolean;
  status: Record<SetupStepKey, boolean>;
  completed: number;
  total: number;
  allDone: boolean;
  /** Re-reads every source (used by the periodic reminder banner). */
  refetch: () => Promise<void>;
}

const EMPTY: Record<SetupStepKey, boolean> = {
  photos: false,
  hours: false,
  posts: false,
  services: false,
  payment: false,
};

/**
 * Computes the merchant's station setup completion from the live config sources,
 * one boolean per onboarding step. Fetches everything in parallel and treats a
 * failed/empty source as "not configured" so the checklist degrades gracefully.
 */
export function useStationSetupStatus(): StationSetupStatus {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Record<SetupStepKey, boolean>>(EMPTY);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const [me, hours, config, services, stripe] = await Promise.all([
      getFromApi('/station/me'),
      getFromApi('/station/hours'),
      getFromApi('/station/config'),
      getFromApi('/station/services?limit=1'),
      getFromApi('/station/stripe/status'),
    ]);
    if (!mountedRef.current) return;

    const photos = me[0] ? ((me[1] as { data?: { photos?: string[] } }).data?.photos ?? []) : [];
    const hourRows = hours[0] ? ((hours[1] as { data?: { is_open?: boolean }[] }).data ?? []) : [];
    const posts = config[0] ? ((config[1] as { data?: { posts?: unknown[] } }).data?.posts ?? []) : [];
    const svcItems = services[0] ? ((services[1] as { data?: { items?: unknown[] } }).data?.items ?? []) : [];
    const stripeData = stripe[0]
      ? (stripe[1] as { data?: { connected?: boolean; charges_enabled?: boolean } }).data
      : null;

    setStatus({
      photos: Array.isArray(photos) && photos.length > 0,
      hours: Array.isArray(hourRows) && hourRows.some((d) => d?.is_open === true),
      posts: Array.isArray(posts) && posts.length > 0,
      services: Array.isArray(svcItems) && svcItems.length > 0,
      payment: !!(stripeData?.connected && stripeData?.charges_enabled),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const completed = Object.values(status).filter(Boolean).length;
  const total = Object.keys(EMPTY).length;

  return { loading, status, completed, total, allDone: completed === total, refetch: load };
}

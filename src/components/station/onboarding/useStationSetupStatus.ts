'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getFromApi } from '@/services/axios-service';

export type SetupStepKey = 'photos' | 'hours' | 'posts' | 'services' | 'payment';

export interface StationSetupStatus {
  loading: boolean;
  /** True when at least one source failed to load (status is then partial/unreliable). */
  error: boolean;
  status: Record<SetupStepKey, boolean>;
  completed: number;
  total: number;
  allDone: boolean;
  /** Re-reads every source (used by the periodic reminder banner and the retry button). */
  refetch: () => Promise<void>;
}

/** Unwraps an allSettled result into the Leroi [ok, data] tuple, treating an
 *  unexpected throw the same as a failed request. */
function settledTuple<T>(
  result: PromiseSettledResult<[boolean, T]>,
): [boolean, T | null] {
  return result.status === 'fulfilled' ? result.value : [false, null];
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
  const [error, setError] = useState(false);
  const [status, setStatus] = useState<Record<SetupStepKey, boolean>>(EMPTY);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    /* allSettled (not all): the [ok, data] tuple already shields us from HTTP
     * errors, but allSettled also keeps us resilient to an unexpected throw in
     * any single source. We always render the sources that did succeed and flag
     * the partial failure instead of silently treating it as "not configured". */
    const results = await Promise.allSettled([
      getFromApi('/station/me'),
      getFromApi('/station/hours'),
      getFromApi('/station/config'),
      getFromApi('/station/services?limit=1'),
      getFromApi('/station/stripe/status'),
    ]);
    if (!mountedRef.current) return;

    const [me, hours, config, services, stripe] = results.map(settledTuple);

    const photos = me[0] ? ((me[1] as { data?: { photos?: string[] } })?.data?.photos ?? []) : [];
    const hourRows = hours[0] ? ((hours[1] as { data?: { is_open?: boolean }[] })?.data ?? []) : [];
    const posts = config[0] ? ((config[1] as { data?: { posts?: unknown[] } })?.data?.posts ?? []) : [];
    const svcItems = services[0] ? ((services[1] as { data?: { items?: unknown[] } })?.data?.items ?? []) : [];
    const stripeData = stripe[0]
      ? (stripe[1] as { data?: { connected?: boolean; charges_enabled?: boolean } })?.data
      : null;

    setError([me, hours, config, services, stripe].some(([ok]) => !ok));
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

  return { loading, error, status, completed, total, allDone: completed === total, refetch: load };
}

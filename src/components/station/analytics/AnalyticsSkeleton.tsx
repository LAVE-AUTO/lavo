'use client';

import { useTranslations } from 'next-intl';

export function AnalyticsSkeleton() {
  const t = useTranslations('station_analytics');

  return (
    <div className="space-y-6 bg-gradient-to-br from-white to-slate-50 p-6 dark:from-slate-900 dark:to-slate-950">
      {/* Header Skeleton */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-64 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-10 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="space-y-2 rounded-lg bg-white p-6 dark:bg-slate-800">
            <div className="h-6 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-80 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

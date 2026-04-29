'use client';

export function AvailabilitySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
      <div className="h-4 w-64 rounded-lg bg-slate-200 dark:bg-slate-700" />

      {/* View Toggle */}
      <div className="flex gap-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-10 w-24 rounded-lg bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>

      {/* Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar Skeleton */}
        <div className="space-y-2">
          <div className="h-48 rounded-lg bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Slots Skeleton */}
        <div className="lg:col-span-2 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    </div>
  );
}

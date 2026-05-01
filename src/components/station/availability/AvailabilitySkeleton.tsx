'use client';

export function AvailabilitySkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div>
        <div className="h-7 w-52 rounded-xl bg-[#C8C8B4] dark:bg-[#2A3A26]" />
        <div className="mt-2 h-4 w-72 rounded-xl bg-[#C8C8B4] dark:bg-[#2A3A26]" />
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 border-b border-[#C49A1E]/20 pb-1">
        {[80, 64].map((w, i) => (
          <div key={i} className={`h-9 w-${w === 80 ? '20' : '16'} rounded-lg bg-[#C8C8B4] dark:bg-[#2A3A26]`} />
        ))}
      </div>

      {/* Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar Skeleton */}
        <div>
          <div className="h-64 rounded-xl bg-[#C8C8B4] dark:bg-[#2A3A26]" />
        </div>

        {/* Slots Skeleton */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 rounded-xl bg-[#C8C8B4] dark:bg-[#2A3A26]" />
            <div className="h-8 w-28 rounded-xl bg-[#C8C8B4] dark:bg-[#2A3A26]" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-[#C8C8B4] dark:bg-[#2A3A26]" />
          ))}
        </div>
      </div>
    </div>
  );
}

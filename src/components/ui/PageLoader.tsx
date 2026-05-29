'use client';

interface Props {
  label?: string;
}

/**
 * Shared in-page loader: centered container, small gold spinner, optional label.
 * Use this everywhere instead of bespoke skeletons or bare text - keeps the
 * loading affordance consistent across the merchant + admin workspace.
 */
export function PageLoader({ label }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <svg
        className="animate-spin"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#DDAF3B"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
      {label && (
        <span className="text-[13px] font-semibold text-foreground/65 dark:text-[#B0BFB1]">
          {label}
        </span>
      )}
    </div>
  );
}

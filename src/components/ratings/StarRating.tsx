export interface StarRatingProps {
  value?: number;
  max?: number;
  size?: 'sm' | 'md';
}

const sizeClass = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
};

/**
 * Read-only star rating display.
 * Renders filled, half, and empty stars based on the value.
 *
 * @param value - Rating value (0–max)
 * @param max   - Maximum rating (default 5)
 * @param size  - Icon size variant
 */
export function StarRating({ value = 0, max = 5, size = 'sm' }: StarRatingProps) {
  const cls = sizeClass[size];

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} sur ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = value >= i + 1;
        const half   = !filled && value >= i + 0.5;

        return (
          <svg
            key={i}
            className={`${cls} shrink-0`}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            {half ? (
              <>
                <defs>
                  <linearGradient id={`half-${i}`} x1="0" x2="1" y1="0" y2="0">
                    <stop offset="50%" stopColor="#C49A1E" />
                    <stop offset="50%" stopColor="transparent" />
                  </linearGradient>
                </defs>
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill={`url(#half-${i})`}
                  stroke="#C49A1E"
                  strokeWidth="1.5"
                />
              </>
            ) : (
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill={filled ? '#C49A1E' : 'none'}
                stroke="#C49A1E"
                strokeWidth="1.5"
              />
            )}
          </svg>
        );
      })}
    </span>
  );
}

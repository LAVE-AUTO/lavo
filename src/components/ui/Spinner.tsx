export interface SpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-7 h-7 border-[3px]',
};

/**
 * Animated loading spinner with optional accessible label.
 *
 * @param label - Accessible label and visible text beside the spinner
 * @param size - Spinner size variant (default: 'md')
 */
export function Spinner({ label, size = 'md' }: SpinnerProps) {
  return (
    <div
      className="flex items-center gap-2"
      role="status"
      aria-label={label ?? 'Loading'}
    >
      <div
        className={`${sizeClasses[size]} rounded-full border-current border-t-transparent animate-spin shrink-0 opacity-70`}
      />
      {label && <span className="text-sm font-medium">{label}</span>}
    </div>
  );
}

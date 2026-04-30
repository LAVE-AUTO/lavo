'use client';

interface Props {
  value: number | string;
  onChange: (next: string) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

function MinusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled = false,
  ariaLabel,
}: Props) {
  const numeric = typeof value === 'number' ? value : Number(value);
  const current = Number.isFinite(numeric) ? numeric : (min ?? 0);
  const minBound = min ?? Number.NEGATIVE_INFINITY;
  const maxBound = max ?? Number.POSITIVE_INFINITY;
  const canDecrement = !disabled && current > minBound;
  const canIncrement = !disabled && current < maxBound;

  function clamp(n: number) {
    if (Number.isFinite(min) && n < (min as number)) return min as number;
    if (Number.isFinite(max) && n > (max as number)) return max as number;
    return n;
  }

  function decrement() {
    if (!canDecrement) return;
    onChange(String(clamp(current - step)));
  }

  function increment() {
    if (!canIncrement) return;
    onChange(String(clamp(current + step)));
  }

  return (
    <div
      className={`group relative flex items-stretch overflow-hidden rounded-xl border bg-white transition-all duration-150 focus-within:border-[#C49A1E] focus-within:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] dark:bg-[#0F1A0C] ${
        disabled
          ? 'cursor-not-allowed border-[#E8E4DC] opacity-60 dark:border-[#1A2A14]'
          : 'border-[#E0DCD0] hover:border-[#D0C8B0] dark:border-[#243020] dark:hover:border-[#2E3C2A]'
      }`}
    >
      <button
        type="button"
        onClick={decrement}
        disabled={!canDecrement}
        aria-label={ariaLabel ? `${ariaLabel} − ${step}` : `Decrease by ${step}`}
        tabIndex={-1}
        className="flex w-11 shrink-0 items-center justify-center text-[#888] transition-colors hover:bg-[#FBF7E8] hover:text-[#C49A1E] active:bg-[#F5EDD0] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#888] dark:text-[#9A9A8A] dark:hover:bg-[#1E2A18] dark:hover:text-[#C49A1E]"
      >
        <MinusIcon />
      </button>

      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          // Snap to bounds on blur to avoid rendering values outside the allowed range
          const n = Number(e.target.value);
          if (Number.isFinite(n)) {
            const c = clamp(n);
            if (c !== n) onChange(String(c));
          }
        }}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        className="flex-1 bg-transparent text-center font-black tabular-nums text-[18px] text-[#1A1A0A] outline-none transition-colors placeholder:text-[#BBBBAA] disabled:cursor-not-allowed dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      {unit && (
        <span className="pointer-events-none flex items-center pr-3 text-[11px] font-bold uppercase tracking-wider text-[#BBBBAA] dark:text-[#5A5A4A]">
          {unit}
        </span>
      )}

      <button
        type="button"
        onClick={increment}
        disabled={!canIncrement}
        aria-label={ariaLabel ? `${ariaLabel} + ${step}` : `Increase by ${step}`}
        tabIndex={-1}
        className="flex w-11 shrink-0 items-center justify-center text-[#888] transition-colors hover:bg-[#FBF7E8] hover:text-[#C49A1E] active:bg-[#F5EDD0] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#888] dark:text-[#9A9A8A] dark:hover:bg-[#1E2A18] dark:hover:text-[#C49A1E]"
      >
        <PlusIcon />
      </button>
    </div>
  );
}

'use client';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Branded toggle switch styled with gold when active.
 *
 * @param checked  - Current on/off state
 * @param onChange - Called with the new boolean value on click
 * @param label    - Optional visible label rendered beside the toggle
 * @param disabled - Disables interaction and dims the control
 */
export function Toggle({ checked, onChange, label, disabled = false, id }: ToggleProps) {
  const toggleId = id ?? (label ? `toggle-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <label
      htmlFor={toggleId}
      className={[
        'flex items-center gap-2 select-none',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <button
        id={toggleId}
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none',
          'focus-visible:ring-2 focus-visible:ring-gold/50',
          checked ? 'bg-gold' : 'bg-[#CCCCCC] dark:bg-tab-inactive',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
      {label && (
        <span className="text-[14px] text-[#333] dark:text-white">{label}</span>
      )}
    </label>
  );
}

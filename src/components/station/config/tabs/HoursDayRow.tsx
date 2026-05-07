'use client';

interface Props {
  dayLabel: string;
  enabled: boolean;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  disabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  onMorningStartChange?: (v: string) => void;
  onMorningEndChange?: (v: string) => void;
  onAfternoonStartChange?: (v: string) => void;
  onAfternoonEndChange?: (v: string) => void;
}

const timeInputClass =
  'w-full rounded-lg border border-[#E0DCD0] bg-white px-2.5 py-1.5 text-center font-mono text-[12px] tabular-nums text-[#1A1A0A] outline-none transition-all duration-150 placeholder:text-[#BBBBAA] hover:border-[#D0C8B0] focus:border-[#C49A1E] focus:shadow-[0_0_0_3px_rgba(196,154,30,0.12)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A] dark:hover:border-[#2E3C2A]';

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className="relative inline-flex h-6 w-11 shrink-0">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="peer sr-only"
      />
      <span
        className={`absolute inset-0 rounded-full transition-colors ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        } ${checked ? 'bg-[#C49A1E]' : 'bg-[#D8D4C8] dark:bg-[#243020]'}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </label>
  );
}

function TimeRange({
  start,
  end,
  disabled,
  onStartChange,
  onEndChange,
}: {
  start: string;
  end: string;
  disabled: boolean;
  onStartChange?: (v: string) => void;
  onEndChange?: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        className={timeInputClass}
        type="time"
        value={start}
        disabled={disabled}
        readOnly={!onStartChange}
        onChange={onStartChange ? (e) => onStartChange(e.target.value) : undefined}
        aria-label="Start"
      />
      <span className="text-[12px] font-bold text-[#C49A1E] select-none" aria-hidden="true">
        →
      </span>
      <input
        className={timeInputClass}
        type="time"
        value={end}
        disabled={disabled}
        readOnly={!onEndChange}
        onChange={onEndChange ? (e) => onEndChange(e.target.value) : undefined}
        aria-label="End"
      />
    </div>
  );
}

export function HoursDayRow({
  dayLabel,
  enabled,
  morningStart,
  morningEnd,
  afternoonStart,
  afternoonEnd,
  disabled = false,
  onToggle,
  onMorningStartChange,
  onMorningEndChange,
  onAfternoonStartChange,
  onAfternoonEndChange,
}: Props) {
  return (
    <div className="grid grid-cols-[100px_44px_1fr] items-center gap-3 border-b border-[#F0EDE4] py-3 last:border-b-0 dark:border-[#1A2A14]">
      <span className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{dayLabel}</span>
      <Toggle checked={enabled} disabled={disabled} onChange={onToggle} />
      <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${enabled ? '' : 'opacity-40'}`}>
        <TimeRange
          start={morningStart}
          end={morningEnd}
          disabled={disabled || !enabled}
          onStartChange={onMorningStartChange}
          onEndChange={onMorningEndChange}
        />
        <TimeRange
          start={afternoonStart}
          end={afternoonEnd}
          disabled={disabled || !enabled}
          onStartChange={onAfternoonStartChange}
          onEndChange={onAfternoonEndChange}
        />
      </div>
    </div>
  );
}

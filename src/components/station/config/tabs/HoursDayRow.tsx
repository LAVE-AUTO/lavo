'use client';

interface Props {
  dayLabel: string;
  enabled: boolean;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  disabled: boolean;
}

const inputClass =
  'rounded-[6px] border border-[#D8D4C8] bg-[#F7F6F2] px-2.5 py-1.5 text-center font-mono text-[12px] tabular-nums text-[#1A1A0A] outline-none transition-colors placeholder:text-[#BBBBAA] focus:border-[#C49A1E] focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#243020] dark:bg-[#0F1A0C] dark:text-[#F0EDD4] dark:placeholder:text-[#4A4A3A]';

function Toggle({ checked, disabled }: { checked: boolean; disabled: boolean }) {
  return (
    <label className="relative inline-flex h-6 w-11 shrink-0">
      <input type="checkbox" checked={checked} disabled={disabled} readOnly className="peer sr-only" />
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

export function HoursDayRow({
  dayLabel,
  enabled,
  morningStart,
  morningEnd,
  afternoonStart,
  afternoonEnd,
  disabled,
}: Props) {
  return (
    <div className="grid grid-cols-[100px_44px_1fr] items-center gap-3 border-b border-[#F0EDE4] py-3 last:border-b-0 dark:border-[#1A2A14]">
      <span className="text-[13px] font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">{dayLabel}</span>
      <Toggle checked={enabled} disabled={disabled} />
      <div
        className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${enabled ? '' : 'opacity-40'}`}
      >
        <div className="flex items-center gap-2">
          <input className={inputClass + ' w-20'} type="time" value={morningStart} disabled={disabled} readOnly />
          <span className="text-[12px] text-[#AAAAAA] dark:text-[#5A5A4A]">→</span>
          <input className={inputClass + ' w-20'} type="time" value={morningEnd} disabled={disabled} readOnly />
        </div>
        <div className="flex items-center gap-2">
          <input className={inputClass + ' w-20'} type="time" value={afternoonStart} disabled={disabled} readOnly />
          <span className="text-[12px] text-[#AAAAAA] dark:text-[#5A5A4A]">→</span>
          <input className={inputClass + ' w-20'} type="time" value={afternoonEnd} disabled={disabled} readOnly />
        </div>
      </div>
    </div>
  );
}

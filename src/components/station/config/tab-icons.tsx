/**
 * SVG icons for config tabs. No emojis allowed in UI per project rules.
 */

const SIZE = 16;
const STROKE = 2;

const baseProps = {
  width: SIZE,
  height: SIZE,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: STROKE,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

export const CommerceIcon = () => (
  <svg {...baseProps}>
    <path d="M3 9l1-5h16l1 5" />
    <path d="M5 9v11h14V9" />
    <path d="M9 22V12h6v10" />
  </svg>
);

export const HoursIcon = () => (
  <svg {...baseProps}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

export const CapacityIcon = () => (
  <svg {...baseProps}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

export const NotificationsIcon = () => (
  <svg {...baseProps}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export const PaymentsIcon = () => (
  <svg {...baseProps}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

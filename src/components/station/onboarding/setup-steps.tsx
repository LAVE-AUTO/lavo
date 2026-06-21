import type { ReactNode } from 'react';
import type { SetupStepKey } from './useStationSetupStatus';

export interface SetupStepMeta {
  key: SetupStepKey;
  /** Deep link to the screen where this step is configured. */
  href: string;
  icon: ReactNode;
}

const PhotoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
  </svg>
);
const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const PostIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const ServiceIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 17l2-7h14l2 7" /><path d="M5 17v2h2v-2M17 17v2h2v-2" /><path d="M8 10V7a1 1 0 011-1h6a1 1 0 011 1v3" />
  </svg>
);
const PaymentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

/** Ordered onboarding steps shared by the dashboard checklist and the reminder banner. */
export const SETUP_STEPS: SetupStepMeta[] = [
  { key: 'photos', href: '/station/config?tab=commerce', icon: <PhotoIcon /> },
  { key: 'hours', href: '/station/config?tab=hours', icon: <ClockIcon /> },
  { key: 'posts', href: '/station/config?tab=capacity', icon: <PostIcon /> },
  { key: 'services', href: '/station/services', icon: <ServiceIcon /> },
  { key: 'payment', href: '/station/config?tab=payments', icon: <PaymentIcon /> },
];

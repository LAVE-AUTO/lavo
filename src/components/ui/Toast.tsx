'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useToast, type ToastType } from '@/context/toast-context';

const DEFAULT_DURATION = 4000;

function SuccessIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#00C851" opacity="0.15" />
      <path d="M9 12l2 2 4-4" stroke="#00C851" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="10" stroke="#00C851" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#391C01" opacity="0.15" />
      <path d="M15 9l-6 6M9 9l6 6" stroke="#391C01" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="10" stroke="#391C01" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L2 20h20L12 2z" fill="#F59E0B" opacity="0.15" />
      <path d="M12 2L2 20h20L12 2z" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <line x1="12" y1="9" x2="12" y2="13" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="#F59E0B" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#3B82F6" opacity="0.15" />
      <circle cx="12" cy="12" r="10" stroke="#3B82F6" strokeWidth="1.5" fill="none" />
      <line x1="12" y1="11" x2="12" y2="16" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1" fill="#3B82F6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

const ICONS: Record<ToastType, () => ReactElement> = {
  success: SuccessIcon,
  error:   ErrorIcon,
  warning: WarningIcon,
  info:    InfoIcon,
};

const ACCENT_COLORS: Record<ToastType, string> = {
  success: '#00C851',
  error:   '#391C01',
  warning: '#F59E0B',
  info:    '#3B82F6',
};

/**
 * Toast notification.
 * Mobile: slides down from top-center.
 * Desktop (sm+): slides in from the right side.
 */
export function Toast() {
  const { currentToast, dismiss } = useToast();
  const [phase, setPhase] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');

  useEffect(() => {
    if (currentToast) {
      setPhase('entering');
      const id = setTimeout(() => setPhase('visible'), 20);
      return () => clearTimeout(id);
    } else {
      if (phase !== 'hidden') {
        setPhase('exiting');
        const id = setTimeout(() => setPhase('hidden'), 300);
        return () => clearTimeout(id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentToast]);

  const handleDismiss = () => {
    setPhase('exiting');
    setTimeout(dismiss, 300);
  };

  if (phase === 'hidden') return null;

  const Icon   = ICONS[currentToast?.type || 'info'];
  const accent = ACCENT_COLORS[currentToast?.type || 'info'];
  const duration = currentToast?.duration || DEFAULT_DURATION;

  const isEntering = phase === 'entering';
  const isExiting  = phase === 'exiting';

  return (
    <>
      {/* Mobile: top-center, slide from top */}
      <div
        className="sm:hidden fixed top-0 left-0 right-0 z-[70] flex justify-center px-4"
        style={{ paddingTop: '16px' }}
      >
        <div
          role="alert"
          aria-live="polite"
          className="w-full max-w-md"
          style={{
            animation: isExiting
              ? 'toast-exit-top 0.28s ease-in both'
              : 'toast-enter-top 0.32s ease-out both',
          }}
        >
          <ToastCard
            Icon={Icon}
            accent={accent}
            message={currentToast?.message ?? ''}
            duration={duration}
            onDismiss={handleDismiss}
            isExiting={isExiting || isEntering}
          />
        </div>
      </div>

      {/* Desktop: bottom-right (or top-right), slide from right */}
      <div
        className="hidden sm:block fixed bottom-6 right-6 z-[70] w-full max-w-[360px]"
      >
        <div
          role="alert"
          aria-live="polite"
          style={{
            animation: isExiting
              ? 'toast-exit-right 0.28s ease-in both'
              : 'toast-enter-right 0.32s ease-out both',
          }}
        >
          <ToastCard
            Icon={Icon}
            accent={accent}
            message={currentToast?.message ?? ''}
            duration={duration}
            onDismiss={handleDismiss}
            isExiting={isExiting || isEntering}
          />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Internal card                                                        */
/* ------------------------------------------------------------------ */

interface ToastCardProps {
  Icon: () => ReactElement;
  accent: string;
  message: string;
  duration: number;
  onDismiss: () => void;
  isExiting: boolean;
}

function ToastCard({ Icon, accent, message, duration, onDismiss }: ToastCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-2xl backdrop-blur-sm border"
      style={{
        background:   'var(--toast-bg, rgba(255,255,255,0.97))',
        borderColor:  `${accent}25`,
        boxShadow:    `0 8px 32px -4px rgba(0,0,0,0.14), 0 2px 8px -2px rgba(0,0,0,0.08), 0 0 0 1px ${accent}18`,
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{ background: accent }}
      />

      {/* Content */}
      <div className="flex items-start gap-3 pl-5 pr-3 py-3.5">
        <div className="shrink-0 mt-0.5">
          <Icon />
        </div>
        <p
          className="flex-1 text-[14px] font-medium leading-snug"
          style={{ color: 'var(--toast-text, #001201)' }}
        >
          {message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          style={{ color: 'var(--toast-close, #999)' }}
          aria-label="Fermer"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] w-full" style={{ background: `${accent}18` }}>
        <div
          className="h-full rounded-full"
          style={{
            background: accent,
            animation:  `toast-progress ${duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

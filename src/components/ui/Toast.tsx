'use client';

import { useToast } from '@/context/toast-context';

const typeStyles = {
  success: 'bg-green-600 text-white dark:bg-green-500',
  error: 'bg-red-600 text-white dark:bg-red-500',
  warning: 'bg-amber-600 text-white dark:bg-amber-500',
  info: 'bg-blue-600 text-white dark:bg-blue-500',
};

/**
 * Renders the current toast from ToastContext.
 * Place inside ToastProvider (e.g. via Providers in layout).
 */
export function Toast() {
  const { currentToast, dismiss } = useToast();

  if (!currentToast) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg px-4 py-3 shadow-lg transition-opacity"
      aria-live="polite"
    >
      <div
        className={`rounded-lg px-4 py-3 ${typeStyles[currentToast.type]}`}
        onClick={dismiss}
      >
        <p className="text-sm font-medium">{currentToast.message}</p>
      </div>
    </div>
  );
}

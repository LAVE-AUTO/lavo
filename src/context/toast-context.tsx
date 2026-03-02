'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  currentToast: Toast | null;
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [currentToast, setCurrentToast] = useState<Toast | null>(null);

  const dismiss = useCallback(() => {
    setCurrentToast(null);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration = DEFAULT_DURATION) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setCurrentToast({ id, message, type, duration });
    },
    []
  );

  useEffect(() => {
    if (!currentToast || !currentToast.duration || currentToast.duration <= 0) return;
    const timer = setTimeout(() => setCurrentToast(null), currentToast.duration);
    return () => clearTimeout(timer);
  }, [currentToast]);

  const toast = useCallback(
    (message: string, type: ToastType = 'info', duration?: number) => {
      showToast(message, type, duration ?? DEFAULT_DURATION);
    },
    [showToast]
  );

  const success = useCallback(
    (message: string, duration?: number) => {
      showToast(message, 'success', duration ?? DEFAULT_DURATION);
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => {
      showToast(message, 'error', duration ?? DEFAULT_DURATION);
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => {
      showToast(message, 'warning', duration ?? DEFAULT_DURATION);
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => {
      showToast(message, 'info', duration ?? DEFAULT_DURATION);
    },
    [showToast]
  );

  const value: ToastContextValue = {
    toast,
    success,
    error,
    warning,
    info,
    currentToast,
    dismiss,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === undefined) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

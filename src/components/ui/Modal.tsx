'use client';

import { useEffect, type ReactNode } from 'react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Content rendered inside the modal body. */
  children?: ReactNode;
  /** Content rendered in the modal footer (e.g. action buttons). */
  footer?: ReactNode;
  /** Width preset (default: 'md'). */
  size?: ModalSize;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

/**
 * Accessible modal dialog with backdrop, Escape-to-close, and body-scroll lock.
 *
 * @param open    - Controls visibility
 * @param onClose - Called when backdrop is clicked or Escape is pressed
 * @param title   - Optional heading shown in the modal header
 * @param footer  - Optional footer slot for action buttons
 * @param size    - Width preset: sm | md | lg | xl (default: md)
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  /* Lock body scroll while modal is open */
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  /* Close on Escape key */
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const labelId = title ? 'modal-title' : undefined;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      aria-hidden="true"
    >
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className={[
          'relative w-full bg-white dark:bg-surface rounded-[10px] shadow-xl',
          'flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-up',
          SIZE_CLASSES[size],
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#CCCCCC] dark:border-border shrink-0">
            <h2
              id={labelId}
              className="text-[17px] font-bold text-[#001201] dark:text-white"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="text-Hurryline-muted hover:text-[#001201] dark:hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-4 py-4 border-t border-[#CCCCCC] dark:border-border shrink-0 sm:px-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

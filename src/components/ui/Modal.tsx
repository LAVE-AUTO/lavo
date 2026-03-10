import type { ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  title?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, children, footer }: ModalProps) {
  if (!open) return null;

  const labelledBy = title ? 'modal-title' : undefined;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      {title && <h2 id={labelledBy}>{title}</h2>}
      <div>{children}</div>
      {footer && <div>{footer}</div>}
    </div>
  );
}


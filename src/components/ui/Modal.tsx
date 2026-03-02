import type { ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  title?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, children, footer }: ModalProps) {
  if (!open) return null;

  return (
    <div>
      {title && <h2>{title}</h2>}
      <div>{children}</div>
      {footer && <div>{footer}</div>}
    </div>
  );
}


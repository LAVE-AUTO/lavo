import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

export function Button({ children, type, ...props }: ButtonProps) {
  return (
    <button type={type ?? 'button'} {...props}>
      {children}
    </button>
  );
}


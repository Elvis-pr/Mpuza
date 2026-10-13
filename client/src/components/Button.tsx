import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

/**
 * Friendly, rounded, delightfullyAnimated button.
 * Uses CSS classes so the button inherits the global button style.
 */
export const Button = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

export const Badge = ({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span className={`badge ${className}`} {...rest}>
      {children}
    </span>
  );
};

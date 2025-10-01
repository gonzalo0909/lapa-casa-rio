// lapa-casa-hostel/frontend/src/components/ui/button.tsx

'use client';

import * as React from 'react';

/**
 * Button Component - Lapa Casa Hostel
 * 
 * Production-ready button with multiple variants, sizes, and states.
 * Optimized for booking flow and payment interactions.
 * 
 * @component
 * @example
 * <Button variant="primary" size="lg" onClick={handleBooking}>
 *   Reservar Agora
 * </Button>
 */

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'outline' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white shadow-md hover:bg-blue-700 focus-visible:ring-blue-500 active:bg-blue-800',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500 active:bg-gray-300',
  success: 'bg-green-600 text-white shadow-md hover:bg-green-700 focus-visible:ring-green-500 active:bg-green-800',
  danger: 'bg-red-600 text-white shadow-md hover:bg-red-700 focus-visible:ring-red-500 active:bg-red-800',
  warning: 'bg-yellow-500 text-white shadow-md hover:bg-yellow-600 focus-visible:ring-yellow-500 active:bg-yellow-700',
  outline: 'border-2 border-gray-300 bg-transparent hover:bg-gray-50 focus-visible:ring-gray-500 active:bg-gray-100',
  ghost: 'bg-transparent hover:bg-gray-100 focus-visible:ring-gray-500 active:bg-gray-200',
  link: 'bg-transparent text-blue-600 underline-offset-4 hover:underline focus-visible:ring-blue-500',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 py-2 text-sm',
  md: 'h-11 px-4 py-2.5 text-base',
  lg: 'h-12 px-6 py-3 text-lg',
  xl: 'h-14 px-8 py-4 text-xl',
  icon: 'h-10 w-10 p-0',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual style variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Full width button */
  fullWidth?: boolean;
  /** Loading state shows spinner */
  isLoading?: boolean;
  /** Icon to display before text */
  leftIcon?: React.ReactNode;
  /** Icon to display after text */
  rightIcon?: React.ReactNode;
  /** Accessible label for loading state */
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      loadingText,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95';
    
    const widthStyle = fullWidth ? 'w-full' : 'w-auto';
    
    const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`;

    return (
      <button
        ref={ref}
        type={type}
        className={combinedClassName}
        disabled={isDisabled}
        aria-busy={isLoading}
        aria-label={isLoading && loadingText ? loadingText : undefined}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {loadingText && <span>{loadingText}</span>}
          </>
        ) : (
          <>
            {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
            {children}
            {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };

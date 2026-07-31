// lapa-casa-hostel/frontend/src/components/ui/badge.tsx

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Badge Component - Lapa Casa Hostel
 * 
 * Status indicator and label component with multiple variants.
 * Optimized for availability status, discounts, and notifications.
 * 
 * @component
 * @example
 * <Badge variant="success">Disponível</Badge>
 * <Badge variant="warning">Últimas Vagas</Badge>
 * <Badge variant="info">-20% Grupo</Badge>
 */

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800 border border-gray-300',
        primary: 'bg-blue-100 text-blue-800 border border-blue-300',
        secondary: 'bg-gray-600 text-white',
        success: 'bg-green-100 text-green-800 border border-green-300',
        danger: 'bg-red-100 text-red-800 border border-red-300',
        warning: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
        info: 'bg-cyan-100 text-cyan-800 border border-cyan-300',
        outline: 'bg-transparent border border-gray-300 text-gray-700',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
        lg: 'px-3 py-1.5 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Icon displayed before text */
  icon?: React.ReactNode;
  /** Make badge dismissible */
  onDismiss?: () => void;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant,
      size,
      icon,
      onDismiss,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={badgeVariants({ variant, size, className })}
        {...props}
      >
        {icon && (
          <span className="inline-flex items-center" aria-hidden="true">
            {icon}
          </span>
        )}
        {children}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center justify-center ml-1 -mr-1 h-4 w-4 rounded-full hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-offset-1"
            aria-label="Remover badge"
          >
            <svg
              className="h-3 w-3"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
              />
            </svg>
          </button>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };

// lapa-casa-hostel/frontend/src/components/ui/loading-spinner.tsx

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * LoadingSpinner Component - Lapa Casa Hostel
 * 
 * Animated loading indicator with multiple sizes and variants.
 * Optimized for async operations, payment processing, and data fetching.
 * 
 * @component
 * @example
 * <LoadingSpinner size="lg" />
 * <LoadingSpinner variant="overlay" text="Processando pagamento..." />
 */

const spinnerVariants = cva(
  'inline-block animate-spin rounded-full border-solid border-current border-r-transparent',
  {
    variants: {
      size: {
        xs: 'h-3 w-3 border-2',
        sm: 'h-4 w-4 border-2',
        md: 'h-6 w-6 border-2',
        lg: 'h-8 w-8 border-3',
        xl: 'h-12 w-12 border-4',
      },
      color: {
        primary: 'text-blue-600',
        secondary: 'text-gray-600',
        white: 'text-white',
        current: 'text-current',
      },
    },
    defaultVariants: {
      size: 'md',
      color: 'primary',
    },
  }
);

export interface LoadingSpinnerProps
  extends VariantProps<typeof spinnerVariants> {
  /** Loading text displayed below spinner */
  text?: string;
  /** Center spinner in container */
  centered?: boolean;
  /** Show as full-page overlay */
  variant?: 'inline' | 'overlay';
  /** Additional className */
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size,
  color,
  text,
  centered = false,
  variant = 'inline',
  className,
}) => {
  const spinner = (
    <div
      className={`flex flex-col items-center gap-3 ${centered ? 'justify-center' : ''} ${className || ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={spinnerVariants({ size, color })}
        aria-hidden="true"
      />
      {text && (
        <p className="text-sm text-gray-600 font-medium">
          {text}
        </p>
      )}
      <span className="sr-only">Carregando...</span>
    </div>
  );

  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
};

LoadingSpinner.displayName = 'LoadingSpinner';

// Loading Dots Component (alternative style)
export interface LoadingDotsProps {
  /** Size of dots */
  size?: 'sm' | 'md' | 'lg';
  /** Dot color */
  color?: 'primary' | 'secondary' | 'white';
}

const LoadingDots: React.FC<LoadingDotsProps> = ({
  size = 'md',
  color = 'primary',
}) => {
  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
  };

  const colorClasses = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    white: 'bg-white',
  };

  return (
    <div className="flex items-center gap-1" role="status" aria-live="polite">
      <div
        className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-bounce`}
        style={{ animationDelay: '0ms' }}
        aria-hidden="true"
      />
      <div
        className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-bounce`}
        style={{ animationDelay: '150ms' }}
        aria-hidden="true"
      />
      <div
        className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-bounce`}
        style={{ animationDelay: '300ms' }}
        aria-hidden="true"
      />
      <span className="sr-only">Carregando...</span>
    </div>
  );
};

LoadingDots.displayName = 'LoadingDots';

// Loading Bar Component (progress indicator)
export interface LoadingBarProps {
  /** Current progress (0-100) */
  progress?: number;
  /** Show progress as indeterminate */
  indeterminate?: boolean;
  /** Bar color */
  color?: 'primary' | 'success' | 'warning';
  /** Bar height */
  height?: 'sm' | 'md' | 'lg';
}

const LoadingBar: React.FC<LoadingBarProps> = ({
  progress = 0,
  indeterminate = false,
  color = 'primary',
  height = 'md',
}) => {
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colorClasses = {
    primary: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
  };

  return (
    <div
      className={`w-full bg-gray-200 rounded-full overflow-hidden ${heightClasses[height]}`}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`${heightClasses[height]} ${colorClasses[color]} rounded-full transition-all duration-300 ${
          indeterminate ? 'animate-pulse w-full' : ''
        }`}
        style={{ width: indeterminate ? '100%' : `${progress}%` }}
      />
    </div>
  );
};

LoadingBar.displayName = 'LoadingBar';

export { LoadingSpinner, LoadingDots, LoadingBar, spinnerVariants };

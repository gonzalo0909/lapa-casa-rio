// lapa-casa-hostel/frontend/src/components/ui/input.tsx

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Input Component - Lapa Casa Hostel
 * 
 * Accessible form input with validation states, icons, and helper text.
 * Optimized for guest information and booking forms.
 * 
 * @component
 * @example
 * <Input
 *   label="Email"
 *   type="email"
 *   error="Email inválido"
 *   leftIcon={<MailIcon />}
 * />
 */

const inputVariants = cva(
  'flex w-full rounded-lg border bg-white px-3 py-2 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 
          'border-gray-300 focus-visible:border-blue-500 focus-visible:ring-blue-500',
        error: 
          'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500',
        success: 
          'border-green-500 focus-visible:border-green-500 focus-visible:ring-green-500',
      },
      inputSize: {
        sm: 'h-9 text-sm',
        md: 'h-11 text-base',
        lg: 'h-12 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'md',
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  /** Label text displayed above input */
  label?: string;
  /** Error message displayed below input */
  error?: string;
  /** Helper text displayed below input */
  helperText?: string;
  /** Icon displayed on left side */
  leftIcon?: React.ReactNode;
  /** Icon displayed on right side */
  rightIcon?: React.ReactNode;
  /** Show character counter */
  showCounter?: boolean;
  /** Container className */
  containerClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      inputSize,
      type = 'text',
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      showCounter,
      maxLength,
      value,
      containerClassName,
      id,
      required,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || React.useId();
    const hasError = !!error;
    const currentVariant = hasError ? 'error' : variant;
    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div className={`flex flex-col gap-1.5 ${containerClassName || ''}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700"
          >
            {label}
            {required && (
              <span className="ml-1 text-red-500" aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            maxLength={maxLength}
            value={value}
            disabled={disabled}
            className={inputVariants({
              variant: currentVariant,
              inputSize,
              className: `${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${className || ''}`,
            })}
            aria-invalid={hasError}
            aria-describedby={
              hasError
                ? `${inputId}-error`
                : helperText
                ? `${inputId}-helper`
                : undefined
            }
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>

        {(error || helperText || showCounter) && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              {error && (
                <p
                  id={`${inputId}-error`}
                  className="text-sm text-red-600"
                  role="alert"
                >
                  {error}
                </p>
              )}
              {!error && helperText && (
                <p
                  id={`${inputId}-helper`}
                  className="text-sm text-gray-500"
                >
                  {helperText}
                </p>
              )}
            </div>

            {showCounter && maxLength && (
              <span
                className={`text-xs ${
                  currentLength > maxLength * 0.9
                    ? 'text-yellow-600'
                    : 'text-gray-400'
                }`}
                aria-live="polite"
              >
                {currentLength}/{maxLength}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input, inputVariants };

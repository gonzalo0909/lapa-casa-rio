// lapa-casa-hostel/frontend/src/components/ui/select.tsx

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Select Component - Lapa Casa Hostel
 * 
 * Accessible dropdown selector with validation states and custom styling.
 * Optimized for room selection, guest count, and date filtering.
 * 
 * @component
 * @example
 * <Select
 *   label="Tipo de Quarto"
 *   options={roomTypes}
 *   value={selectedRoom}
 *   onChange={handleRoomChange}
 * />
 */

const selectVariants = cva(
  'flex h-11 w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
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
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof selectVariants> {
  /** Label text displayed above select */
  label?: string;
  /** Error message displayed below select */
  error?: string;
  /** Helper text displayed below select */
  helperText?: string;
  /** Array of select options */
  options: SelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Icon displayed on left side */
  leftIcon?: React.ReactNode;
  /** Container className */
  containerClassName?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      variant,
      label,
      error,
      helperText,
      options,
      placeholder = 'Selecione uma opção',
      leftIcon,
      containerClassName,
      id,
      required,
      disabled,
      ...props
    },
    ref
  ) => {
    const selectId = id || React.useId();
    const hasError = !!error;
    const currentVariant = hasError ? 'error' : variant;

    return (
      <div className={`flex flex-col gap-1.5 ${containerClassName || ''}`}>
        {label && (
          <label
            htmlFor={selectId}
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
            <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}

          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={selectVariants({
              variant: currentVariant,
              className: `${leftIcon ? 'pl-10' : ''} appearance-none cursor-pointer pr-10 ${className || ''}`,
            })}
            aria-invalid={hasError}
            aria-describedby={
              hasError
                ? `${selectId}-error`
                : helperText
                ? `${selectId}-helper`
                : undefined
            }
            {...props}
          >
            <option value="" disabled>
              {placeholder}
            </option>
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>

          {/* Custom dropdown arrow */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {(error || helperText) && (
          <div>
            {error && (
              <p
                id={`${selectId}-error`}
                className="text-sm text-red-600"
                role="alert"
              >
                {error}
              </p>
            )}
            {!error && helperText && (
              <p
                id={`${selectId}-helper`}
                className="text-sm text-gray-500"
              >
                {helperText}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select, selectVariants };

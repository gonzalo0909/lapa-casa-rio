// lapa-casa-hostel/frontend/src/components/ui/checkbox.tsx

import * as React from 'react';

/**
 * Checkbox Component - Lapa Casa
 *
 * Accessible checkbox with label and error state.
 * Used for consent/terms acceptance in the booking flow.
 *
 * @component
 * @example
 * <Checkbox label="Acepto los términos y condiciones" />
 */

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Label text displayed next to the checkbox */
  label?: React.ReactNode;
  /** Error message displayed below the checkbox */
  error?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, id, required, disabled, ...props }, ref) => {
    const generatedId = React.useId();
    const checkboxId = id || generatedId;
    const hasError = !!error;

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${checkboxId}-error` : undefined}
            className={`mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              hasError ? 'border-destructive' : ''
            } ${className || ''}`}
            {...props}
          />
          {label && (
            <label htmlFor={checkboxId} className="text-sm text-foreground">
              {label}
              {required && (
                <span className="ml-1 text-destructive" aria-label="required">
                  *
                </span>
              )}
            </label>
          )}
        </div>

        {error && (
          <p id={`${checkboxId}-error`} className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };

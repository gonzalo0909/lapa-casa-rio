// lapa-casa-hostel/frontend/src/components/ui/textarea.tsx

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Textarea Component - Lapa Casa Hostel
 * 
 * Multi-line text input with auto-resize, character counter, and validation.
 * Optimized for special requests and additional notes in booking forms.
 * 
 * @component
 * @example
 * <Textarea
 *   label="Pedidos Especiais"
 *   placeholder="Descreva suas necessidades..."
 *   maxLength={500}
 *   showCounter
 * />
 */

const textareaVariants = cva(
  'flex min-h-[80px] w-full rounded-lg border bg-white px-3 py-2 text-base transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 resize-y',
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

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  /** Label text displayed above textarea */
  label?: string;
  /** Error message displayed below textarea */
  error?: string;
  /** Helper text displayed below textarea */
  helperText?: string;
  /** Show character counter */
  showCounter?: boolean;
  /** Auto-resize based on content */
  autoResize?: boolean;
  /** Container className */
  containerClassName?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      variant,
      label,
      error,
      helperText,
      showCounter,
      autoResize = false,
      maxLength,
      value,
      containerClassName,
      id,
      required,
      disabled,
      onChange,
      ...props
    },
    ref
  ) => {
    const textareaId = id || React.useId();
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const hasError = !!error;
    const currentVariant = hasError ? 'error' : variant;
    const currentLength = typeof value === 'string' ? value.length : 0;

    // Auto-resize functionality
    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (textarea && autoResize) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, [autoResize]);

    React.useEffect(() => {
      if (autoResize) {
        adjustHeight();
      }
    }, [value, autoResize, adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize) {
        adjustHeight();
      }
      onChange?.(e);
    };

    const handleRef = (node: HTMLTextAreaElement) => {
      textareaRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return (
      <div className={`flex flex-col gap-1.5 ${containerClassName || ''}`}>
        {label && (
          <label
            htmlFor={textareaId}
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

        <textarea
          ref={handleRef}
          id={textareaId}
          maxLength={maxLength}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          className={textareaVariants({
            variant: currentVariant,
            className,
          })}
          aria-invalid={hasError}
          aria-describedby={
            hasError
              ? `${textareaId}-error`
              : helperText
              ? `${textareaId}-helper`
              : undefined
          }
          {...props}
        />

        {(error || helperText || showCounter) && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              {error && (
                <p
                  id={`${textareaId}-error`}
                  className="text-sm text-red-600"
                  role="alert"
                >
                  {error}
                </p>
              )}
              {!error && helperText && (
                <p
                  id={`${textareaId}-helper`}
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

Textarea.displayName = 'Textarea';

export { Textarea, textareaVariants };

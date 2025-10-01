// lapa-casa-hostel/frontend/src/components/ui/alert.tsx

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Alert Component - Lapa Casa Hostel
 * 
 * Feedback component for displaying important messages to users.
 * Optimized for booking confirmations, errors, and system notifications.
 * 
 * @component
 * @example
 * <Alert variant="success">
 *   <AlertTitle>Reserva Confirmada!</AlertTitle>
 *   <AlertDescription>
 *     Você receberá um email de confirmação em breve.
 *   </AlertDescription>
 * </Alert>
 */

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:pl-8',
  {
    variants: {
      variant: {
        default: 'bg-gray-50 border-gray-200 text-gray-900 [&>svg]:text-gray-600',
        info: 'bg-blue-50 border-blue-200 text-blue-900 [&>svg]:text-blue-600',
        success: 'bg-green-50 border-green-200 text-green-900 [&>svg]:text-green-600',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-900 [&>svg]:text-yellow-600',
        danger: 'bg-red-50 border-red-200 text-red-900 [&>svg]:text-red-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** Icon displayed at start of alert */
  icon?: React.ReactNode;
  /** Make alert dismissible */
  onDismiss?: () => void;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon, onDismiss, children, ...props }, ref) => {
    const [isDismissed, setIsDismissed] = React.useState(false);

    const handleDismiss = () => {
      setIsDismissed(true);
      onDismiss?.();
    };

    if (isDismissed) return null;

    const defaultIcons = {
      default: (
        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
      ),
      info: (
        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
      ),
      success: (
        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
      ),
      warning: (
        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      ),
      danger: (
        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
        </svg>
      ),
    };

    const displayIcon = icon || (variant ? defaultIcons[variant] : defaultIcons.default);

    return (
      <div
        ref={ref}
        role="alert"
        className={alertVariants({ variant, className })}
        {...props}
      >
        {displayIcon}
        <div className="flex-1">
          {children}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-4 top-4 rounded-md p-1 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-2"
            aria-label="Fechar alerta"
          >
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

// Alert Title Component
const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={`mb-1 font-semibold leading-tight ${className || ''}`}
      {...props}
    />
  )
);

AlertTitle.displayName = 'AlertTitle';

// Alert Description Component
const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`text-sm leading-relaxed opacity-90 ${className || ''}`}
      {...props}
    />
  )
);

AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };

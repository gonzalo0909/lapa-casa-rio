// lapa-casa-hostel/frontend/src/components/ui/card.tsx

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Card Component - Lapa Casa Hostel
 * 
 * Flexible card container with header, body, and footer sections.
 * Optimized for room cards, booking summaries, and pricing displays.
 * 
 * @component
 * @example
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Mixto 12A</CardTitle>
 *     <CardDescription>12 camas - Quarto compartilhado</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Conteúdo do cartão</p>
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Reservar</Button>
 *   </CardFooter>
 * </Card>
 */

const cardVariants = cva(
  'rounded-xl border bg-white transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'border-gray-200 shadow-sm',
        elevated: 'border-transparent shadow-lg',
        outlined: 'border-gray-300 shadow-none',
        interactive: 'border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /** Make card clickable */
  onClick?: () => void;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, onClick, ...props }, ref) => {
    const isClickable = !!onClick;
    const currentVariant = isClickable && variant === 'default' ? 'interactive' : variant;

    return (
      <div
        ref={ref}
        className={cardVariants({ variant: currentVariant, padding, className })}
        onClick={onClick}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

// Card Header Component
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Add border bottom */
  bordered?: boolean;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, bordered = false, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-col gap-1.5 ${bordered ? 'border-b border-gray-200 pb-4' : ''} ${className || ''}`}
      {...props}
    />
  )
);

CardHeader.displayName = 'CardHeader';

// Card Title Component
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Title size */
  size?: 'sm' | 'md' | 'lg';
}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'text-lg',
      md: 'text-xl',
      lg: 'text-2xl',
    };

    return (
      <h3
        ref={ref}
        className={`font-semibold leading-tight text-gray-900 ${sizeClasses[size]} ${className || ''}`}
        {...props}
      />
    );
  }
);

CardTitle.displayName = 'CardTitle';

// Card Description Component
const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={`text-sm text-gray-500 ${className || ''}`}
      {...props}
    />
  )
);

CardDescription.displayName = 'CardDescription';

// Card Content Component
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`pt-4 ${className || ''}`}
      {...props}
    />
  )
);

CardContent.displayName = 'CardContent';

// Card Footer Component
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Add border top */
  bordered?: boolean;
}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, bordered = false, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex items-center pt-4 ${bordered ? 'border-t border-gray-200' : ''} ${className || ''}`}
      {...props}
    />
  )
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };

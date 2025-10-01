// lapa-casa-hostel/frontend/src/components/ui/skeleton.tsx

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Skeleton Component - Lapa Casa Hostel
 * 
 * Loading placeholder with shimmer animation for content that is being loaded.
 * Optimized for room cards, pricing displays, and booking summaries.
 * 
 * @component
 * @example
 * <Skeleton className="h-48 w-full" />
 * <SkeletonCard />
 * <SkeletonText lines={3} />
 */

const skeletonVariants = cva(
  'animate-pulse rounded-md bg-gray-200',
  {
    variants: {
      variant: {
        default: 'bg-gray-200',
        shimmer: 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer',
      },
    },
    defaultVariants: {
      variant: 'shimmer',
    },
  }
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={skeletonVariants({ variant, className })}
        role="status"
        aria-label="Carregando..."
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// Skeleton Text Component
export interface SkeletonTextProps {
  /** Number of text lines */
  lines?: number;
  /** Line spacing */
  spacing?: 'sm' | 'md' | 'lg';
  /** Last line width (percentage) */
  lastLineWidth?: number;
  /** Container className */
  className?: string;
}

const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  spacing = 'md',
  lastLineWidth = 60,
  className,
}) => {
  const spacingClasses = {
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
  };

  return (
    <div className={`flex flex-col ${spacingClasses[spacing]} ${className || ''}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`h-4 ${
            index === lines - 1 ? `w-[${lastLineWidth}%]` : 'w-full'
          }`}
        />
      ))}
    </div>
  );
};

SkeletonText.displayName = 'SkeletonText';

// Skeleton Card Component (Room Card)
export interface SkeletonCardProps {
  /** Show image skeleton */
  showImage?: boolean;
  /** Container className */
  className?: string;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({
  showImage = true,
  className,
}) => {
  return (
    <div className={`rounded-xl border border-gray-200 p-6 ${className || ''}`}>
      {showImage && (
        <Skeleton className="h-48 w-full mb-4 rounded-lg" />
      )}
      <div className="space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex items-center justify-between pt-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

SkeletonCard.displayName = 'SkeletonCard';

// Skeleton Avatar Component
export interface SkeletonAvatarProps {
  /** Avatar size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Shape of avatar */
  shape?: 'circle' | 'square';
}

const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({
  size = 'md',
  shape = 'circle',
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <Skeleton
      className={`${sizeClasses[size]} ${
        shape === 'circle' ? 'rounded-full' : 'rounded-md'
      }`}
    />
  );
};

SkeletonAvatar.displayName = 'SkeletonAvatar';

// Skeleton Table Component
export interface SkeletonTableProps {
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Show header */
  showHeader?: boolean;
}

const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  showHeader = true,
}) => {
  return (
    <div className="w-full space-y-3">
      {showHeader && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={`header-${index}`} className="h-8" />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-6" />
          ))}
        </div>
      ))}
    </div>
  );
};

SkeletonTable.displayName = 'SkeletonTable';

// Skeleton List Component
export interface SkeletonListProps {
  /** Number of list items */
  items?: number;
  /** Show avatar */
  showAvatar?: boolean;
}

const SkeletonList: React.FC<SkeletonListProps> = ({
  items = 3,
  showAvatar = true,
}) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-start gap-4">
          {showAvatar && <SkeletonAvatar size="md" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
};

SkeletonList.displayName = 'SkeletonList';

export { 
  Skeleton, 
  SkeletonText, 
  SkeletonCard, 
  SkeletonAvatar, 
  SkeletonTable,
  SkeletonList,
  skeletonVariants 
};

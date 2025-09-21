// lapa-casa-hostel-frontend/src/components/ui/skeleton.tsx

import * as React from "react"
import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "rounded" | "circular"
  animate?: boolean
  lines?: number
}

function Skeleton({ 
  className, 
  variant = "default", 
  animate = true,
  lines,
  ...props 
}: SkeletonProps) {
  const baseClasses = cn(
    "bg-muted",
    animate && "animate-pulse",
    {
      "rounded-md": variant === "default",
      "rounded-lg": variant === "rounded", 
      "rounded-full": variant === "circular"
    }
  )

  if (lines && lines > 1) {
    return (
      <div className={cn("space-y-2", className)} {...props}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              baseClasses,
              "h-4",
              index === lines - 1 && "w-4/5" // Última línea más corta
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(baseClasses, className)}
      {...props}
    />
  )
}

// Skeletons específicos para componentes del hostel
const RoomCardSkeleton = () => (
  <div className="space-y-4 p-4 border rounded-lg">
    <Skeleton className="h-48 w-full rounded-lg" />
    <div className="space-y-2">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  </div>
)

const BookingFormSkeleton = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-full" />
    </div>
    <Skeleton className="h-10 w-full rounded-md" />
  </div>
)

const PricingSkeleton = () => (
  <div className="space-y-4 p-4 border rounded-lg">
    <Skeleton className="h-6 w-32" />
    <div className="space-y-2">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-18" />
      </div>
    </div>
    <hr />
    <div className="flex justify-between items-center">
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-6 w-24" />
    </div>
  </div>
)

const CalendarSkeleton = () => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <Skeleton className="h-6 w-32" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8 rounded" variant="circular" />
        <Skeleton className="h-8 w-8 rounded" variant="circular" />
      </div>
    </div>
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 35 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" variant="rounded" />
      ))}
    </div>
  </div>
)

const AvailabilityGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className="space-y-3 p-4 border rounded-lg">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" variant="circular" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-4 w-16" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-2 w-3/4" />
        </div>
      </div>
    ))}
  </div>
)

const BookingListSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
        <Skeleton className="h-12 w-12" variant="circular" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="text-right space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    ))}
  </div>
)

export { 
  Skeleton, 
  RoomCardSkeleton,
  BookingFormSkeleton,
  PricingSkeleton,
  CalendarSkeleton,
  AvailabilityGridSkeleton,
  BookingListSkeleton
}

// lapa-casa-hostel-frontend/src/components/ui/badge.tsx

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-green-100 text-green-800 hover:bg-green-200",
        warning:
          "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
        info:
          "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200",
        available:
          "border-transparent bg-green-100 text-green-800",
        occupied:
          "border-transparent bg-red-100 text-red-800",
        pending:
          "border-transparent bg-orange-100 text-orange-800",
        confirmed:
          "border-transparent bg-emerald-100 text-emerald-800",
        cancelled:
          "border-transparent bg-gray-100 text-gray-800",
        high_season:
          "border-transparent bg-purple-100 text-purple-800",
        low_season:
          "border-transparent bg-blue-100 text-blue-800",
        carnival:
          "border-transparent bg-gradient-to-r from-yellow-400 to-orange-500 text-white"
      },
      size: {
        default: "text-xs px-2.5 py-0.5",
        sm: "text-xs px-2 py-0.5 rounded-md",
        lg: "text-sm px-3 py-1 rounded-lg",
        xl: "text-base px-4 py-1.5 rounded-lg"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  dot?: boolean
  pulse?: boolean
}

function Badge({ 
  className, 
  variant, 
  size, 
  leftIcon, 
  rightIcon, 
  dot, 
  pulse,
  children, 
  ...props 
}: BadgeProps) {
  return (
    <div 
      className={cn(
        badgeVariants({ variant, size }), 
        pulse && "animate-pulse",
        className
      )} 
      {...props}
    >
      {dot && (
        <span className={cn(
          "mr-1 h-2 w-2 rounded-full",
          variant === "success" && "bg-green-600",
          variant === "warning" && "bg-yellow-600", 
          variant === "destructive" && "bg-red-600",
          variant === "info" && "bg-blue-600",
          variant === "available" && "bg-green-600",
          variant === "occupied" && "bg-red-600",
          variant === "pending" && "bg-orange-600",
          variant === "confirmed" && "bg-emerald-600",
          !variant && "bg-current"
        )} />
      )}
      
      {leftIcon && (
        <span className="mr-1">{leftIcon}</span>
      )}
      
      {children}
      
      {rightIcon && (
        <span className="ml-1">{rightIcon}</span>
      )}
    </div>
  )
}

export { Badge, badgeVariants }

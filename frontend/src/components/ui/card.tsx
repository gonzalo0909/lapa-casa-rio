// lapa-casa-hostel-frontend/src/components/ui/card.tsx

import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "elevated" | "outlined" | "filled"
    padding?: "none" | "sm" | "default" | "lg"
    hover?: boolean
  }
>(({ className, variant = "default", padding = "default", hover = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground",
      {
        "border shadow-sm": variant === "default",
        "border shadow-lg": variant === "elevated", 
        "border-2 shadow-none": variant === "outlined",
        "border-0 bg-muted shadow-none": variant === "filled",
      },
      {
        "p-0": padding === "none",
        "p-4": padding === "sm",
        "p-6": padding === "default",
        "p-8": padding === "lg",
      },
      hover && "transition-all duration-200 hover:shadow-md hover:scale-105",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    centered?: boolean
  }
>(({ className, centered = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-1.5 p-6",
      centered && "text-center items-center",
      className
    )}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & {
    size?: "sm" | "default" | "lg" | "xl"
    as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
  }
>(({ className, size = "default", as: Comp = "h3", ...props }, ref) => {
  const sizeClasses = {
    sm: "text-lg font-semibold",
    default: "text-2xl font-semibold",
    lg: "text-3xl font-bold",
    xl: "text-4xl font-bold"
  }

  return (
    <Comp
      ref={ref}
      className={cn(
        "leading-none tracking-tight",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
})
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & {
    size?: "sm" | "default" | "lg"
  }
>(({ className, size = "default", ...props }, ref) => {
  const sizeClasses = {
    sm: "text-sm",
    default: "text-sm",
    lg: "text-base"
  }

  return (
    <p
      ref={ref}
      className={cn(
        "text-muted-foreground",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
})
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    padding?: "none" | "sm" | "default" | "lg"
  }
>(({ className, padding = "default", ...props }, ref) => {
  const paddingClasses = {
    none: "p-0",
    sm: "p-4 pt-0",
    default: "p-6 pt-0", 
    lg: "p-8 pt-0"
  }

  return (
    <div 
      ref={ref} 
      className={cn(paddingClasses[padding], className)} 
      {...props} 
    />
  )
})
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    justify?: "start" | "center" | "end" | "between"
    padding?: "none" | "sm" | "default" | "lg"
  }
>(({ className, justify = "start", padding = "default", ...props }, ref) => {
  const justifyClasses = {
    start: "justify-start",
    center: "justify-center", 
    end: "justify-end",
    between: "justify-between"
  }

  const paddingClasses = {
    none: "p-0",
    sm: "p-4 pt-0",
    default: "p-6 pt-0",
    lg: "p-8 pt-0"
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center",
        justifyClasses[justify],
        paddingClasses[padding],
        className
      )}
      {...props}
    />
  )
})
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

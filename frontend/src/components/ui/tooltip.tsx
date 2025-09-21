// lapa-casa-hostel-frontend/src/components/ui/tooltip.tsx

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    variant?: "default" | "dark" | "light"
    size?: "sm" | "default" | "lg"
  }
>(({ className, sideOffset = 4, variant = "default", size = "default", ...props }, ref) => {
  const variantClasses = {
    default: "bg-primary text-primary-foreground",
    dark: "bg-gray-900 text-white border border-gray-800",
    light: "bg-white text-gray-900 border border-gray-200 shadow-lg"
  }

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    default: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base"
  }

  return (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md border animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
})
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Componente simplificado para uso común
interface SimpleTooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  variant?: "default" | "dark" | "light"
  size?: "sm" | "default" | "lg"
  disabled?: boolean
  delayDuration?: number
}

const SimpleTooltip = ({ 
  content, 
  children, 
  side = "top", 
  variant = "default",
  size = "default",
  disabled = false,
  delayDuration = 200 
}: SimpleTooltipProps) => {
  if (disabled || !content) {
    return <>{children}</>
  }

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side={side} variant={variant} size={size}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { 
  Tooltip, 
  TooltipTrigger, 
  TooltipContent, 
  TooltipProvider,
  SimpleTooltip 
}

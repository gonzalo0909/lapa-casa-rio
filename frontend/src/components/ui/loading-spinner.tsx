// lapa-casa-hostel-frontend/src/components/ui/loading-spinner.tsx

import * as React from "react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg" | "xl"
  variant?: "default" | "dots" | "pulse" | "bounce"
  text?: string
  fullScreen?: boolean
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size = "default", variant = "default", text, fullScreen = false, ...props }, ref) => {
    const sizeClasses = {
      sm: "h-4 w-4",
      default: "h-6 w-6",
      lg: "h-8 w-8", 
      xl: "h-12 w-12"
    }

    const renderSpinner = () => {
      switch (variant) {
        case "dots":
          return (
            <div className="flex space-x-1">
              <div className={cn("rounded-full bg-current animate-pulse", 
                size === "sm" ? "h-1 w-1" : size === "lg" ? "h-2 w-2" : "h-1.5 w-1.5"
              )} style={{ animationDelay: "0ms" }} />
              <div className={cn("rounded-full bg-current animate-pulse",
                size === "sm" ? "h-1 w-1" : size === "lg" ? "h-2 w-2" : "h-1.5 w-1.5"
              )} style={{ animationDelay: "150ms" }} />
              <div className={cn("rounded-full bg-current animate-pulse",
                size === "sm" ? "h-1 w-1" : size === "lg" ? "h-2 w-2" : "h-1.5 w-1.5"  
              )} style={{ animationDelay: "300ms" }} />
            </div>
          )
        
        case "pulse":
          return (
            <div className={cn("rounded-full bg-current animate-pulse", sizeClasses[size])} />
          )
        
        case "bounce":
          return (
            <div className="flex space-x-1">
              <div className={cn("rounded-full bg-current animate-bounce", 
                size === "sm" ? "h-2 w-2" : size === "lg" ? "h-3 w-3" : "h-2.5 w-2.5"
              )} style={{ animationDelay: "0ms" }} />
              <div className={cn("rounded-full bg-current animate-bounce",
                size === "sm" ? "h-2 w-2" : size === "lg" ? "h-3 w-3" : "h-2.5 w-2.5"
              )} style={{ animationDelay: "150ms" }} />
              <div className={cn("rounded-full bg-current animate-bounce",
                size === "sm" ? "h-2 w-2" : size === "lg" ? "h-3 w-3" : "h-2.5 w-2.5"
              )} style={{ animationDelay: "300ms" }} />
            </div>
          )
        
        default:
          return (
            <svg
              className={cn("animate-spin", sizeClasses[size])}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )
      }
    }

    const content = (
      <div className={cn("flex items-center justify-center", text && "gap-3")}>
        {renderSpinner()}
        {text && (
          <span className={cn(
            "text-muted-foreground",
            size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base"
          )}>
            {text}
          </span>
        )}
      </div>
    )

    if (fullScreen) {
      return (
        <div
          ref={ref}
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
            className
          )}
          {...props}
        >
          {content}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn("flex items-center justify-center", className)}
        {...props}
      >
        {content}
      </div>
    )
  }
)
LoadingSpinner.displayName = "LoadingSpinner"

// Componente específico para estados de carga de booking
const BookingLoader = ({ message = "Procesando reserva..." }: { message?: string }) => (
  <LoadingSpinner 
    size="lg" 
    variant="default" 
    text={message}
    className="p-8"
  />
)

// Componente para carga de página completa
const PageLoader = ({ message = "Cargando..." }: { message?: string }) => (
  <LoadingSpinner 
    size="xl" 
    variant="default" 
    text={message}
    fullScreen
  />
)

export { LoadingSpinner, BookingLoader, PageLoader }

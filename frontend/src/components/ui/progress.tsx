// lapa-casa-hostel-frontend/src/components/ui/progress.tsx

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  variant?: "default" | "success" | "warning" | "error"
  size?: "sm" | "default" | "lg"
  showValue?: boolean
  label?: string
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value = 0, variant = "default", size = "default", showValue = false, label, ...props }, ref) => {
  const sizeClasses = {
    sm: "h-2",
    default: "h-3",
    lg: "h-4"
  }

  const variantClasses = {
    default: "bg-primary",
    success: "bg-green-500",
    warning: "bg-yellow-500", 
    error: "bg-red-500"
  }

  return (
    <div className="w-full space-y-2">
      {(label || showValue) && (
        <div className="flex justify-between text-sm">
          {label && <span className="font-medium text-gray-700">{label}</span>}
          {showValue && <span className="text-gray-500">{Math.round(value || 0)}%</span>}
        </div>
      )}
      
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-full bg-secondary w-full",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full w-full flex-1 transition-all duration-500 ease-out",
            variantClasses[variant]
          )}
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </ProgressPrimitive.Root>
    </div>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

// Componente específico para progreso de reserva
const BookingProgress = ({ 
  currentStep, 
  totalSteps = 4,
  steps = ["Fechas", "Habitaciones", "Huéspedes", "Pago"]
}: {
  currentStep: number
  totalSteps?: number
  steps?: string[]
}) => {
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between">
        {steps.map((step, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center text-sm",
              index + 1 <= currentStep ? "text-primary font-medium" : "text-gray-400"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs mr-2",
                index + 1 < currentStep
                  ? "bg-primary text-white"
                  : index + 1 === currentStep
                  ? "bg-primary text-white"
                  : "bg-gray-200 text-gray-500"
              )}
            >
              {index + 1 < currentStep ? "✓" : index + 1}
            </div>
            <span className="hidden sm:inline">{step}</span>
          </div>
        ))}
      </div>
      
      <Progress 
        value={progress} 
        className="h-2"
        variant="default"
      />
    </div>
  )
}

// Componente para mostrar ocupación de habitaciones
const OccupancyProgress = ({ 
  occupied, 
  capacity, 
  roomName 
}: { 
  occupied: number
  capacity: number
  roomName: string 
}) => {
  const percentage = (occupied / capacity) * 100
  
  const getVariant = () => {
    if (percentage >= 90) return "error"
    if (percentage >= 75) return "warning"
    return "success"
  }

  return (
    <Progress
      value={percentage}
      variant={getVariant()}
      label={roomName}
      showValue
      className="mb-2"
    />
  )
}

export { Progress, BookingProgress, OccupancyProgress }

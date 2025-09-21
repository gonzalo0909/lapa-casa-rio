// lapa-casa-hostel-frontend/src/components/ui/radio.tsx

import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"
import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> & {
    label?: string
    error?: string
    orientation?: "horizontal" | "vertical"
  }
>(({ className, label, error, orientation = "vertical", ...props }, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-3 block">
          {label}
        </label>
      )}
      
      <RadioGroupPrimitive.Root
        className={cn(
          "grid gap-3",
          orientation === "horizontal" ? "grid-flow-col auto-cols-fr" : "grid-cols-1",
          className
        )}
        {...props}
        ref={ref}
      />

      {error && (
        <p className="mt-2 text-sm text-destructive flex items-center gap-1">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & {
    label?: string
    description?: string
    leftIcon?: React.ReactNode
  }
>(({ className, label, description, leftIcon, id, ...props }, ref) => {
  const itemId = id || `radio-${Math.random().toString(36).substr(2, 9)}`

  if (label || description) {
    return (
      <div className="flex items-start space-x-3">
        <RadioGroupPrimitive.Item
          ref={ref}
          id={itemId}
          className={cn(
            "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        >
          <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
            <Circle className="h-2.5 w-2.5 fill-current text-current" />
          </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
        
        <div className="grid gap-1.5 leading-none">
          <label
            htmlFor={itemId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
          >
            {leftIcon && <span className="text-muted-foreground">{leftIcon}</span>}
            {label}
          </label>
          {description && (
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      id={itemId}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-2.5 w-2.5 fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export { RadioGroup, RadioGroupItem }

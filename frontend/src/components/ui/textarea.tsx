// lapa-casa-hostel-frontend/src/components/ui/textarea.tsx

import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  maxLength?: number
  showCharCount?: boolean
  resize?: "none" | "vertical" | "horizontal" | "both"
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ 
    className, 
    label,
    error,
    helperText,
    maxLength,
    showCharCount = false,
    resize = "vertical",
    id,
    value,
    ...props 
  }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`
    const currentLength = typeof value === 'string' ? value.length : 0

    const resizeClasses = {
      none: "resize-none",
      vertical: "resize-y",
      horizontal: "resize-x",
      both: "resize"
    }

    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={textareaId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block"
          >
            {label}
          </label>
        )}
        
        <textarea
          id={textareaId}
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            resizeClasses[resize],
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          ref={ref}
          maxLength={maxLength}
          value={value}
          {...props}
        />

        <div className="flex justify-between items-center mt-1">
          <div>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}

            {helperText && !error && (
              <p className="text-sm text-muted-foreground">
                {helperText}
              </p>
            )}
          </div>

          {(showCharCount || maxLength) && (
            <p className={cn(
              "text-sm text-muted-foreground",
              maxLength && currentLength > maxLength * 0.9 && "text-orange-500",
              maxLength && currentLength >= maxLength && "text-destructive"
            )}>
              {currentLength}{maxLength && `/${maxLength}`}
            </p>
          )}
        </div>
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }

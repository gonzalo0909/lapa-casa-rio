// src/components/forms/booking-form/step-indicator.tsx
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

export interface StepConfig {
  id: number;
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export interface StepIndicatorProps {
  steps: StepConfig[];
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
  className?: string;
  variant?: 'default' | 'minimal' | 'detailed';
  orientation?: 'horizontal' | 'vertical';
  showLabels?: boolean;
  allowClickNavigation?: boolean;
  errors?: Record<number, boolean>;
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps = [],
  onStepClick,
  className,
  variant = 'default',
  orientation = 'horizontal',
  showLabels = true,
  allowClickNavigation = true,
  errors = {}
}: StepIndicatorProps) {
  const t = useTranslations('booking.steps');

  const handleStepClick = (stepId: number) => {
    if (allowClickNavigation && onStepClick) {
      onStepClick(stepId);
    }
  };

  const getStepStatus = (stepId: number): 'completed' | 'current' | 'upcoming' | 'error' => {
    if (errors[stepId]) return 'error';
    if (completedSteps.includes(stepId)) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'upcoming';
  };

  const getStepIcon = (step: StepConfig, status: string) => {
    const iconProps = { className: "h-4 w-4" };
    
    switch (status) {
      case 'completed':
        return <CheckCircle2 {...iconProps} />;
      case 'error':
        return <AlertCircle {...iconProps} />;
      case 'current':
        return React.createElement(step.icon, iconProps);
      default:
        return <Circle {...iconProps} />;
    }
  };

  const getStepStyles = (status: string) => {
    const baseStyles = "transition-all duration-200";
    
    switch (status) {
      case 'completed':
        return cn(baseStyles, "bg-green-100 text-green-700 border-green-300");
      case 'current':
        return cn(baseStyles, "bg-primary text-primary-foreground border-primary shadow-sm");
      case 'error':
        return cn(baseStyles, "bg-red-100 text-red-700 border-red-300");
      case 'upcoming':
        return cn(baseStyles, "bg-muted text-muted-foreground border-border");
      default:
        return cn(baseStyles, "bg-background text-foreground border-border");
    }
  };

  const getConnectorStyles = (prevStatus: string, currentStatus: string) => {
    if (prevStatus === 'completed' && (currentStatus === 'completed' || currentStatus === 'current')) {
      return "bg-green-300";
    }
    if (prevStatus === 'completed' || prevStatus === 'current') {
      return "bg-primary";
    }
    return "bg-border";
  };

  // Renderizado horizontal (por defecto)
  if (orientation === 'horizontal') {
    return (
      <div className={cn("w-full", className)}>
        {/* Barra de progreso superior */}
        <div className="flex items-center mb-4">
          <div className="flex-1 flex items-center">
            {steps.map((step, index) => {
              const status = getStepStatus(step.id);
              const isClickable = allowClickNavigation && (
                status === 'completed' || 
                status === 'current' || 
                step.id < currentStep
              );

              return (
                <React.Fragment key={step.id}>
                  {/* Paso */}
                  <div className="flex flex-col items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => isClickable ? handleStepClick(step.id) : undefined}
                      disabled={!isClickable}
                      className={cn(
                        "w-10 h-10 rounded-full border-2 p-0 mb-2",
                        getStepStyles(status),
                        isClickable && "cursor-pointer hover:scale-105",
                        !isClickable && "cursor-default"
                      )}
                    >
                      {getStepIcon(step, status)}
                    </Button>
                    
                    {showLabels && (
                      <div className="text-center">
                        <div className={cn(
                          "text-xs font-medium",
                          status === 'current' && "text-primary font-semibold",
                          status === 'completed' && "text-green-700",
                          status === 'error' && "text-red-700",
                          status === 'upcoming' && "text-muted-foreground"
                        )}>
                          {t(`${step.key}.title`) || step.label}
                        </div>
                        
                        {variant === 'detailed' && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Paso {step.id} de {steps.length}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Conector */}
                  {index < steps.length - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 mx-4 mt-[-20px] transition-colors duration-200",
                      getConnectorStyles(status, getStepStatus(steps[index + 1].id))
                    )} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Información del paso actual */}
        {variant !== 'minimal' && (
          <div className="text-center">
            <Badge variant="outline" className="text-xs">
              Paso {currentStep} de {steps.length}
            </Badge>
          </div>
        )}
      </div>
    );
  }

  // Renderizado vertical
  return (
    <div className={cn("space-y-4", className)}>
      {steps.map((step, index) => {
        const status = getStepStatus(step.id);
        const isClickable = allowClickNavigation && (
          status === 'completed' || 
          status === 'current' || 
          step.id < currentStep
        );

        return (
          <div
            key={step.id}
            className="flex items-center space-x-4"
          >
            {/* Indicador lateral */}
            <div className="flex flex-col items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => isClickable ? handleStepClick(step.id) : undefined}
                disabled={!isClickable}
                className={cn(
                  "w-8 h-8 rounded-full border-2 p-0",
                  getStepStyles(status),
                  isClickable && "cursor-pointer hover:scale-105",
                  !isClickable && "cursor-default"
                )}
              >
                {getStepIcon(step, status)}
              </Button>
              
              {/* Conector vertical */}
              {index < steps.length - 1 && (
                <div className={cn(
                  "w-0.5 h-8 mt-2 transition-colors duration-200",
                  getConnectorStyles(status, getStepStatus(steps[index + 1].id))
                )} />
              )}
            </div>

            {/* Contenido del paso */}
            <div className="flex-1">
              <div className={cn(
                "font-medium text-sm",
                status === 'current' && "text-primary font-semibold",
                status === 'completed' && "text-green-700",
                status === 'error' && "text-red-700",
                status === 'upcoming' && "text-muted-foreground"
              )}>
                {t(`${step.key}.title`) || step.label}
              </div>
              
              {variant === 'detailed' && showLabels && (
                <div className="text-xs text-muted-foreground mt-1">
                  {t(`${step.key}.description`)}
                </div>
              )}
              
              {status === 'error' && (
                <div className="text-xs text-red-600 mt-1">
                  Hay errores en este paso
                </div>
              )}
              
              {status === 'completed' && variant === 'detailed' && (
                <div className="text-xs text-green-600 mt-1">
                  Completado
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Componente simplificado para casos básicos
export interface SimpleStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
  className?: string;
}

export function SimpleStepIndicator({
  currentStep,
  totalSteps,
  stepLabels = [],
  className
}: SimpleStepIndicatorProps) {
  const steps = Array.from({ length: totalSteps }, (_, index) => ({
    id: index + 1,
    key: `step-${index + 1}`,
    icon: Circle,
    label: stepLabels[index] || `Paso ${index + 1}`
  }));

  const completedSteps = Array.from({ length: currentStep - 1 }, (_, i) => i + 1);

  return (
    <StepIndicator
      steps={steps}
      currentStep={currentStep}
      completedSteps={completedSteps}
      variant="minimal"
      allowClickNavigation={false}
      className={className}
    />
  );
}

// Hook para gestión de pasos
export function useStepIndicator(totalSteps: number, initialStep: number = 1) {
  const [currentStep, setCurrentStep] = React.useState(initialStep);
  const [completedSteps, setCompletedSteps] = React.useState<number[]>([]);

  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCompletedSteps(prev => [...new Set([...prev, currentStep])]);
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const markStepCompleted = (step: number) => {
    setCompletedSteps(prev => [...new Set([...prev, step])]);
  };

  const markStepIncomplete = (step: number) => {
    setCompletedSteps(prev => prev.filter(s => s !== step));
  };

  const reset = () => {
    setCurrentStep(1);
    setCompletedSteps([]);
  };

  return {
    currentStep,
    completedSteps,
    goToStep,
    nextStep,
    prevStep,
    markStepCompleted,
    markStepIncomplete,
    reset,
    isFirstStep: currentStep === 1,
    isLastStep: currentStep === totalSteps,
    progress: (currentStep / totalSteps) * 100
  };
}

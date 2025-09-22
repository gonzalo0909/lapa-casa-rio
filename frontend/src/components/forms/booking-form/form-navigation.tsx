// src/components/forms/booking-form/form-navigation.tsx
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  ChevronRight, 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export interface FormNavigationProps {
  currentStep: number;
  totalSteps: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  isValid?: boolean;
  isLoading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  showProgress?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  completeLabel?: string;
  className?: string;
  variant?: 'default' | 'minimal' | 'detailed';
  errors?: Record<string, string>;
  warnings?: Record<string, string>;
}

export function FormNavigation({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onComplete,
  isValid = true,
  isLoading = false,
  canGoBack = true,
  canGoForward = true,
  showProgress = true,
  nextLabel,
  prevLabel,
  completeLabel,
  className,
  variant = 'default',
  errors = {},
  warnings = {}
}: FormNavigationProps) {
  const t = useTranslations('booking.navigation');
  
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;
  const hasErrors = Object.keys(errors).length > 0;
  const hasWarnings = Object.keys(warnings).length > 0;
  const progress = (currentStep / totalSteps) * 100;

  // Labels dinámicos
  const getNextLabel = (): string => {
    if (nextLabel) return nextLabel;
    if (isLastStep) return completeLabel || t('complete');
    
    switch (currentStep) {
      case 1: return t('selectRooms');
      case 2: return t('viewPricing');
      case 3: return t('guestInfo');
      case 4: return t('proceedPayment');
      default: return t('continue');
    }
  };

  const getPrevLabel = (): string => {
    if (prevLabel) return prevLabel;
    return t('back');
  };

  // Handlers de navegación
  const handlePrevious = () => {
    if (!isLoading && canGoBack && !isFirstStep) {
      onPrevious?.();
    }
  };

  const handleNext = () => {
    if (!isLoading && canGoForward && isValid) {
      if (isLastStep) {
        onComplete?.();
      } else {
        onNext?.();
      }
    }
  };

  // Renderizado mínimal
  if (variant === 'minimal') {
    return (
      <div className={cn("flex justify-between items-center", className)}>
        <Button
          variant="ghost"
          onClick={handlePrevious}
          disabled={isFirstStep || isLoading || !canGoBack}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          {getPrevLabel()}
        </Button>

        <Button
          onClick={handleNext}
          disabled={!isValid || isLoading || !canGoForward}
          className="gap-2"
        >
          {isLoading ? (
            <LoadingSpinner size="sm" />
          ) : isLastStep ? (
            <CreditCard className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {getNextLabel()}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Barra de progreso */}
      {showProgress && variant !== 'minimal' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              Paso {currentStep} de {totalSteps}
            </span>
            <span className="text-muted-foreground">
              {Math.round(progress)}% completado
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Alertas y validaciones */}
      {(hasErrors || hasWarnings) && (
        <div className="space-y-2">
          {hasErrors && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <div className="font-medium mb-1">Errores encontrados:</div>
                <ul className="list-disc list-inside space-y-1">
                  {Object.entries(errors).map(([field, message]) => (
                    <li key={field}>{message}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {hasWarnings && !hasErrors && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Clock className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <div className="font-medium mb-1">Advertencias:</div>
                <ul className="list-disc list-inside space-y-1">
                  {Object.entries(warnings).map(([field, message]) => (
                    <li key={field}>{message}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botones de navegación principales */}
      <div className="flex justify-between items-center gap-4">
        {/* Botón anterior */}
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isLoading || !canGoBack}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              {getPrevLabel()}
            </Button>
          )}
        </div>

        {/* Información central (solo en modo detallado) */}
        {variant === 'detailed' && (
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {isValid ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Todo listo para continuar</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span>Completa los campos requeridos</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Botón siguiente/completar */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleNext}
            disabled={!isValid || isLoading || !canGoForward}
            size={isLastStep ? "lg" : "default"}
            className={cn(
              "gap-2",
              isLastStep && "bg-green-600 hover:bg-green-700"
            )}
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                {isLastStep ? 'Procesando...' : 'Cargando...'}
              </>
            ) : (
              <>
                {isLastStep ? (
                  <CreditCard className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {getNextLabel()}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Información adicional del paso */}
      {variant === 'detailed' && (
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isLastStep ? (
                'Último paso - Procesar pago'
              ) : (
                `Siguiente: ${t(`steps.${currentStep + 1}.title`)}`
              )}
            </span>
            
            {currentStep > 1 && (
              <Badge variant="outline" className="text-xs">
                Progreso guardado automáticamente
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Componente de navegación simplificada para formularios de un solo paso
export interface SimpleNavigationProps {
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isValid?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function SimpleNavigation({
  onSubmit,
  onCancel,
  submitLabel = 'Guardar',
  cancelLabel = 'Cancelar',
  isValid = true,
  isLoading = false,
  className
}: SimpleNavigationProps) {
  return (
    <div className={cn("flex justify-end gap-3", className)}>
      {onCancel && (
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          {cancelLabel}
        </Button>
      )}
      
      <Button
        onClick={onSubmit}
        disabled={!isValid || isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <LoadingSpinner size="sm" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {submitLabel}
      </Button>
    </div>
  );
}

// Hook personalizado para gestión de navegación
export function useFormNavigation(
  totalSteps: number, 
  validateStep?: (step: number) => Promise<boolean> | boolean
) {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const goToStep = async (step: number): Promise<boolean> => {
    if (step < 1 || step > totalSteps) return false;
    
    // Si vamos hacia adelante, validar paso actual
    if (step > currentStep && validateStep) {
      setIsLoading(true);
      try {
        const isValid = await validateStep(currentStep);
        if (!isValid) {
          setIsLoading(false);
          return false;
        }
      } catch (error) {
        setErrors({ validation: 'Error de validación' });
        setIsLoading(false);
        return false;
      }
    }

    setCurrentStep(step);
    setErrors({});
    setIsLoading(false);
    return true;
  };

  const nextStep = () => goToStep(currentStep + 1);
  const prevStep = () => goToStep(currentStep - 1);

  const reset = () => {
    setCurrentStep(1);
    setErrors({});
    setIsLoading(false);
  };

  return {
    currentStep,
    isLoading,
    errors,
    setErrors,
    goToStep,
    nextStep,
    prevStep,
    reset,
    isFirstStep: currentStep === 1,
    isLastStep: currentStep === totalSteps,
    canGoBack: currentStep > 1 && !isLoading,
    canGoForward: currentStep < totalSteps && !isLoading
  };
}

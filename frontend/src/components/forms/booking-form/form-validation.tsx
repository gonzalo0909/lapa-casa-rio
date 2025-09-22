// src/components/forms/booking-form/form-validation.tsx
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info,
  Clock
} from 'lucide-react';
import { BookingFormData } from './booking-form';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  completeness: number;
  requiredFields: string[];
  missingFields: string[];
}

export interface FormValidationProps {
  step: number;
  data: BookingFormData;
  errors?: Record<string, string>;
  warnings?: Record<string, string>;
  showCompleteness?: boolean;
  showRequiredFields?: boolean;
  className?: string;
  variant?: 'inline' | 'summary' | 'detailed';
}

// Validaciones por paso
const STEP_VALIDATIONS = {
  1: { // Fechas
    required: ['checkInDate', 'checkOutDate'],
    validators: {
      checkInDate: (date: Date | null) => {
        if (!date) return 'La fecha de entrada es requerida';
        if (date < new Date()) return 'La fecha de entrada debe ser futura';
        return null;
      },
      checkOutDate: (date: Date | null, checkInDate?: Date | null) => {
        if (!date) return 'La fecha de salida es requerida';
        if (!checkInDate) return null;
        if (date <= checkInDate) return 'La fecha de salida debe ser posterior a la entrada';
        const diffDays = Math.ceil((date.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 30) return 'La estadía máxima es de 30 noches';
        return null;
      }
    }
  },
  2: { // Habitaciones
    required: ['selectedRooms', 'totalBeds'],
    validators: {
      selectedRooms: (rooms: any[]) => {
        if (!rooms || rooms.length === 0) return 'Debe seleccionar al menos una habitación';
        return null;
      },
      totalBeds: (beds: number) => {
        if (!beds || beds < 1) return 'Debe reservar al menos 1 cama';
        if (beds > 38) return 'Máximo 38 camas disponibles';
        return null;
      }
    }
  },
  3: { // Precios
    required: ['finalPrice', 'depositAmount'],
    validators: {
      finalPrice: (price: number) => {
        if (!price || price <= 0) return 'Error en el cálculo del precio';
        return null;
      },
      depositAmount: (amount: number) => {
        if (!amount || amount <= 0) return 'Error en el cálculo del depósito';
        return null;
      }
    }
  },
  4: { // Información del huésped
    required: ['guestName', 'guestEmail', 'guestPhone', 'agreedToTerms'],
    validators: {
      guestName: (name: string) => {
        if (!name || name.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres';
        if (name.trim().length > 100) return 'El nombre no puede exceder 100 caracteres';
        return null;
      },
      guestEmail: (email: string) => {
        if (!email) return 'El email es requerido';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return 'El formato del email no es válido';
        return null;
      },
      guestPhone: (phone: string) => {
        if (!phone) return 'El teléfono es requerido';
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(phone.replace(/\s|-|\(|\)/g, ''))) {
          return 'El formato del teléfono no es válido';
        }
        return null;
      },
      agreedToTerms: (agreed: boolean) => {
        if (!agreed) return 'Debe aceptar los términos y condiciones';
        return null;
      }
    }
  },
  5: { // Pago
    required: ['paymentMethod'],
    validators: {
      paymentMethod: (method: string) => {
        if (!method) return 'Debe seleccionar un método de pago';
        if (!['stripe', 'mercado_pago'].includes(method)) {
          return 'Método de pago no válido';
        }
        return null;
      }
    }
  }
};

export function validateBookingStep(step: number, data: BookingFormData): ValidationResult {
  const stepValidation = STEP_VALIDATIONS[step as keyof typeof STEP_VALIDATIONS];
  if (!stepValidation) {
    return {
      isValid: true,
      errors: {},
      warnings: {},
      completeness: 100,
      requiredFields: [],
      missingFields: []
    };
  }

  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  const requiredFields = stepValidation.required;
  const missingFields: string[] = [];

  // Validar campos requeridos
  requiredFields.forEach(field => {
    const value = data[field as keyof BookingFormData];
    
    if (value === null || value === undefined || value === '' || 
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'boolean' && !value && field === 'agreedToTerms')) {
      missingFields.push(field);
    }
  });

  // Ejecutar validadores específicos
  Object.entries(stepValidation.validators).forEach(([field, validator]) => {
    const value = data[field as keyof BookingFormData];
    let error = null;

    // Validadores especiales con múltiples parámetros
    if (field === 'checkOutDate') {
      error = validator(value, data.checkInDate);
    } else {
      error = validator(value);
    }

    if (error) {
      errors[field] = error;
    }
  });

  // Validaciones adicionales por paso
  if (step === 1) {
    // Validar temporada alta
    if (data.checkInDate) {
      const month = data.checkInDate.getMonth();
      if ([11, 0, 1, 2].includes(month)) { // Dic-Mar
        warnings.season = 'Temporada alta - Precios incrementados';
      }
    }

    // Validar días de la semana
    if (data.checkInDate && data.checkOutDate) {
      const checkInDay = data.checkInDate.getDay();
      const checkOutDay = data.checkOutDate.getDay();
      if (checkInDay === 0 || checkOutDay === 0) { // Domingo
        warnings.weekend = 'Check-in/out en domingo puede tener restricciones';
      }
    }
  }

  if (step === 2) {
    // Validar disponibilidad de habitación flexible
    if (data.selectedRooms.some(room => room.roomId === 'room_flexible_7')) {
      const hoursUntilCheckIn = data.checkInDate ? 
        (data.checkInDate.getTime() - Date.now()) / (1000 * 60 * 60) : 0;
      
      if (hoursUntilCheckIn > 48) {
        warnings.flexible = 'Habitación flexible reservada como femenina';
      } else {
        warnings.flexible = 'Habitación flexible se convertirá a mixta si no hay reservas femeninas';
      }
    }
  }

  if (step === 3) {
    // Validar descuentos de grupo
    if (data.totalBeds >= 7 && data.groupDiscount > 0) {
      warnings.discount = `Descuento de grupo aplicado: ${Math.round(data.groupDiscount * 100)}%`;
    }
  }

  if (step === 4) {
    // Validar país
    if (!data.guestCountry || data.guestCountry === 'BR') {
      warnings.country = 'Cliente nacional - No se requiere información adicional';
    }
  }

  // Calcular completitud
  const totalFields = requiredFields.length;
  const completedFields = totalFields - missingFields.length;
  const completeness = totalFields > 0 ? (completedFields / totalFields) * 100 : 100;

  return {
    isValid: Object.keys(errors).length === 0 && missingFields.length === 0,
    errors,
    warnings,
    completeness,
    requiredFields,
    missingFields
  };
}

export function FormValidation({ 
  step, 
  data, 
  errors = {}, 
  warnings = {},
  showCompleteness = true,
  showRequiredFields = false,
  className,
  variant = 'inline'
}: FormValidationProps) {
  const t = useTranslations('booking.validation');
  
  const validation = validateBookingStep(step, data);
  const allErrors = { ...validation.errors, ...errors };
  const allWarnings = { ...validation.warnings, ...warnings };
  
  const hasErrors = Object.keys(allErrors).length > 0;
  const hasWarnings = Object.keys(allWarnings).length > 0;
  const isComplete = validation.completeness === 100;

  if (variant === 'summary') {
    return (
      <div className={cn("space-y-3", className)}>
        {showCompleteness && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Completitud del paso
              </span>
              <span className={cn(
                "font-medium",
                isComplete ? "text-green-600" : "text-amber-600"
              )}>
                {Math.round(validation.completeness)}%
              </span>
            </div>
            <Progress value={validation.completeness} className="h-2" />
          </div>
        )}

        {hasErrors && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {Object.keys(allErrors).length} error(es) encontrado(s)
            </AlertDescription>
          </Alert>
        )}

        {hasWarnings && !hasErrors && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {Object.keys(allWarnings).length} advertencia(s)
            </AlertDescription>
          </Alert>
        )}

        {isComplete && !hasErrors && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Paso completado correctamente</span>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Completitud */}
        {showCompleteness && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">Progreso del paso</h4>
              <Badge variant={isComplete ? "default" : "secondary"}>
                {Math.round(validation.completeness)}%
              </Badge>
            </div>
            <Progress value={validation.completeness} className="h-3 mb-2" />
            <div className="text-xs text-muted-foreground">
              {validation.completedFields}/{validation.requiredFields.length} campos completados
            </div>
          </div>
        )}

        {/* Campos requeridos */}
        {showRequiredFields && validation.missingFields.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <div className="font-medium text-sm text-blue-900 mb-1">
                  Campos pendientes:
                </div>
                <div className="flex flex-wrap gap-1">
                  {validation.missingFields.map(field => (
                    <Badge key={field} variant="outline" className="text-xs">
                      {t(`fields.${field}`) || field}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Errores detallados */}
        {hasErrors && (
          <div className="space-y-2">
            {Object.entries(allErrors).map(([field, message]) => (
              <Alert key={field} variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{t(`fields.${field}`) || field}:</strong> {message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Advertencias detalladas */}
        {hasWarnings && (
          <div className="space-y-2">
            {Object.entries(allWarnings).map(([field, message]) => (
              <Alert key={field}>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>{t(`fields.${field}`) || field}:</strong> {message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Estado exitoso */}
        {isComplete && !hasErrors && !hasWarnings && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Este paso ha sido completado correctamente. Puede continuar al siguiente paso.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  // Variant inline (por defecto)
  if (!hasErrors && !hasWarnings && isComplete) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-green-600", className)}>
        <CheckCircle2 className="h-4 w-4" />
        <span>Información válida</span>
        {showCompleteness && (
          <Badge variant="outline" className="text-green-600 border-green-200">
            100%
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Errores inline */}
      {Object.entries(allErrors).map(([field, message]) => (
        <div key={field} className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{message}</span>
        </div>
      ))}

      {/* Advertencias inline */}
      {Object.entries(allWarnings).map(([field, message]) => (
        <div key={field} className="flex items-start gap-2 text-sm text-amber-600">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{message}</span>
        </div>
      ))}

      {/* Completitud inline */}
      {showCompleteness && !isComplete && !hasErrors && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Progress value={validation.completeness} className="flex-1 h-1" />
          <span className="text-xs">
            {Math.round(validation.completeness)}%
          </span>
        </div>
      )}
    </div>
  );
}

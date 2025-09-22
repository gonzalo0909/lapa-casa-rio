// src/hooks/use-form-validation.ts
'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ZodSchema, ZodError } from 'zod';
import { validateBookingStep } from '@/components/forms/booking-form/form-validation';
import { BookingFormData } from '@/components/forms/booking-form/booking-form';

// Tipos para validación
export interface ValidationRule<T = any> {
  field: keyof T;
  validator: (value: any, data: T) => string | null;
  required?: boolean;
  trigger?: 'onChange' | 'onBlur' | 'onSubmit';
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  touched: Record<string, boolean>;
  firstError: string | null;
}

export interface UseValidationOptions<T> {
  schema?: ZodSchema<T>;
  rules?: ValidationRule<T>[];
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  revalidateMode?: 'onChange' | 'onBlur' | 'onSubmit';
  onValidation?: (result: ValidationResult) => void;
}

export interface UseValidationReturn<T> {
  // Estado de validación
  errors: Record<string, string>;
  warnings: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isValidating: boolean;
  
  // Funciones de validación
  validate: (data: T, fields?: (keyof T)[]) => Promise<ValidationResult>;
  validateField: (field: keyof T, value: any, data: T) => Promise<string | null>;
  clearErrors: (fields?: (keyof T)[]) => void;
  clearWarnings: (fields?: (keyof T)[]) => void;
  setFieldTouched: (field: keyof T, touched?: boolean) => void;
  
  // Helpers
  getFieldError: (field: keyof T) => string | undefined;
  getFieldWarning: (field: keyof T) => string | undefined;
  isFieldTouched: (field: keyof T) => boolean;
  isFieldValid: (field: keyof T) => boolean;
  
  // Resultados
  firstError: string | null;
  errorCount: number;
  warningCount: number;
}

export function useFormValidation<T extends Record<string, any>>(
  options: UseValidationOptions<T> = {}
): UseValidationReturn<T> {
  const {
    schema,
    rules = [],
    validateOnChange = true,
    validateOnBlur = true,
    debounceMs = 300,
    revalidateMode = 'onChange',
    onValidation
  } = options;

  // Estado de validación
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);

  // Referencias para debounce
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const lastValidationData = useRef<T | null>(null);

  // Función principal de validación
  const validate = useCallback(async (
    data: T, 
    fields?: (keyof T)[]
  ): Promise<ValidationResult> => {
    setIsValidating(true);
    
    const newErrors: Record<string, string> = {};
    const newWarnings: Record<string, string> = {};
    let isValid = true;

    try {
      // Validación con Zod schema si está presente
      if (schema) {
        try {
          schema.parse(data);
        } catch (error) {
          if (error instanceof ZodError) {
            error.errors.forEach(err => {
              const field = err.path.join('.');
              if (!fields || fields.includes(field as keyof T)) {
                newErrors[field] = err.message;
                isValid = false;
              }
            });
          }
        }
      }

      // Validación con reglas personalizadas
      for (const rule of rules) {
        const fieldName = rule.field as string;
        
        if (fields && !fields.includes(rule.field)) continue;

        const fieldValue = data[rule.field];
        const error = rule.validator(fieldValue, data);

        if (error) {
          newErrors[fieldName] = error;
          isValid = false;
        }
      }

      // Actualizar estado
      setErrors(prev => ({
        ...prev,
        ...newErrors
      }));

      setWarnings(prev => ({
        ...prev,
        ...newWarnings
      }));

      const result: ValidationResult = {
        isValid,
        errors: newErrors,
        warnings: newWarnings,
        touched,
        firstError: Object.values(newErrors)[0] || null
      };

      onValidation?.(result);
      lastValidationData.current = data;

      return result;

    } catch (error) {
      console.error('Error durante validación:', error);
      const result: ValidationResult = {
        isValid: false,
        errors: { validation: 'Error interno de validación' },
        warnings: {},
        touched,
        firstError: 'Error interno de validación'
      };
      
      setErrors({ validation: 'Error interno de validación' });
      return result;
    } finally {
      setIsValidating(false);
    }
  }, [schema, rules, touched, onValidation]);

  // Función para validar un campo específico
  const validateField = useCallback(async (
    field: keyof T,
    value: any,
    data: T
  ): Promise<string | null> => {
    // Buscar regla específica para el campo
    const fieldRule = rules.find(rule => rule.field === field);
    
    if (fieldRule) {
      return fieldRule.validator(value, data);
    }

    // Validar con schema si está disponible
    if (schema) {
      try {
        schema.parse(data);
        return null;
      } catch (error) {
        if (error instanceof ZodError) {
          const fieldError = error.errors.find(err => 
            err.path.join('.') === field
          );
          return fieldError?.message || null;
        }
      }
    }

    return null;
  }, [rules, schema]);

  // Función para validar con debounce
  const debouncedValidateField = useCallback((
    field: keyof T,
    value: any,
    data: T
  ) => {
    const fieldName = field as string;
    
    // Limpiar timeout anterior
    if (debounceTimeouts.current[fieldName]) {
      clearTimeout(debounceTimeouts.current[fieldName]);
    }

    // Establecer nuevo timeout
    debounceTimeouts.current[fieldName] = setTimeout(async () => {
      const error = await validateField(field, value, data);
      
      setErrors(prev => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[fieldName] = error;
        } else {
          delete newErrors[fieldName];
        }
        return newErrors;
      });
    }, debounceMs);
  }, [validateField, debounceMs]);

  // Función para limpiar errores
  const clearErrors = useCallback((fields?: (keyof T)[]) => {
    if (fields) {
      setErrors(prev => {
        const newErrors = { ...prev };
        fields.forEach(field => {
          delete newErrors[field as string];
        });
        return newErrors;
      });
    } else {
      setErrors({});
    }
  }, []);

  // Función para limpiar advertencias
  const clearWarnings = useCallback((fields?: (keyof T)[]) => {
    if (fields) {
      setWarnings(prev => {
        const newWarnings = { ...prev };
        fields.forEach(field => {
          delete newWarnings[field as string];
        });
        return newWarnings;
      });
    } else {
      setWarnings({});
    }
  }, []);

  // Función para marcar campo como tocado
  const setFieldTouched = useCallback((field: keyof T, isTouched: boolean = true) => {
    setTouched(prev => ({
      ...prev,
      [field as string]: isTouched
    }));
  }, []);

  // Helpers
  const getFieldError = useCallback((field: keyof T): string | undefined => {
    return errors[field as string];
  }, [errors]);

  const getFieldWarning = useCallback((field: keyof T): string | undefined => {
    return warnings[field as string];
  }, [warnings]);

  const isFieldTouched = useCallback((field: keyof T): boolean => {
    return touched[field as string] || false;
  }, [touched]);

  const isFieldValid = useCallback((field: keyof T): boolean => {
    return !errors[field as string];
  }, [errors]);

  // Propiedades calculadas
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  const firstError = useMemo(() => {
    return Object.values(errors)[0] || null;
  }, [errors]);

  const errorCount = useMemo(() => {
    return Object.keys(errors).length;
  }, [errors]);

  const warningCount = useMemo(() => {
    return Object.keys(warnings).length;
  }, [warnings]);

  // Cleanup de timeouts
  useEffect(() => {
    return () => {
      Object.values(debounceTimeouts.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  return {
    // Estado
    errors,
    warnings,
    touched,
    isValid,
    isValidating,
    
    // Funciones
    validate,
    validateField: debouncedValidateField,
    clearErrors,
    clearWarnings,
    setFieldTouched,
    
    // Helpers
    getFieldError,
    getFieldWarning,
    isFieldTouched,
    isFieldValid,
    
    // Resultados
    firstError,
    errorCount,
    warningCount
  };
}

// Hook especializado para validación de booking
export function useBookingValidation(data: BookingFormData) {
  const [stepValidations, setStepValidations] = useState<Record<number, ValidationResult>>({});

  const validateBookingData = useCallback(async (step?: number) => {
    if (step) {
      const result = validateBookingStep(step, data);
      setStepValidations(prev => ({
        ...prev,
        [step]: result
      }));
      return result;
    }

    // Validar todos los pasos
    const results: Record<number, ValidationResult> = {};
    for (let i = 1; i <= 5; i++) {
      results[i] = validateBookingStep(i, data);
    }
    
    setStepValidations(results);
    return results;
  }, [data]);

  const isStepValid = useCallback((step: number): boolean => {
    return stepValidations[step]?.isValid || false;
  }, [stepValidations]);

  const getStepErrors = useCallback((step: number): Record<string, string> => {
    return stepValidations[step]?.errors || {};
  }, [stepValidations]);

  return {
    stepValidations,
    validateBookingData,
    isStepValid,
    getStepErrors,
    isAllValid: Object.values(stepValidations).every(v => v.isValid)
  };
}

// Hook para validación en tiempo real
export function useRealTimeValidation<T extends Record<string, any>>(
  data: T,
  schema?: ZodSchema<T>,
  options: { debounceMs?: number; fields?: (keyof T)[] } = {}
) {
  const { debounceMs = 500, fields } = options;
  const [validationState, setValidationState] = useState<ValidationResult>({
    isValid: true,
    errors: {},
    warnings: {},
    touched: {},
    firstError: null
  });

  const validateData = useCallback(async () => {
    if (!schema) return;

    try {
      schema.parse(data);
      setValidationState({
        isValid: true,
        errors: {},
        warnings: {},
        touched: {},
        firstError: null
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string> = {};
        
        error.errors.forEach(err => {
          const field = err.path.join('.');
          if (!fields || fields.includes(field as keyof T)) {
            errors[field] = err.message;
          }
        });

        setValidationState({
          isValid: Object.keys(errors).length === 0,
          errors,
          warnings: {},
          touched: {},
          firstError: Object.values(errors)[0] || null
        });
      }
    }
  }, [data, schema, fields]);

  // Debounce de validación
  useEffect(() => {
    const timeout = setTimeout(validateData, debounceMs);
    return () => clearTimeout(timeout);
  }, [validateData, debounceMs]);

  return validationState;
}

// Utilitarios de validación
export const validationUtils = {
  // Crear regla de validación personalizada
  createRule: <T>(
    field: keyof T,
    validator: (value: any, data: T) => string | null,
    options: { required?: boolean; trigger?: 'onChange' | 'onBlur' | 'onSubmit' } = {}
  ): ValidationRule<T> => ({
    field,
    validator,
    ...options
  }),

  // Combinar múltiples esquemas de validación
  combineSchemas: <T>(...schemas: ZodSchema<Partial<T>>[]): ZodSchema<T> => {
    return schemas.reduce((combined, schema) => 
      combined.merge(schema), schemas[0]
    ) as ZodSchema<T>;
  },

  // Validador de email personalizado
  emailValidator: (value: string): string | null => {
    if (!value) return 'Email es requerido';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : 'Formato de email inválido';
  },

  // Validador de teléfono brasileño
  phoneValidator: (value: string): string | null => {
    if (!value) return 'Teléfono es requerido';
    const cleaned = value.replace(/\D/g, '');
    
    if (cleaned.length < 10 || cleaned.length > 11) {
      return 'Teléfono debe tener 10 u 11 dígitos';
    }
    
    return null;
  },

  // Validador de fecha futura
  futureDateValidator: (value: Date | null): string | null => {
    if (!value) return 'Fecha es requerida';
    if (value <= new Date()) return 'La fecha debe ser futura';
    return null;
  },

  // Validador de rango de fechas
  dateRangeValidator: (startDate: Date | null, endDate: Date | null): string | null => {
    if (!startDate || !endDate) return 'Ambas fechas son requeridas';
    if (endDate <= startDate) return 'Fecha final debe ser posterior a la inicial';
    
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) return 'El rango máximo es de 30 días';
    
    return null;
  }
};

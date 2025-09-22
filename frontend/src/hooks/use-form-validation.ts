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

        const fiel

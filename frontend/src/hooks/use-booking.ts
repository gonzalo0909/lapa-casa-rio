// src/hooks/use-booking-form.ts
'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { BookingFormData } from '@/components/forms/booking-form/booking-form';
import { validateBookingStep } from '@/components/forms/booking-form/form-validation';
import { calculateGroupDiscount, calculateSeasonMultiplier } from '@/lib/pricing';

// Estado inicial del formulario
const initialFormData: BookingFormData = {
  // Fechas
  checkInDate: null,
  checkOutDate: null,
  nights: 0,
  
  // Habitaciones
  selectedRooms: [],
  totalBeds: 0,
  
  // Precios
  basePrice: 60.00,
  totalPrice: 0,
  groupDiscount: 0,
  seasonMultiplier: 1,
  finalPrice: 0,
  depositAmount: 0,
  remainingAmount: 0,
  
  // Información del huésped
  guestName: '',
  guestEmail: '',
  guestPhone: '',
  guestCountry: 'BR',
  specialRequests: '',
  
  // Pago
  paymentMethod: 'mercado_pago',
  paymentType: 'pix',
  agreedToTerms: false,
  newsletterOptIn: false
};

export interface UseBookingFormOptions {
  autoCalculatePricing?: boolean;
  validateOnChange?: boolean;
  persistData?: boolean;
  onStepComplete?: (step: number, data: BookingFormData) => void;
  onFormComplete?: (data: BookingFormData) => void;
  onDataChange?: (data: BookingFormData) => void;
}

export interface UseBookingFormReturn {
  formData: BookingFormData;
  updateFormData: (updates: Partial<BookingFormData>) => void;
  setFormData: (data: BookingFormData) => void;
  resetForm: () => void;
  
  // Validación
  isValid: boolean;
  stepValidation: Record<number, boolean>;
  errors: Record<string, string>;
  
  // Estado
  isDirty: boolean;
  isCalculating: boolean;
  
  // Funciones de utilidad
  calculatePricing: () => void;
  validateStep: (step: number) => Promise<boolean>;
  goToStep: (step: number) => void;
  
  // Estado de pasos
  currentStep: number;
  completedSteps: number[];
  canProceed: boolean;
}

export function useBookingForm(
  initialData?: Partial<BookingFormData>,
  options: UseBookingFormOptions = {}
): UseBookingFormReturn {
  const {
    autoCalculatePricing = true,
    validateOnChange = true,
    persistData = true,
    onStepComplete,
    onFormComplete,
    onDataChange
  } = options;

  // Estado del formulario
  const [formData, setFormDataState] = useState<BookingFormData>({
    ...initialFormData,
    ...initialData
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // Referencias para evitar loops infinitos
  const previousDataRef = useRef<BookingFormData>(formData);
  const calculatingRef = useRef(false);

  // Función para actualizar datos del formulario
  const updateFormData = useCallback((updates: Partial<BookingFormData>) => {
    setFormDataState(prev => {
      const newData = { ...prev, ...updates };
      
      // Marcar como modificado
      setIsDirty(true);
      
      // Ejecutar callback de cambio
      onDataChange?.(newData);
      
      return newData;
    });
  }, [onDataChange]);

  // Función para establecer datos completos
  const setFormData = useCallback((data: BookingFormData) => {
    setFormDataState(data);
    setIsDirty(true);
    onDataChange?.(data);
  }, [onDataChange]);

  // Función para resetear formulario
  const resetForm = useCallback(() => {
    setFormDataState(initialFormData);
    setCurrentStep(1);
    setCompletedSteps([]);
    setErrors({});
    setIsDirty(false);
    setIsCalculating(false);
  }, []);

  // Función para calcular precios automáticamente
  const calculatePricing = useCallback(() => {
    if (calculatingRef.current) return;
    
    calculatingRef.current = true;
    setIsCalculating(true);

    try {
      const { checkInDate, checkOutDate, totalBeds, nights } = formData;

      if (!checkInDate || !checkOutDate || !totalBeds || !nights) {
        setIsCalculating(false);
        calculatingRef.current = false;
        return;
      }

      // Calcular precio base
      const baseTotal = formData.basePrice * totalBeds * nights;

      // Calcular descuento de grupo
      const groupDiscount = calculateGroupDiscount(totalBeds);

      // Calcular multiplicador de temporada
      const seasonMultiplier = calculateSeasonMultiplier(checkInDate);

      // Aplicar descuentos y multiplicadores
      const discountedPrice = baseTotal * (1 - groupDiscount);
      const finalPrice = discountedPrice * seasonMultiplier;

      // Calcular depósito (30% para grupos estándar, 50% para grupos grandes)
      const depositPercentage = totalBeds >= 15 ? 0.50 : 0.30;
      const depositAmount = Math.max(finalPrice * depositPercentage, 50); // Mínimo R$ 50
      const remainingAmount = finalPrice - depositAmount;

      // Actualizar solo si los precios han cambiado
      const pricingUpdates = {
        totalPrice: baseTotal,
        groupDiscount,
        seasonMultiplier,
        finalPrice: Math.round(finalPrice * 100) / 100,
        depositAmount: Math.round(depositAmount * 100) / 100,
        remainingAmount: Math.round(remainingAmount * 100) / 100
      };

      updateFormData(pricingUpdates);

    } catch (error) {
      console.error('Error calculando precios:', error);
    } finally {
      setIsCalculating(false);
      calculatingRef.current = false;
    }
  }, [formData, updateFormData]);

  // Efecto para calcular precios automáticamente
  useMemo(() => {
    if (autoCalculatePricing && !isCalculating) {
      const { checkInDate, checkOutDate, totalBeds, nights } = formData;
      
      // Solo calcular si tenemos los datos necesarios
      if (checkInDate && checkOutDate && totalBeds > 0 && nights > 0) {
        // Verificar si los datos relevantes han cambiado
        const prev = previousDataRef.current;
        const hasRelevantChanges = (
          prev.checkInDate !== checkInDate ||
          prev.checkOutDate !== checkOutDate ||
          prev.totalBeds !== totalBeds ||
          prev.nights !== nights ||
          prev.basePrice !== formData.basePrice
        );

        if (hasRelevantChanges) {
          calculatePricing();
        }
      }
    }

    previousDataRef.current = formData;
  }, [formData, autoCalculatePricing, isCalculating, calculatePricing]);

  // Función para validar un paso específico
  const validateStep = useCallback(async (step: number): Promise<boolean> => {
    try {
      const validation = validateBookingStep(step, formData);
      
      if (!validation.isValid) {
        setErrors(validation.errors);
        return false;
      }

      setErrors({});
      return true;
    } catch (error) {
      console.error('Error validando paso:', error);
      setErrors({ validation: 'Error de validación' });
      return false;
    }
  }, [formData]);

  // Función para navegar a un paso
  const goToStep = useCallback(async (step: number) => {
    if (step < 1 || step > 5) return;

    // Si vamos hacia adelante, validar paso actual
    if (step > currentStep) {
      const isCurrentStepValid = await validateStep(currentStep);
      if (!isCurrentStepValid) return;

      // Marcar paso actual como completado
      setCompletedSteps(prev => [...new Set([...prev, currentStep])]);
      onStepComplete?.(currentStep, formData);
    }

    setCurrentStep(step);
  }, [currentStep, validateStep, formData, onStepComplete]);

  // Calcular validación de pasos
  const stepValidation = useMemo(() => {
    const validation: Record<number, boolean> = {};
    
    for (let step = 1; step <= 5; step++) {
      const result = validateBookingStep(step, formData);
      validation[step] = result.isValid;
    }
    
    return validation;
  }, [formData]);

  // Calcular si el formulario completo es válido
  const isValid = useMemo(() => {
    return Object.values(stepValidation).every(Boolean);
  }, [stepValidation]);

  // Calcular si se puede proceder
  const canProceed = useMemo(() => {
    return stepValidation[currentStep] || false;
  }, [stepValidation, currentStep]);

  return {
    // Datos
    formData,
    updateFormData,
    setFormData,
    resetForm,
    
    // Validación
    isValid,
    stepValidation,
    errors,
    
    // Estado
    isDirty,
    isCalculating,
    
    // Funciones
    calculatePricing,
    validateStep,
    goToStep,
    
    // Estado de pasos
    currentStep,
    completedSteps,
    canProceed
  };
}

// Hook especializado para gestión de fechas
export function useDateSelection(
  checkInDate: Date | null,
  checkOutDate: Date | null,
  onDatesChange: (checkIn: Date | null, checkOut: Date | null, nights: number) => void
) {
  const setCheckInDate = useCallback((date: Date | null) => {
    let newCheckOut = checkOutDate;
    let nights = 0;

    if (date && checkOutDate && date >= checkOutDate) {
      // Si check-in es después o igual a check-out, ajustar check-out
      newCheckOut = new Date(date);
      newCheckOut.setDate(newCheckOut.getDate() + 1);
    }

    if (date && newCheckOut) {
      nights = Math.ceil((newCheckOut.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    }

    onDatesChange(date, newCheckOut, nights);
  }, [checkOutDate, onDatesChange]);

  const setCheckOutDate = useCallback((date: Date | null) => {
    let nights = 0;

    if (checkInDate && date) {
      nights = Math.ceil((date.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    onDatesChange(checkInDate, date, nights);
  }, [checkInDate, onDatesChange]);

  const setDateRange = useCallback((startDate: Date | null, endDate: Date | null) => {
    let nights = 0;

    if (startDate && endDate) {
      nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    onDatesChange(startDate, endDate, nights);
  }, [onDatesChange]);

  return {
    setCheckInDate,
    setCheckOutDate,
    setDateRange
  };
}

// Hook para gestión de habitaciones
export function useRoomSelection(
  selectedRooms: BookingFormData['selectedRooms'],
  onRoomsChange: (rooms: BookingFormData['selectedRooms']) => void
) {
  const addRoom = useCallback((roomId: string, beds: number, type: 'mixed' | 'female') => {
    const newRooms = [...selectedRooms, { roomId, beds, type }];
    onRoomsChange(newRooms);
  }, [selectedRooms, onRoomsChange]);

  const removeRoom = useCallback((index: number) => {
    const newRooms = selectedRooms.filter((_, i) => i !== index);
    onRoomsChange(newRooms);
  }, [selectedRooms, onRoomsChange]);

  const updateRoom = useCallback((index: number, updates: Partial<BookingFormData['selectedRooms'][0]>) => {
    const newRooms = selectedRooms.map((room, i) => 
      i === index ? { ...room, ...updates } : room
    );
    onRoomsChange(newRooms);
  }, [selectedRooms, onRoomsChange]);

  const getTotalBeds = useCallback(() => {
    return selectedRooms.reduce((total, room) => total + room.beds, 0);
  }, [selectedRooms]);

  return {
    addRoom,
    removeRoom,
    updateRoom,
    getTotalBeds
  };
}

// src/components/forms/booking-form/booking-form.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StepIndicator } from './step-indicator';
import { FormNavigation } from './form-navigation';
import { FormValidation } from './form-validation';
import { DateSelector } from '@/components/booking/date-selector/date-selector';
import { RoomSelector } from '@/components/booking/room-selector/room-selector';
import { PricingCalculator } from '@/components/booking/pricing-calculator/pricing-calculator';
import { GuestForm } from '@/components/booking/guest-information/guest-form';
import { PaymentProcessor } from '@/components/payment/payment-processor';
import { BookingSummary } from '@/components/booking/booking-summary/booking-summary';
import { useBookingForm } from '@/hooks/use-booking-form';
import { useFormPersistence } from '@/hooks/use-form-persistence';
import { validateBookingStep } from './form-validation';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AlertTriangle, CheckCircle2, Calendar, BedDouble, Users, CreditCard, User } from 'lucide-react';

export interface BookingFormData {
  // Fechas
  checkInDate: Date | null;
  checkOutDate: Date | null;
  nights: number;
  
  // Habitaciones y huéspedes
  selectedRooms: Array<{
    roomId: string;
    beds: number;
    type: 'mixed' | 'female';
  }>;
  totalBeds: number;
  
  // Precios
  basePrice: number;
  totalPrice: number;
  groupDiscount: number;
  seasonMultiplier: number;
  finalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  
  // Información del huésped
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCountry: string;
  specialRequests: string;
  
  // Pago
  paymentMethod: 'stripe' | 'mercado_pago';
  paymentType: 'card' | 'pix';
  agreedToTerms: boolean;
  newsletterOptIn: boolean;
}

export interface BookingFormProps {
  initialData?: Partial<BookingFormData>;
  onComplete?: (data: BookingFormData) => void;
  onStepChange?: (step: number) => void;
  className?: string;
}

const BOOKING_STEPS = [
  { id: 1, key: 'dates', icon: Calendar, label: 'Fechas' },
  { id: 2, key: 'rooms', icon: BedDouble, label: 'Habitaciones' },
  { id: 3, key: 'pricing', icon: Users, label: 'Precios' },
  { id: 4, key: 'guest', icon: User, label: 'Información' },
  { id: 5, key: 'payment', icon: CreditCard, label: 'Pago' }
];

export function BookingForm({ 
  initialData, 
  onComplete, 
  onStepChange,
  className 
}: BookingFormProps) {
  const t = useTranslations('booking');
  const router = useRouter();
  
  // Estado del formulario
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Hook personalizado para gestión del formulario
  const {
    formData,
    updateFormData,
    resetForm,
    isValid,
    isDirty
  } = useBookingForm(initialData);

  // Hook para persistencia automática
  const { saveFormData, loadFormData, clearSavedData } = useFormPersistence('lapa-booking-form');

  // Cargar datos guardados al montar
  useEffect(() => {
    const savedData = loadFormData();
    if (savedData && Object.keys(savedData).length > 0) {
      updateFormData(savedData);
    }
  }, [loadFormData, updateFormData]);

  // Guardar datos automáticamente
  useEffect(() => {
    if (isDirty) {
      saveFormData(formData);
    }
  }, [formData, isDirty, saveFormData]);

  // Validación de paso
  const validateCurrentStep = async (): Promise<boolean> => {
    setError(null);
    setValidationErrors({});

    try {
      const validation = await validateBookingStep(currentStep, formData);
      
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        return false;
      }
      
      return true;
    } catch (error) {
      setError('Error de validación. Intenta nuevamente.');
      return false;
    }
  };

  // Navegación entre pasos
  const goToStep = async (step: number) => {
    if (step < currentStep || await validateCurrentStep()) {
      setCurrentStep(step);
      onStepChange?.(step);
    }
  };

  const nextStep = async () => {
    if (currentStep < BOOKING_STEPS.length && await validateCurrentStep()) {
      setCurrentStep(currentStep + 1);
      onStepChange?.(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      onStepChange?.(currentStep - 1);
    }
  };

  // Finalización del formulario
  const handleComplete = async () => {
    if (!await validateCurrentStep()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Procesar reserva
      await onComplete?.(formData);
      
      // Limpiar datos guardados
      clearSavedData();
      
      // Mostrar confirmación
      router.push('/booking/confirmation');
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error al procesar la reserva');
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizado condicional de pasos
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <DateSelector
            checkInDate={formData.checkInDate}
            checkOutDate={formData.checkOutDate}
            onDatesChange={(checkIn, checkOut) => {
              updateFormData({
                checkInDate: checkIn,
                checkOutDate: checkOut,
                nights: checkIn && checkOut ? 
                  Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)) : 0
              });
            }}
            minDate={new Date()}
            errors={validationErrors}
            className="space-y-6"
          />
        );

      case 2:
        return (
          <RoomSelector
            checkInDate={formData.checkInDate}
            checkOutDate={formData.checkOutDate}
            selectedRooms={formData.selectedRooms}
            onRoomsChange={(rooms) => {
              const totalBeds = rooms.reduce((sum, room) => sum + room.beds, 0);
              updateFormData({
                selectedRooms: rooms,
                totalBeds
              });
            }}
            errors={validationErrors}
            className="space-y-6"
          />
        );

      case 3:
        return (
          <PricingCalculator
            checkInDate={formData.checkInDate}
            checkOutDate={formData.checkOutDate}
            totalBeds={formData.totalBeds}
            nights={formData.nights}
            onPriceChange={(pricing) => {
              updateFormData({
                basePrice: pricing.basePrice,
                totalPrice: pricing.totalPrice,
                groupDiscount: pricing.groupDiscount,
                seasonMultiplier: pricing.seasonMultiplier,
                finalPrice: pricing.finalPrice,
                depositAmount: pricing.depositAmount,
                remainingAmount: pricing.remainingAmount
              });
            }}
            className="space-y-6"
          />
        );

      case 4:
        return (
          <GuestForm
            formData={{
              guestName: formData.guestName,
              guestEmail: formData.guestEmail,
              guestPhone: formData.guestPhone,
              guestCountry: formData.guestCountry,
              specialRequests: formData.specialRequests,
              agreedToTerms: formData.agreedToTerms,
              newsletterOptIn: formData.newsletterOptIn
            }}
            onDataChange={(guestData) => {
              updateFormData(guestData);
            }}
            errors={validationErrors}
            className="space-y-6"
          />
        );

      case 5:
        return (
          <div className="space-y-6">
            <BookingSummary
              formData={formData}
              className="mb-6"
            />
            <PaymentProcessor
              amount={formData.depositAmount}
              currency="BRL"
              paymentMethod={formData.paymentMethod}
              onPaymentMethodChange={(method) => {
                updateFormData({ paymentMethod: method });
              }}
              onPaymentComplete={handleComplete}
              bookingData={formData}
              isLoading={isLoading}
              className="space-y-4"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn("max-w-4xl mx-auto", className)}>
      {/* Indicador de progreso */}
      <StepIndicator
        steps={BOOKING_STEPS}
        currentStep={currentStep}
        completedSteps={Array.from({ length: currentStep - 1 }, (_, i) => i + 1)}
        onStepClick={goToStep}
        className="mb-8"
      />

      {/* Contenido principal */}
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            {React.createElement(BOOKING_STEPS[currentStep - 1]?.icon, {
              className: "h-6 w-6 text-primary"
            })}
            {t(`steps.${BOOKING_STEPS[currentStep - 1]?.key}.title`)}
          </CardTitle>
          <p className="text-muted-foreground">
            {t(`steps.${BOOKING_STEPS[currentStep - 1]?.key}.description`)}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Alertas de error */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Contenido del paso actual */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            renderStepContent()
          )}

          {/* Validación en tiempo real */}
          <FormValidation
            step={currentStep}
            data={formData}
            errors={validationErrors}
            className="mt-4"
          />
        </CardContent>

        {/* Navegación */}
        <div className="border-t px-6 py-4">
          <FormNavigation
            currentStep={currentStep}
            totalSteps={BOOKING_STEPS.length}
            onPrevious={prevStep}
            onNext={nextStep}
            onComplete={handleComplete}
            isValid={isValid}
            isLoading={isLoading}
            className="flex justify-between"
          />
        </div>
      </Card>

      {/* Información adicional */}
      {currentStep === 1 && (
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">{t('info.specialization.title')}</p>
                <p>{t('info.specialization.description')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

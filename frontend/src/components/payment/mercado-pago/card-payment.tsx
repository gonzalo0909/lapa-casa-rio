// lapa-casa-hostel-frontend/src/components/payment/mercado-pago/card-payment.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useBookingStore } from '@/stores/booking-store';
import { CreditCard, Shield, Lock, Calendar, User, Hash } from 'lucide-react';

interface CardPaymentMPProps {
  preferenceId: string;
  amount: number;
  currency: string;
  installments: number;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

interface CardForm {
  cardNumber: string;
  cardholderName: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode: string;
  documentType: string;
  documentNumber: string;
}

const CardPaymentMP: React.FC<CardPaymentMPProps> = ({
  preferenceId,
  amount,
  currency,
  installments,
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing
}) => {
  const [formData, setFormData] = useState<CardForm>({
    cardNumber: '',
    cardholderName: '',
    expirationMonth: '',
    expirationYear: '',
    securityCode: '',
    documentType: 'CPF',
    documentNumber: ''
  });

  const [errors, setErrors] = useState<Partial<CardForm>>({});
  const [cardType, setCardType] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  const [mpInstance, setMpInstance] = useState<any>(null);

  const { bookingData } = useBookingStore();

  // Initialize Mercado Pago SDK
  useEffect(() => {
    if (window.MercadoPago) {
      const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY, {
        locale: 'pt-BR'
      });
      setMpInstance(mp);
    }
  }, []);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  // Generate months array
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = (i + 1).toString().padStart(2, '0');
    return { value: month, label: month };
  });

  // Generate years array
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 20 }, (_, i) => {
    const year = currentYear + i;
    return { value: year.toString(), label: year.toString() };
  });

  // Detect card type from number
  const detectCardType = (cardNumber: string) => {
    const cleanNumber = cardNumber.replace(/\s+/g, '');
    
    if (cleanNumber.match(/^4/)) return 'visa';
    if (cleanNumber.match(/^5[1-5]/)) return 'mastercard';
    if (cleanNumber.match(/^3[47]/)) return 'amex';
    if (cleanNumber.match(/^6/)) return 'discover';
    
    return '';
  };

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const cleanValue = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = cleanValue.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return cleanValue;
    }
  };

  // Handle form field changes
  const handleFieldChange = (field: keyof CardForm, value: string) => {
    let formattedValue = value;

    // Format card number
    if (field === 'cardNumber') {
      formattedValue = formatCardNumber(value);
      setCardType(detectCardType(formattedValue));
    }

    // Format document number
    if (field === 'documentNumber' && formData.documentType === 'CPF') {
      formattedValue = value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    setFormData(prev => ({ ...prev, [field]: formattedValue }));

    // Clear field error
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Partial<CardForm> = {};

    if (!formData.cardNumber || formData.cardNumber.replace(/\s/g, '').length < 13) {
      newErrors.cardNumber = 'Número de tarjeta inválido';
    }

    if (!formData.cardholderName.trim()) {
      newErrors.cardholderName = 'Nombre del titular requerido';
    }

    if (!formData.expirationMonth) {
      newErrors.expirationMonth = 'Mes de expiración requerido';
    }

    if (!formData.expirationYear) {
      newErrors.expirationYear = 'Año de expiración requerido';
    }

    if (!formData.securityCode || formData.securityCode.length < 3) {
      newErrors.securityCode = 'Código de seguridad inválido';
    }

    if (!formData.documentNumber.trim()) {
      newErrors.documentNumber = 'Documento requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit payment
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!mpInstance) {
      onError('Mercado Pago no está disponible');
      return;
    }

    setIsProcessing(true);

    try {
      // Create card token
      const cardData = {
        cardNumber: formData.cardNumber.replace(/\s/g, ''),
        cardholderName: formData.cardholderName,
        cardExpirationMonth: formData.expirationMonth,
        cardExpirationYear: formData.expirationYear,
        securityCode: formData.securityCode,
        identificationType: formData.documentType,
        identificationNumber: formData.documentNumber.replace(/\D/g, '')
      };

      const tokenResponse = await mpInstance.createCardToken(cardData);

      if (tokenResponse.error) {
        throw new Error(tokenResponse.error.message);
      }

      // Process payment with token
      const paymentResponse = await api.post('/payments/mercado-pago/process-card', {
        preferenceId,
        cardToken: tokenResponse.id,
        installments,
        amount,
        currency,
        description: `Depósito reserva Lapa Casa Hostel`,
        payerEmail: bookingData.guestEmail,
        payerName: bookingData.guestName,
        payerPhone: bookingData.guestPhone,
        payerDocument: {
          type: formData.documentType,
          number: formData.documentNumber.replace(/\D/g, '')
        },
        metadata: {
          bookingId: preferenceId,
          roomId: bookingData.roomId,
          checkInDate: bookingData.checkInDate?.toISOString(),
          checkOutDate: bookingData.checkOutDate?.toISOString()
        }
      });

      const { payment } = paymentResponse.data;

      if (payment.status === 'approved') {
        onSuccess(payment.id);
      } else if (payment.status === 'pending') {
        onError('Pago pendiente de aprobación. Te notificaremos cuando sea procesado.');
      } else {
        onError(payment.status_detail || 'Pago rechazado');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Error procesando el pago';
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Información de la Tarjeta
          {cardType && (
            <Badge variant="outline" className="ml-2">
              {cardType.toUpperCase()}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card Number */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Número de la Tarjeta
            </label>
            <div className="relative">
              <Input
                type="text"
                value={formData.cardNumber}
                onChange={(e) => handleFieldChange('cardNumber', e.target.value)}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                className={errors.cardNumber ? 'border-red-500' : ''}
              />
              <Hash className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
            </div>
            {errors.cardNumber && (
              <p className="text-sm text-red-600">{errors.cardNumber}</p>
            )}
          </div>

          {/* Cardholder Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Nombre del Titular
            </label>
            <div className="relative">
              <Input
                type="text"
                value={formData.cardholderName}
                onChange={(e) => handleFieldChange('cardholderName', e.target.value.toUpperCase())}
                placeholder="NOMBRE COMO APARECE EN LA TARJETA"
                className={errors.cardholderName ? 'border-red-500' : ''}
              />
              <User className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
            </div>
            {errors.cardholderName && (
              <p className="text-sm text-red-600">{errors.cardholderName}</p>
            )}
          </div>

          {/* Expiration and Security Code */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Mes</label>
              <Select
                value={formData.expirationMonth}
                onValueChange={(value) => handleFieldChange('expirationMonth', value)}
              >
                <SelectTrigger className={errors.expirationMonth ? 'border-red-500' : ''}>
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.expirationMonth && (
                <p className="text-sm text-red-600">{errors.expirationMonth}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Año</label>
              <Select
                value={formData.expirationYear}
                onValueChange={(value) => handleFieldChange('expirationYear', value)}
              >
                <SelectTrigger className={errors.expirationYear ? 'border-red-500' : ''}>
                  <SelectValue placeholder="AAAA" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.expirationYear && (
                <p className="text-sm text-red-600">{errors.expirationYear}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">CVV</label>
              <div className="relative">
                <Input
                  type="password"
                  value={formData.securityCode}
                  onChange={(e) => handleFieldChange('securityCode', e.target.value.replace(/\D/g, ''))}
                  placeholder="123"
                  maxLength={4}
                  className={errors.securityCode ? 'border-red-500' : ''}
                />
                <Lock className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
              </div>
              {errors.securityCode && (
                <p className="text-sm text-red-600">{errors.securityCode}</p>
              )}
            </div>
          </div>

          {/* Document Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Tipo de Documento</label>
              <Select
                value={formData.documentType}
                onValueChange={(value) => handleFieldChange('documentType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-medium">
                Número de {formData.documentType}
              </label>
              <Input
                type="text"
                value={formData.documentNumber}
                onChange={(e) => handleFieldChange('documentNumber', e.target.value)}
                placeholder={formData.documentType === 'CPF' ? '123.456.789-10' : '12.345.678/0001-90'}
                className={errors.documentNumber ? 'border-red-500' : ''}
              />
              {errors.documentNumber && (
                <p className="text-sm text-red-600">{errors.documentNumber}</p>
              )}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Monto a pagar:</span>
              <span className="font-semibold">{formatCurrency(amount)}</span>
            </div>
            {installments > 1 && (
              <div className="flex justify-between text-sm">
                <span>Cuotas:</span>
                <span>{installments}x de {formatCurrency(amount / installments)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-600">
              <span>Procesado por:</span>
              <span>Mercado Pago</span>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isProcessing || !mpInstance}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner className="w-4 h-4" />
                Procesando pago...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                {installments > 1 
                  ? `Pagar en ${installments}x` 
                  : `Pagar ${formatCurrency(amount)}`
                }
              </div>
            )}
          </Button>

          {/* Security Notice */}
          <div className="text-center text-sm text-gray-600">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="w-4 h-4" />
              <span>Pago seguro con Mercado Pago</span>
            </div>
            <p>Tu información está protegida con encriptación SSL</p>
          </div>

          {/* Accepted Cards */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Tarjetas Aceptadas:</p>
            <div className="flex justify-center gap-2">
              <div className="px-3 py-1 bg-blue-600 text-white text-xs rounded">VISA</div>
              <div className="px-3 py-1 bg-red-600 text-white text-xs rounded">Mastercard</div>
              <div className="px-3 py-1 bg-orange-600 text-white text-xs rounded">Elo</div>
              <div className="px-3 py-1 bg-green-600 text-white text-xs rounded">Hipercard</div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CardPaymentMP;

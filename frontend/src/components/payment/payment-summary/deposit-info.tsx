// lapa-casa-hostel-frontend/src/components/payment/payment-summary/deposit-info.tsx

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Clock, CreditCard, Shield, AlertCircle } from 'lucide-react';

interface DepositInfoProps {
  amount: number;
  totalAmount: number;
  currency: string;
  checkInDate: Date;
  bedsCount: number;
  className?: string;
}

const DepositInfo: React.FC<DepositInfoProps> = ({
  amount,
  totalAmount,
  currency,
  checkInDate,
  bedsCount,
  className
}) => {
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  // Calculate deposit percentage
  const depositPercentage = Math.round((amount / totalAmount) * 100);
  const remainingAmount = totalAmount - amount;
  const remainingPercentage = 100 - depositPercentage;

  // Calculate days until check-in
  const today = new Date();
  const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate automatic charge date (7 days before check-in)
  const autoChargeDate = new Date(checkInDate);
  autoChargeDate.setDate(autoChargeDate.getDate() - 7);

  // Determine if large group
  const isLargeGroup = bedsCount >= 15;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Información del Depósito
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Deposit Amount Display */}
        <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {formatCurrency(amount)}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            Depósito requerido ({depositPercentage}%)
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm">Total de la reserva:</span>
            <span className="font-medium">{formatCurrency(totalAmount)}</span>
          </div>
          
          <div className="flex justify-between items-center text-blue-600">
            <span className="text-sm">Depósito ahora ({depositPercentage}%):</span>
            <span className="font-semibold">{formatCurrency(amount)}</span>
          </div>
          
          <div className="flex justify-between items-center text-gray-600">
            <span className="text-sm">Saldo restante ({remainingPercentage}%):</span>
            <span className="font-medium">{formatCurrency(remainingAmount)}</span>
          </div>
        </div>

        <Separator />

        {/* Deposit Policy Information */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">¿Por qué cobramos depósito?</h4>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
              <span>Confirma tu reserva inmediatamente</span>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-green-600 mt-0.5" />
              <span>Garantiza tu lugar en las fechas seleccionadas</span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-green-600 mt-0.5" />
              <span>Permite flexibilidad en el pago final</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Remaining Payment Information */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pago del Saldo Restante
          </h4>
          
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Monto:</span>
              <span className="font-medium">{formatCurrency(remainingAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Fecha de cobro:</span>
              <span className="font-medium">
                {autoChargeDate.toLocaleDateString('pt-BR', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Método:</span>
              <span className="font-medium">Automático (misma tarjeta)</span>
            </div>
          </div>
        </div>

        {/* Group Size Badge */}
        {isLargeGroup && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              <strong>Grupo Grande:</strong> Para reservas de 15+ personas, requerimos depósito del 50% para garantizar disponibilidad.
            </AlertDescription>
          </Alert>
        )}

        {/* Important Notes */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Información Importante</h4>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full mt-2"></div>
              <span>El saldo restante será cobrado automáticamente 7 días antes de tu check-in</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full mt-2"></div>
              <span>Recibirás un email de confirmación después del pago del depósito</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full mt-2"></div>
              <span>Te notificaremos 3 días antes del cobro automático del saldo</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full mt-2"></div>
              <span>Puedes cambiar el método de pago contactando nuestro soporte</span>
            </div>
          </div>
        </div>

        {/* Timeline Preview */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Cronograma de Pagos</h4>
          <div className="space-y-2">
            {/* Today */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Hoy</p>
                <p className="text-xs text-gray-600">
                  Pago del depósito: {formatCurrency(amount)}
                </p>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Ahora
              </Badge>
            </div>

            {/* Auto charge date */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {autoChargeDate.toLocaleDateString('pt-BR', { 
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-xs text-gray-600">
                  Cobro automático del saldo: {formatCurrency(remainingAmount)}
                </p>
              </div>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                Automático
              </Badge>
            </div>

            {/* Check-in date */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {checkInDate.toLocaleDateString('pt-BR', { 
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-xs text-gray-600">Check-in en Lapa Casa Hostel</p>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Check-in
              </Badge>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg">
          <Shield className="w-4 h-4 text-green-600" />
          <div className="text-sm text-green-700 dark:text-green-300">
            <p className="font-medium">Pago Seguro</p>
            <p className="text-xs">Tu información está protegida con encriptación de nivel bancario</p>
          </div>
        </div>

        {/* Contact Information */}
        <div className="text-center text-xs text-gray-600">
          <p>¿Tienes preguntas sobre el depósito?</p>
          <p>Contacta: <span className="font-medium">reservas@lapacasahostel.com</span></p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DepositInfo;

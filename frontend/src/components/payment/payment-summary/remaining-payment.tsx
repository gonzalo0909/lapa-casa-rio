// lapa-casa-hostel-frontend/src/components/payment/payment-summary/remaining-payment.tsx

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Clock, CreditCard, Calendar, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface RemainingPaymentProps {
  amount: number;
  totalAmount: number;
  currency: string;
  checkInDate: Date;
  bookingId: string;
  paymentStatus: 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed';
  autoChargeDate: Date;
  onPayNow?: () => void;
  onReschedule?: () => void;
  className?: string;
}

const RemainingPayment: React.FC<RemainingPaymentProps> = ({
  amount,
  totalAmount,
  currency,
  checkInDate,
  bookingId,
  paymentStatus,
  autoChargeDate,
  onPayNow,
  onReschedule,
  className
}) => {
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  // Calculate paid amount (deposit)
  const paidAmount = totalAmount - amount;
  const paidPercentage = Math.round((paidAmount / totalAmount) * 100);
  const remainingPercentage = 100 - paidPercentage;

  // Calculate days until auto charge
  const today = new Date();
  const daysUntilAutoCharge = Math.ceil((autoChargeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Get status configuration
  const getStatusConfig = () => {
    switch (paymentStatus) {
      case 'pending':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: Clock,
          title: 'Pago Pendiente',
          description: 'El saldo será cobrado automáticamente'
        };
      case 'scheduled':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Calendar,
          title: 'Pago Programado',
          description: 'Cobro automático confirmado'
        };
      case 'processing':
        return {
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          icon: RefreshCw,
          title: 'Procesando Pago',
          description: 'Procesando cobro automático'
        };
      case 'completed':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle,
          title: 'Pago Completado',
          description: 'Saldo pagado exitosamente'
        };
      case 'failed':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: AlertTriangle,
          title: 'Pago Fallido',
          description: 'Error procesando el cobro'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: Clock,
          title: 'Estado Desconocido',
          description: ''
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Pago del Saldo Restante
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <Badge className={statusConfig.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusConfig.title}
          </Badge>
          <span className="text-sm text-gray-600">
            Reserva: {bookingId}
          </span>
        </div>

        {/* Amount Display */}
        <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {formatCurrency(amount)}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            Saldo restante ({remainingPercentage}%)
          </div>
        </div>

        {/* Payment Progress */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span>Progreso del pago:</span>
            <span className="font-medium">{paidPercentage}% completado</span>
          </div>
          
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${paidPercentage}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between text-xs text-gray-600">
            <span>Pagado: {formatCurrency(paidAmount)}</span>
            <span>Restante: {formatCurrency(amount)}</span>
          </div>
        </div>

        <Separator />

        {/* Auto Charge Information */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Cobro Automático Programado
          </h4>
          
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2">
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
              <span>Días restantes:</span>
              <span className="font-medium">
                {daysUntilAutoCharge > 0 ? `${daysUntilAutoCharge} días` : 'Hoy'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Monto:</span>
              <span className="font-medium">{formatCurrency(amount)}</span>
            </div>
          </div>
        </div>

        {/* Status-specific Content */}
        {paymentStatus === 'pending' && daysUntilAutoCharge <= 7 && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              Tu saldo será cobrado automáticamente en {daysUntilAutoCharge} días. 
              Asegúrate de que tu tarjeta tenga fondos suficientes.
            </AlertDescription>
          </Alert>
        )}

        {paymentStatus === 'failed' && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              No pudimos procesar tu pago automático. Por favor, actualiza tu método de pago o paga manualmente.
            </AlertDescription>
          </Alert>
        )}

        {paymentStatus === 'completed' && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-300">
              Tu pago ha sido procesado exitosamente. Estás listo para el check-in.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        {paymentStatus !== 'completed' && (
          <div className="space-y-2">
            {onPayNow && (
              <Button 
                onClick={onPayNow}
                className="w-full"
                variant={paymentStatus === 'failed' ? 'default' : 'outline'}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Pagar Ahora
              </Button>
            )}
            
            {onReschedule && paymentStatus === 'pending' && (
              <Button 
                onClick={onReschedule}
                variant="outline"
                className="w-full"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Reprogramar Cobro
              </Button>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Cronograma Restante</h4>
          <div className="space-y-2">
            {/* Auto charge */}
            {paymentStatus !== 'completed' && (
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  paymentStatus === 'processing' ? 'bg-orange-500 animate-pulse' :
                  paymentStatus === 'failed' ? 'bg-red-500' :
                  daysUntilAutoCharge <= 0 ? 'bg-blue-600' : 'bg-gray-400'
                }`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {autoChargeDate.toLocaleDateString('pt-BR', { 
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                  <p className="text-xs text-gray-600">Cobro automático del saldo</p>
                </div>
                <Badge 
                  variant="outline" 
                  className={

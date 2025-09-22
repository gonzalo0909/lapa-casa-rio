// lapa-casa-hostel-frontend/src/components/payment/payment-summary/payment-schedule.tsx

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar, CheckCircle, Clock, CreditCard, AlertTriangle, Download } from 'lucide-react';

interface PaymentScheduleProps {
  bookingId: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  currency: string;
  checkInDate: Date;
  createdDate: Date;
  autoChargeDate: Date;
  payments: PaymentRecord[];
  onDownloadReceipt?: (paymentId: string) => void;
  className?: string;
}

interface PaymentRecord {
  id: string;
  type: 'deposit' | 'remaining' | 'full';
  amount: number;
  status: 'completed' | 'pending' | 'scheduled' | 'failed' | 'cancelled';
  paymentMethod: string;
  processedDate?: Date;
  scheduledDate?: Date;
  failureReason?: string;
  transactionId?: string;
}

const PaymentSchedule: React.FC<PaymentScheduleProps> = ({
  bookingId,
  totalAmount,
  depositAmount,
  remainingAmount,
  currency,
  checkInDate,
  createdDate,
  autoChargeDate,
  payments,
  onDownloadReceipt,
  className
}) => {
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get payment status configuration
  const getPaymentStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle,
          text: 'Completado'
        };
      case 'pending':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: Clock,
          text: 'Pendiente'
        };
      case 'scheduled':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Calendar,
          text: 'Programado'
        };
      case 'failed':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: AlertTriangle,
          text: 'Fallido'
        };
      case 'cancelled':
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: AlertTriangle,
          text: 'Cancelado'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: Clock,
          text: status
        };
    }
  };

  // Calculate payment summary
  const completedPayments = payments.filter(p => p.status === 'completed');
  const paidAmount = completedPayments.reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = totalAmount - paidAmount;

  // Generate timeline events
  const timelineEvents = [
    {
      id: 'booking-created',
      date: createdDate,
      title: 'Reserva Creada',
      description: `Reserva ${bookingId} creada`,
      type: 'info',
      icon: Calendar,
      status: 'completed'
    },
    ...payments.map(payment => ({
      id: payment.id,
      date: payment.processedDate || payment.scheduledDate || new Date(),
      title: payment.type === 'deposit' ? 'Depósito' : 'Saldo Restante',
      description: `${formatCurrency(payment.amount)} - ${payment.paymentMethod}`,
      type: 'payment',
      icon: CreditCard,
      status: payment.status,
      payment
    })),
    {
      id: 'check-in',
      date: checkInDate,
      title: 'Check-in',
      description: 'Llegada a Lapa Casa Hostel',
      type: 'milestone',
      icon: CheckCircle,
      status: new Date() >= checkInDate ? 'completed' : 'pending'
    }
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Cronograma de Pagos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg">
            <div className="text-lg font-semibold text-green-700 dark:text-green-300">
              {formatCurrency(paidAmount)}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400">Pagado</div>
          </div>
          
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 rounded-lg">
            <div className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
              {formatCurrency(pendingAmount)}
            </div>
            <div className="text-sm text-yellow-600 dark:text-yellow-400">Pendiente</div>
          </div>
          
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg">
            <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
              {formatCurrency(totalAmount)}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">Total</div>
          </div>
        </div>

        <Separator />

        {/* Payment Timeline */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Cronograma Detallado</h4>
          
          <div className="space-y-4">
            {timelineEvents.map((event, index) => {
              const isLast = index === timelineEvents.length - 1;
              const StatusIcon = event.icon;
              const statusConfig = getPaymentStatusConfig(event.status);
              
              return (
                <div key={event.id} className="flex items-start gap-3">
                  {/* Timeline Line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full border-2 ${
                      event.status === 'completed' 
                        ? 'bg-green-500 border-green-500' 
                        : event.status === 'failed'
                        ? 'bg-red-500 border-red-500'
                        : 'bg-white border-gray-300'
                    }`}></div>
                    {!isLast && (
                      <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-700 mt-1"></div>
                    )}
                  </div>

                  {/* Event Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIcon className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-sm">{event.title}</span>
                      <Badge className={statusConfig.color}>
                        {statusConfig.text}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-1">{event.description}</p>
                    <p className="text-xs text-gray-500">{formatDate(event.date)}</p>

                    {/* Payment-specific details */}
                    {event.type === 'payment' && event.payment && (
                      <div className="mt-2 space-y-1">
                        {event.payment.transactionId && (
                          <p className="text-xs text-gray-500">
                            ID: {event.payment.transactionId}
                          </p>
                        )}
                        
                        {event.payment.failureReason && (
                          <p className="text-xs text-red-600">
                            Error: {event.payment.failureReason}
                          </p>
                        )}
                        
                        {event.payment.status === 'completed' && onDownloadReceipt && (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => onDownloadReceipt(event.payment!.id)}
                            className="h-auto p-0 text-xs"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Descargar Recibo
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Amount Display */}
                  {event.type === 'payment' && event.payment && (
                    <div className="text-right">
                      <div className={`font-medium text-sm ${
                        event.payment.status === 'completed' 
                          ? 'text-green-600' 
                          : event.payment.status === 'failed'
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}>
                        {formatCurrency(event.payment.amount)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Upcoming Events */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Próximos Eventos</h4>
          
          <div className="space-y-2">
            {/* Auto charge reminder */}
            {pendingAmount > 0 && autoChargeDate > new Date() && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg">
                <Clock className="w-4 h-4 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Cobro automático programado
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {formatDate(autoChargeDate)} - {formatCurrency(remainingAmount)}
                  </p>
                </div>
              </div>
            )}

            {/* Check-in reminder */}
            {checkInDate > new Date() && (
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    Check-in programado
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {formatDate(checkInDate)} - Lapa Casa Hostel
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods Summary */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Métodos de Pago Utilizados</h4>
          
          <div className="space-y-2">
            {Array.from(new Set(completedPayments.map(p => p.paymentMethod))).map(method => {
              const methodPayments = completedPayments.filter(p => p.paymentMethod === method);
              const methodTotal = methodPayments.reduce((sum, p) => sum + p.amount, 0);
              
              return (
                <div key={method} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-gray-600" />
                    <span className="text-sm capitalize">{method}</span>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(methodTotal)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Important Notes */}
        <div className="text-xs text-gray-600 space-y-1 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p>• Todos los horarios están en hora local de Brasil</p>
          <p>• Los cobros automáticos se procesan a las 10:00 AM</p>
          <p>• Recibirás email de confirmación para cada pago</p>
          <p>• Los recibos están disponibles por 2 años</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentSchedule;

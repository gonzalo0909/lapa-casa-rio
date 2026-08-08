// lapa-casa-hostel/backend/src/routes/payments/confirm-payment.ts
// ventana3
// ventana4: el email de pago recibido se centralizó en PaymentService.handlePaymentSucceeded() (ver payment-service.ts) -- ya no se dispara desde acá, para no duplicar con el webhook real

import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../services/payment-service';
import { bookingService } from '../../services/booking-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

interface ConfirmPaymentRequest {
  paymentId: string;
}

export const confirmPaymentHandler = async (
  req: Request<{}, {}, ConfirmPaymentRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { paymentId } = req.body;

    logger.info('Confirmando pago', { paymentId });

    const payment = await paymentService.getPaymentById(paymentId);

    if (!payment) {
      res.status(404).json(ApiResponse.error('Pago no encontrado', { paymentId }));
      return;
    }

    if (payment.status === 'succeeded') {
      res.status(400).json(ApiResponse.error('El pago ya fue confirmado'));
      return;
    }

    if (payment.status === 'failed') {
      res.status(400).json(ApiResponse.error('No se puede confirmar un pago fallido'));
      return;
    }

    const confirmedPayment = await paymentService.confirmPaymentById(paymentId);

    const booking = await bookingService.getBooking(payment.reservation_id);
    if (!booking) throw new Error('Reserva no encontrada para el pago confirmado');

    const allPayments = await paymentService.getPaymentsByReservation(payment.reservation_id);
    // El recargo por tarjeta (ver process-deposit.ts) no es progreso real
    // hacia el precio de la reserva -- es la comisión de Stripe. Para el
    // saldo restante se usa provider_metadata.base_amount cuando existe
    // (pagos con recargo), y el monto bruto para el resto (PIX, pagos
    // viejos sin recargo).
    const totalPaid = allPayments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => {
        const baseAmount = (p.provider_metadata as { base_amount?: number } | null)?.base_amount;
        return sum + (baseAmount ?? Number(p.amount));
      }, 0);

    const finalPrice = Number(booking.final_price);
    const depositAmount = Number(booking.deposit_amount);
    const isDepositPaid = totalPaid >= depositAmount;
    const isFullyPaid = totalPaid >= finalPrice;

    // ventana4: el email de "pago recibido" (y el scheduling de saldo /
    // bienvenida si corresponde) ya se dispara dentro de
    // paymentService.confirmPaymentById() -- ver
    // PaymentService.handlePaymentSucceeded(), el mismo punto que usa el
    // webhook real de Stripe/MercadoPago. No se duplica aca.

    res.status(200).json(
      ApiResponse.success({
        payment: {
          id: confirmedPayment.id,
          status: 'completed',
          amount: Number(confirmedPayment.amount),
          currency: confirmedPayment.currency,
          type: confirmedPayment.payment_type,
          paidAt: confirmedPayment.paid_at,
        },
        booking: {
          id: booking.id,
          confirmationNumber: `LCH-${booking.id.substring(0, 8).toUpperCase()}`,
          status: booking.status,
          totalPaid,
          remainingBalance: finalPrice - totalPaid,
          isDepositPaid,
          isFullyPaid,
        },
        nextSteps: isFullyPaid
          ? {
              message: 'Tu reserva está completamente pagada y confirmada.',
              checkInDate: booking.check_in_date,
              checkInTime: '14:00',
              address: 'Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro',
            }
          : {
              message: 'Depósito pagado. El saldo restante vence 7 días antes del check-in.',
              remainingAmount: finalPrice - totalPaid,
              dueDate: new Date(
                new Date(booking.check_in_date).getTime() - 7 * 24 * 60 * 60 * 1000
              ).toISOString(),
            },
      }, 'Pago confirmado exitosamente')
    );
  } catch (error) {
    logger.error('Error al confirmar pago', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};

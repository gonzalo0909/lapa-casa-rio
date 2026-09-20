// email de cancelación vía notificationService.notify('cancellation', ...); de paso corrige un bug real que rompía esta ruta (booking.final_price llegaba como Decimal de Prisma a un parámetro de pg crudo)

import type { Request, Response, NextFunction } from 'express';
import { bookingService } from '../../services/booking-service';
import { paymentService } from '../../services/payment-service';
import { notificationService } from '../../services/notification-service';
import type { BookingWithGuest } from '../../services/email-service';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

export const cancelBookingHandler = async (
  req: Request<{ id: string }, {}, {}, { reason?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.query;

    logger.info('Cancelando reserva', { bookingId: id, reason });

    const booking = await bookingService.getBooking(id);

    if (!booking) {
      res.status(404).json(ApiResponse.error('Reserva no encontrada', { bookingId: id }));
      return;
    }

    if (booking.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('La reserva ya está cancelada'));
      return;
    }

    if (booking.status === 'completed') {
      res.status(400).json(ApiResponse.error('No se puede cancelar una reserva completada'));
      return;
    }

    const checkInDate = new Date(booking.check_in_date);
    const now = new Date();
    if (checkInDate < now) {
      res.status(400).json(ApiResponse.error('No se puede cancelar una reserva después del check-in'));
      return;
    }

    // Calcular reembolso con la función SQL (política real: 168h/48h).
    // booking.final_price viene de Prisma como Decimal -- pasado tal cual a
    // un parámetro de pg (raw query), pg lo serializa con JSON.stringify(),
    // que via el toJSON() de Decimal produce la STRING '"114"' (con
    // comillas incluidas), no el número: Postgres rechazaba el literal con
    // "invalid input syntax for type numeric". Number(...) lo evita.
    const finalPrice = Number(booking.final_price);
    const refundResult = await query<{ refund_amount: string }>(
      `SELECT calculate_cancellation_refund($1, $2::date, NOW()) AS refund_amount`,
      [finalPrice, booking.check_in_date]
    );
    const refundAmount = parseFloat(refundResult.rows[0]?.refund_amount ?? '0');
    const refundPercentage = finalPrice > 0
      ? Math.round((refundAmount / finalPrice) * 100)
      : 0;

    const payments = await paymentService.getPaymentsByReservation(id);
    const completedPayments = payments.filter(p => p.status === 'succeeded');
    const totalPaid = completedPayments.reduce((sum, p) => sum + (p.provider_metadata?.base_amount ?? Number(p.amount)), 0);

    // El monto real a reembolsar está limitado por lo que efectivamente pagó el huésped
    const actualRefund = Math.min(refundAmount, totalPaid);

    logger.info('Política de reembolso calculada', {
      bookingId: id,
      finalPrice: booking.final_price,
      refundAmount,
      actualRefund,
      totalPaid,
    });

    // La cancelación de la reserva es independiente del resultado del reembolso.
    // Se cancela primero; si el reembolso falla, la reserva igual queda cancelada
    // y se marca para gestión manual — nunca se bloquea la cancelación por un
    // fallo transitorio de la pasarela de pago.
    await bookingService.cancelBooking(id, reason || undefined);

    // Fix #3: revertir R$5 del premio de referido si esta reserva usó un código de referido
    try {
      const { rows: offerRows } = await query<{ id: number; discount_amount: number }>(
        `SELECT ao.id, ao.discount_amount::float AS discount_amount
         FROM reservations r
         JOIN apartment_offers ao ON r.applied_offer_code = ao.code
         WHERE r.id = $1 AND ao.referral_owner_guest_id IS NOT NULL`,
        [id],
      );
      if (offerRows.length > 0) {
        const newAmount = (offerRows[0].discount_amount ?? 0) - 5;
        await query(
          `UPDATE apartment_offers
           SET discount_amount = GREATEST(0, discount_amount - 5),
               is_active = CASE WHEN $1 <= 0 THEN false ELSE is_active END
           WHERE id = $2`,
          [newAmount, offerRows[0].id],
        );
        logger.info('Premio de referido revertido por cancelación', {
          bookingId: id,
          offerId: offerRows[0].id,
          newAmount: Math.max(0, newAmount),
        });
      }
    } catch (revertError) {
      logger.error('No se pudo revertir premio de referido', { bookingId: id, error: String(revertError) });
    }

    let refundStatus: 'processed' | 'not_applicable' | 'pending_manual' = 'not_applicable';
    if (actualRefund > 0 && completedPayments.length > 0) {
      try {
        await paymentService.processRefund({
          reservation_id: id,
          amount: actualRefund,
          reason: reason || 'Cancelado por el huésped',
        });
        refundStatus = 'processed';
      } catch (error) {
        refundStatus = 'pending_manual';
        logger.error('Error al procesar reembolso — reserva cancelada, reembolso pendiente manual', {
          bookingId: id,
          actualRefund,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Reserva cancelada', { bookingId: id, refundAmount: actualRefund });

    if (booking.guest) {
      notificationService
        .notify('cancellation', booking as BookingWithGuest, { refundAmount: actualRefund })
        .catch((error: Error) => {
          logger.error('Error al enviar email de cancelación', { bookingId: id, error: error.message });
        });
    }

    res.status(200).json(
      ApiResponse.success({
        booking: {
          id: booking.id,
          confirmationNumber: booking.reservation_number,
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
        },
        refund: {
          eligible: actualRefund > 0,
          amount: actualRefund,
          percentage: refundPercentage,
          originalAmount: totalPaid,
          currency: 'BRL',
          processingTime: '5-10 días hábiles',
          status: refundStatus,
        },
      }, 'Reserva cancelada exitosamente')
    );
  } catch (error) {
    logger.error('Error al cancelar reserva', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};

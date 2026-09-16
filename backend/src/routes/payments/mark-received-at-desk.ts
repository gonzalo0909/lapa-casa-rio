// lapa-casa-hostel/backend/src/routes/payments/mark-received-at-desk.ts
// POST /payments/mark-received-at-desk
//
// Registra pagos que se hacen en la recepción con la máquina física:
//   - InfinityPay (terminal físico de InfinityPay)
//   - Efectivo (cash)
//
// Caso de uso:
//   El huésped paga en la recepción del hostel o del apartamento.
//   El admin registra manualmente el pago en el sistema para que la reserva
//   quede actualizada (y no aparezca como pendiente de pago para siempre).
//
// No conecta con ninguna API externa — es un registro manual puro.
// La auditoría queda en el audit_log con el usuario admin que lo registró.
//
// Seguridad: authenticateToken + requireRole(['admin']) requeridos.

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { auditLogService } from '../../services/audit-log-service';
import { ApiResponse } from '../../utils/responses';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validation';

const router = Router();

const MarkReceivedSchema = z.object({
  reservationId: z.string().trim().min(1),
  method: z.enum(['infinitypay', 'cash']),
  amount: z.number().positive(),
  paymentType: z.enum(['deposit', 'remaining']).default('remaining'),
  notes: z.string().optional(),
});

/**
 * POST /payments/mark-received-at-desk
 *
 * Body:
 *   reservationId  — UUID de la reserva
 *   method         — 'infinitypay' | 'cash'
 *   amount         — monto cobrado (BRL)
 *   paymentType    — 'deposit' | 'remaining'  (default: 'remaining')
 *   notes          — opcional: referencia del comprobante, observación, etc.
 */
router.post(
  '/',
  authenticateToken,
  requireRole(['admin']),
  validate(MarkReceivedSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        reservationId,
        method,
        amount,
        paymentType,
        notes,
      } = req.body as z.infer<typeof MarkReceivedSchema>;

      const amountNum = parseFloat(Number(amount).toFixed(2));

      // ─── Verificar que la reserva existe ────────────────────────────────────

      const { rows: reservationRows } = await query(
        `SELECT id, reservation_number, status, guest_id, final_price, deposit_amount, remaining_amount
         FROM reservations WHERE id = $1`,
        [reservationId]
      );

      if (reservationRows.length === 0) {
        throw new AppError('Reserva no encontrada', 404);
      }

      const reservation = reservationRows[0];

      if (!['pending_payment', 'confirmed', 'checked-in'].includes(reservation.status)) {
        throw new AppError(
          `No se puede registrar un pago en una reserva con estado "${reservation.status}"`,
          400
        );
      }

      // ─── Insertar el pago directamente como 'succeeded' ─────────────────────
      // (no pasa por Stripe — es un registro manual de pago físico)

      const { rows: paymentRows } = await query(
        `INSERT INTO payments
           (reservation_id, guest_id, provider, payment_type, amount, currency,
            status, paid_at, provider_metadata)
         VALUES ($1, $2, $3::payment_provider, $4::payment_type, $5, 'BRL',
                 'succeeded', now(),
                 $6::jsonb)
         RETURNING id, reservation_id, provider, payment_type, amount, currency, status, paid_at`,
        [
          reservationId,
          reservation.guest_id,
          method,                 // 'infinitypay' | 'cash'
          paymentType,            // 'deposit' | 'remaining'
          amountNum,
          JSON.stringify({
            recorded_manually: true,
            method,
            notes: notes ?? null,
          }),
        ]
      );

      const payment = paymentRows[0];

      // ─── Si es un depósito, confirmar la reserva ────────────────────────────

      if (paymentType === 'deposit' && reservation.status === 'pending_payment') {
        await query(
          `UPDATE reservations SET status = 'confirmed', updated_at = now() WHERE id = $1`,
          [reservationId]
        );
        logger.info('Reserva confirmada tras depósito en recepción', {
          reservationId,
          method,
          amount: amountNum,
        });
      }

      // ─── Audit log ──────────────────────────────────────────────────────────

      await auditLogService.log({
        entity_type: 'payment',
        entity_id: payment.id,
        operation: 'ADMIN_REGISTER_PHYSICAL_PAYMENT',
        reservation_id: reservationId,
        guest_id: reservation.guest_id,
        new_data: {
          method,
          paymentType,
          amount: amountNum,
          notes,
          reservationNumber: reservation.reservation_number,
        },
      });

      logger.info('Pago físico registrado manualmente', {
        paymentId: payment.id,
        reservationId,
        reservationNumber: reservation.reservation_number,
        method,
        paymentType,
        amount: amountNum,
      });

      res.status(201).json(ApiResponse.success(
        {
          paymentId: payment.id,
          reservationId,
          reservationNumber: reservation.reservation_number,
          method,
          paymentType,
          amount: amountNum,
          currency: 'BRL',
          status: 'succeeded',
          paidAt: payment.paid_at,
        },
        `Pago de ${amountNum} BRL registrado exitosamente (${method === 'infinitypay' ? 'InfinityPay' : 'Efectivo'})`
      ));
    } catch (error) {
      next(error);
    }
  }
);

export default router;

// lapa-casa-hostel/backend/src/routes/payments/release-deposit.ts
// POST /payments/release-deposit
//
// Endpoint de uso interno (solo admin) que libera los fondos al administrador
// de un apartamento después del check-in del huésped.
//
// Flujo de dinero en apartamentos:
//   - Al confirmar la reserva: el huésped paga el 30% de depósito online
//       5%  → comisión de Lapa Casa (retenida en la plataforma)
//       25% → garantía retenida hasta el check-in
//   - En el check-in: el huésped paga el 70% restante en la máquina física (InfinityPay)
//   - Después del check-in: el admin recibe
//       70% del precio total (remaining_amount)     ← cobrado en InfinityPay
//       25% de la garantía retenida del depósito    ← Transfer de Stripe
//
// Este endpoint maneja la transferencia Stripe del 25% retenido.
// (El 70% que entra por InfinityPay lo registra /admin/payments/mark-received-at-desk)
//
// Seguridad: requiere authenticateToken + requireRole(['admin']) —
//            aplicados en index.ts para todo /payments; este endpoint
//            tiene además una verificación explícita de rol admin.

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { stripeConnectHandler } from '../../lib/payments/stripe-connect';
import { auditLogService } from '../../services/audit-log-service';
import { ApiResponse } from '../../utils/responses';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validation';

const router = Router();

const ReleaseDepositSchema = z.object({
  reservationId: z.string().trim().min(1),
});

/**
 * POST /payments/release-deposit
 *
 * Body:
 *   reservationId  — UUID de la reserva
 *   ownerId        — UUID del apartment_owner (opcional si el apartamento ya lo tiene asignado)
 *
 * Qué hace:
 *   1. Verifica que la reserva sea de un apartamento con propietario asignado
 *   2. Verifica que el propietario tenga Stripe Connect activo
 *   3. Calcula el 25% retenido (depositAmount * 25/30 — porque el depósito ya incluye el 30%)
 *   4. Aplica la comisión de Lapa Casa y la tasa de payout
 *   5. Crea el Transfer de Stripe hacia el acct_xxx del admin
 *   6. Registra en owner_transfers
 */
router.post(
  '/',
  authenticateToken,
  requireRole(['admin']),
  validate(ReleaseDepositSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reservationId } = req.body as z.infer<typeof ReleaseDepositSchema>;

      // 1. Obtener la reserva con los datos del apartamento y del propietario
      const { rows: reservationRows } = await query(
        `SELECT
           r.id,
           r.reservation_number,
           r.status,
           r.deposit_amount,
           r.remaining_amount,
           r.final_price,
           r.check_in_date,
           -- room_type del apartamento (para este sistema una reserva de apt tiene 1 room_type)
           rt.id            AS room_type_id,
           rt.code          AS room_code,
           rt.property_type,
           rt.owner_id,
           -- datos del propietario
           ao.id            AS owner_id_actual,
           ao.full_name     AS owner_name,
           ao.stripe_account_id,
           ao.onboarding_status,
           ao.commission_rate,
           ao.payout_fee_rate
         FROM reservations r
         JOIN reservation_beds rb ON rb.reservation_id = r.id
         JOIN beds b ON b.id = rb.bed_id
         JOIN room_types rt ON rt.id = b.room_type_id
         LEFT JOIN apartment_owners ao ON ao.id = rt.owner_id
         WHERE r.id = $1
           AND rt.property_type = 'apartment'
         LIMIT 1`,
        [reservationId]
      );

      if (reservationRows.length === 0) {
        throw new AppError('Reserva no encontrada o no es de tipo apartamento', 404);
      }

      const r = reservationRows[0];

      // 2. Validaciones de estado
      // no_show: el huésped no se presentó -- el admin retiene el 30% de arras
      // como compensación (Cláusula 5.4 del Termo de Adesão). El depósito se
      // libera igualmente para que el admin reciba el 25% retenido tras
      // descontar la comisión.
      if (
        r.status !== 'confirmed' &&
        r.status !== 'checked-in' &&
        r.status !== 'checked-out' &&
        r.status !== 'no_show'
      ) {
        throw new AppError(
          `No se puede liberar el depósito: la reserva está en estado "${r.status}". ` +
          'Debe estar confirmada, en check-in, check-out o no-show.',
          400
        );
      }

      if (!r.owner_id_actual) {
        throw new AppError(
          'Este apartamento no tiene administrador asignado. ' +
          'Asignalo desde /admin/apartment-owners/:id/assign-room/:roomId',
          400
        );
      }

      if (!r.stripe_account_id) {
        throw new AppError(
          'El administrador no tiene cuenta Stripe registrada. ' +
          'Primero debe completar el onboarding desde /admin/apartment-owners/:id/onboarding-link',
          400
        );
      }

      if (r.onboarding_status !== 'active') {
        throw new AppError(
          `El administrador no puede recibir transferencias aún. ` +
          `Estado de onboarding: "${r.onboarding_status}". ` +
          'Debe completar el registro bancario en Stripe.',
          400
        );
      }

      // 3. Verificar que no se haya liberado ya el depósito para esta reserva
      const { rows: existingTransfer } = await query(
        `SELECT id FROM owner_transfers
         WHERE reservation_id = $1 AND transfer_kind = 'held_25' AND status = 'succeeded'`,
        [reservationId]
      );

      if (existingTransfer.length > 0) {
        throw new AppError('El depósito retenido ya fue liberado para esta reserva', 400);
      }

      // 4. Calcular el monto a transferir
      //    El depósito es el 30% del precio total.
      //    De ese 30%: 5% = comisión de Lapa Casa, 25% = garantía retenida.
      //    Proporción de la garantía sobre el depósito total: 25/30 = 0.8333...
      //    Entonces: heldAmount = depositAmount * (25/30)
      const depositAmount = parseFloat(r.deposit_amount);
      const heldAmount = parseFloat((depositAmount * (25 / 30)).toFixed(2));

      // Aplicar comisión y payout fee sobre el monto total de la reserva
      // (la comisión ya se cobró en el momento del depósito — aquí solo
      //  descontamos la tasa de payout)
      const payoutFeeRate = parseFloat(r.payout_fee_rate);

      const { payoutFeeAmount, adminNetAmount } = stripeConnectHandler.calculateAdminAmount({
        finalPrice: heldAmount,
        commissionRate: 0, // la comisión ya fue descontada del 5% al recibir el depósito
        payoutFeeRate,
      });

      logger.info('Calculando liberación de depósito retenido', {
        reservationId,
        depositAmount,
        heldAmount,
        payoutFeeAmount,
        adminNetAmount,
        ownerId: r.owner_id_actual,
      });

      // 5. Crear registro pending en owner_transfers
      const { rows: transferRows } = await query(
        `INSERT INTO owner_transfers
           (reservation_id, owner_id, amount, currency, transfer_kind, status)
         VALUES ($1, $2, $3, 'BRL', 'held_25', 'pending')
         RETURNING id`,
        [reservationId, r.owner_id_actual, adminNetAmount]
      );
      const transferRecordId = transferRows[0].id;

      // 6. Crear el Transfer en Stripe
      let stripeTransferId: string;
      try {
        const transferResult = await stripeConnectHandler.createTransfer({
          amount: adminNetAmount,
          destinationAccountId: r.stripe_account_id,
          reservationId,
          description: `Garantía retenida — Reserva ${r.reservation_number}`,
          metadata: {
            transfer_kind: 'held_25',
            transfer_record_id: transferRecordId,
          },
        });
        stripeTransferId = transferResult.transferId;
      } catch (stripeError: any) {
        // Marcar el transfer como fallido en la DB
        await query(
          `UPDATE owner_transfers
           SET status = 'failed', error_message = $1, updated_at = now()
           WHERE id = $2`,
          [stripeError.message, transferRecordId]
        );
        throw new AppError(`Error al crear el Transfer en Stripe: ${stripeError.message}`, 502);
      }

      // 7. Marcar como succeeded en DB
      await query(
        `UPDATE owner_transfers
         SET status = 'succeeded',
             stripe_transfer_id = $1,
             transferred_at = now(),
             updated_at = now()
         WHERE id = $2`,
        [stripeTransferId, transferRecordId]
      );

      await auditLogService.log({
        entity_type: 'owner_transfer',
        entity_id: transferRecordId,
        operation: 'RELEASE_HELD_DEPOSIT',
        reservation_id: reservationId,
        new_data: {
          ownerId: r.owner_id_actual,
          ownerName: r.owner_name,
          heldAmount,
          adminNetAmount,
          payoutFeeAmount,
          stripeTransferId,
        },
      });

      logger.info('Depósito retenido liberado exitosamente', {
        reservationId,
        transferRecordId,
        stripeTransferId,
        adminNetAmount,
      });

      res.status(200).json(ApiResponse.success({
        transferId: transferRecordId,
        stripeTransferId,
        reservationId,
        ownerId: r.owner_id_actual,
        ownerName: r.owner_name,
        amounts: {
          heldDeposit: heldAmount,
          payoutFee: payoutFeeAmount,
          adminReceives: adminNetAmount,
        },
      }, `Garantía de ${adminNetAmount} BRL transferida exitosamente a ${r.owner_name}`));
    } catch (error) {
      next(error);
    }
  }
);

export default router;

// POST /payments/release-deposit
//
// Disparo MANUAL (solo admin) del pago de la garantía retenida a un administrador.
// El pago normal es automático: queues/owner-payout.queue.ts corre cada hora y paga
// después del check-out + período de espera (system_config.owner_payout_hold_hours,
// default 48h). Este endpoint sirve para adelantar o reintentar un pago puntual.
//
// Flujo de dinero en apartamentos (todo se cobra en la cuenta Stripe de la plataforma):
//   - Depósito online 30%: 5% comisión Lapa Casa + 25% garantía retenida hasta el check-out.
//   - Check-in: el huésped paga el 70% en InfinityPay (/admin/payments/mark-received-at-desk).
//   - Post check-out: 25% garantía − tasa de payout (0,99%) → Transfer Stripe al admin.
//
// Seguridad: requiere authenticateToken + requireRole(['admin']) —
//            aplicados en index.ts para todo /payments; este endpoint
//            tiene además una verificación explícita de rol admin.

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { releaseHeldDeposit } from '../../services/owner-payout-service';
import { ApiResponse } from '../../utils/responses';
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
      // Disparo manual: omite el período de espera (el job automático lo respeta).
      const r = await releaseHeldDeposit(reservationId, { enforceHold: false });
      res.status(200).json(ApiResponse.success({
        transferId: r.transferId,
        stripeTransferId: r.stripeTransferId,
        reservationId: r.reservationId,
        ownerId: r.ownerId,
        ownerName: r.ownerName,
        amounts: { heldDeposit: r.heldAmount, payoutFee: r.payoutFeeAmount, adminReceives: r.adminNetAmount },
      }, `Garantía de ${r.adminNetAmount} BRL transferida exitosamente a ${r.ownerName}`));
    } catch (error) {
      next(error);
    }
  }
);

export default router;

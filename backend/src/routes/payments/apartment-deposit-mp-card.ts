// backend/src/routes/payments/apartment-deposit-mp-card.ts
// Pago con tarjeta brasileña via Mercado Pago para apartamentos.
// Totalmente separado del flujo del hostel.

import type { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../services/payment-service';
import { bookingService } from '../../services/booking-service';
import { mercadoPagoHandler } from '../../lib/payments/mercado-pago-handler';
import { query, withTransaction } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

interface ApartmentDepositMpCardRequest {
  reservationId: string;
  token: string;
  paymentMethodId: string;
  issuerId: string;
  installments?: number;
  cpf: string;
}

async function getCardSurchargePercent(): Promise<number> {
  const { rows } = await query<{ value: number }>(
    `SELECT value FROM system_config WHERE key = 'card_surcharge_percent'`
  );
  return rows[0]?.value ?? 0;
}

export const apartmentDepositMpCardHandler = async (
  req: Request<{}, {}, ApartmentDepositMpCardRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reservationId, token, paymentMethodId, issuerId, installments = 1, cpf } = req.body;

    if (!reservationId || !token || !paymentMethodId || !cpf) {
      res.status(400).json(ApiResponse.error('Campos obrigatórios: reservationId, token, paymentMethodId, cpf'));
      return;
    }

    const cpfClean = cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) {
      res.status(400).json(ApiResponse.error('CPF inválido — informe 11 dígitos'));
      return;
    }

    const booking = await bookingService.getBooking(reservationId);
    if (!booking) {
      res.status(404).json(ApiResponse.error('Reserva não encontrada', { reservationId }));
      return;
    }
    if (booking.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('Reserva cancelada'));
      return;
    }

    const depositPaid = await withTransaction(async (client) => {
      await client.query('SELECT id FROM reservations WHERE id = $1 FOR UPDATE', [reservationId]);
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM payments
         WHERE reservation_id = $1 AND payment_type = 'deposit'
           AND status IN ('succeeded', 'pending', 'in_process')
         LIMIT 1`,
        [reservationId],
      );
      return rows[0] ?? null;
    });
    if (depositPaid) {
      res.status(409).json(ApiResponse.error('O depósito já foi pago', { paymentId: depositPaid.id }));
      return;
    }

    const depositAmount    = Number(booking.deposit_amount);
    const surchargePercent = await getCardSurchargePercent();
    const chargedAmount    = Math.round(depositAmount * (1 + surchargePercent / 100) * 100) / 100;

    const guestEmail = booking.guest?.email ?? '';
    const description = `Depósito Apt ${booking.reservation_number} — Lapa Casa Rio`;

    const appUrl = process.env.APP_URL ?? 'https://api.lapacasario.com';
    const notificationUrl = `${appUrl}/api/v1/payments/apartments/webhook/mercadopago`;

    logger.info('Iniciando pago tarjeta BR via MP (apartamento)', {
      reservationId, paymentMethodId, installments, chargedAmount,
    });

    const mpResult = await mercadoPagoHandler.createCardPayment({
      token,
      paymentMethodId,
      issuerId,
      installments,
      amount: chargedAmount,
      payerEmail: guestEmail,
      payerCpf: cpfClean,
      description,
      reservationId,
      paymentType: 'deposit',
      notificationUrl,
    });

    logger.info('Respuesta MP cartão (apartamento)', {
      id: mpResult.id, status: mpResult.status, detail: mpResult.statusDetail,
    });

    if (mpResult.status === 'rejected') {
      const userMsg = friendlyMpRejection(mpResult.statusDetail);
      res.status(402).json(ApiResponse.error(userMsg, { statusDetail: mpResult.statusDetail }));
      return;
    }

    const payment = await paymentService.registerExternalPayment({
      reservationId,
      guestId: booking.guest_id,
      amount: chargedAmount,
      baseAmount: depositAmount,
      currency: 'BRL',
      paymentType: 'deposit',
      provider: 'mercadopago',
      providerPaymentId: mpResult.id,
      installments,
    });

    if (mpResult.status === 'approved') {
      await paymentService.confirmPaymentById(payment.payment_id);
    }

    const depositPercentage = Number(booking.deposit_percent ?? 0.30);

    res.status(200).json(
      ApiResponse.success({
        payment: {
          paymentId:            payment.payment_id,
          mpPaymentId:          mpResult.id,
          type:                 'deposit',
          amount:               chargedAmount,
          baseAmount:           depositAmount,
          cardSurchargePercent: surchargePercent,
          currency:             'BRL',
          status:               mpResult.status,
          statusDetail:         mpResult.statusDetail,
          provider:             'mercadopago',
          paymentMethod:        'card',
          installments,
        },
        depositInfo: {
          percentage: depositPercentage * 100,
          amount: depositAmount,
        },
      }, mpResult.status === 'approved' ? 'Pagamento aprovado!' : 'Pagamento em análise')
    );
  } catch (error) {
    logger.error('Error en apartment-deposit-mp-card', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
};

function friendlyMpRejection(detail: string): string {
  const map: Record<string, string> = {
    cc_rejected_bad_filled_card_number:    'Número de cartão inválido. Verifique e tente novamente.',
    cc_rejected_bad_filled_date:           'Data de validade incorreta.',
    cc_rejected_bad_filled_other:          'Dados do cartão inválidos. Verifique e tente novamente.',
    cc_rejected_bad_filled_security_code:  'CVV incorreto.',
    cc_rejected_blacklist:                 'Cartão não autorizado pelo banco emissor.',
    cc_rejected_call_for_authorize:        'Cartão requer autorização manual. Ligue para o seu banco.',
    cc_rejected_card_disabled:             'Cartão bloqueado. Entre em contato com seu banco.',
    cc_rejected_card_error:                'Erro no cartão. Tente outro cartão.',
    cc_rejected_duplicated_payment:        'Pagamento duplicado. Já existe um pagamento idêntico recente.',
    cc_rejected_high_risk:                 'Pagamento recusado por segurança. Tente outro cartão ou use PIX.',
    cc_rejected_insufficient_amount:       'Saldo insuficiente no cartão.',
    cc_rejected_invalid_installments:      'Número de parcelas não aceito para este cartão.',
    cc_rejected_max_attempts:              'Limite de tentativas atingido. Aguarde alguns minutos.',
  };
  return map[detail] ?? 'Pagamento recusado pelo banco. Tente outro cartão ou use PIX.';
}

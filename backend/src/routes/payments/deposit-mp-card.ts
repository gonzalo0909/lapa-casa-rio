// lapa-casa-hostel/backend/src/routes/payments/deposit-mp-card.ts
//
// Ruta exclusiva para pagos con tarjeta brasileña via Mercado Pago.
// El SDK de MP en el frontend tokeniza la tarjeta y envía el token acá.
// Nunca recibimos datos crudos de la tarjeta (PCI-compliant).

import type { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../services/payment-service';
import { bookingService } from '../../services/booking-service';
import { mercadoPagoHandler } from '../../lib/payments/mercado-pago-handler';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

interface DepositMpCardRequest {
  reservationId: string;
  /** Token generado por el SDK de MP en el frontend */
  token: string;
  /** ID del método de pago (visa, master, elo, hipercard…) */
  paymentMethodId: string;
  /** ID del banco emisor */
  issuerId: string;
  installments?: number;
  /** CPF del titular (obligatorio para MP Brasil) */
  cpf: string;
}

async function getCardSurchargePercent(): Promise<number> {
  const { rows } = await query<{ value: number }>(
    `SELECT value FROM system_config WHERE key = 'card_surcharge_percent'`
  );
  return rows[0]?.value ?? 0;
}

export const depositMpCardHandler = async (
  req: Request<{}, {}, DepositMpCardRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reservationId, token, paymentMethodId, issuerId, installments = 1, cpf } = req.body;

    if (!reservationId || !token || !paymentMethodId || !cpf) {
      res.status(400).json(ApiResponse.error('Campos obrigatórios: reservationId, token, paymentMethodId, cpf'));
      return;
    }

    // CPF básico — sin dígitos válidos es rechazado por MP de todas formas
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

    // Idempotencia: no cobrar si el depósito ya fue pagado
    const existingPayments = await paymentService.getPaymentsByReservation(reservationId);
    const depositPaid = existingPayments.find(p => p.payment_type === 'deposit' && p.status === 'succeeded');
    if (depositPaid) {
      res.status(409).json(ApiResponse.error('O depósito já foi pago', { paymentId: depositPaid.id }));
      return;
    }

    const depositAmount    = Number(booking.deposit_amount);
    const surchargePercent = await getCardSurchargePercent();
    const chargedAmount    = Math.round(depositAmount * (1 + surchargePercent / 100) * 100) / 100;

    const guestEmail = booking.guest?.email ?? '';
    const description = `Depósito Reserva ${booking.reservation_number} — Lapa Casa Rio`;

    logger.info('Iniciando pago tarjeta BR via MP', { reservationId, paymentMethodId, installments, chargedAmount });

    // 1. Crear y procesar el pago en MP
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
    });

    logger.info('Respuesta MP cartão', { id: mpResult.id, status: mpResult.status, detail: mpResult.statusDetail });

    if (mpResult.status === 'rejected') {
      const userMsg = friendlyMpRejection(mpResult.statusDetail);
      res.status(402).json(ApiResponse.error(userMsg, { statusDetail: mpResult.statusDetail }));
      return;
    }

    // 2. Registrar el pago en nuestra base de datos.
    // IMPORTANTE: no llamar a paymentService.createPaymentIntent() aquí porque
    // ese método vuelve a llamar a la API de MP, lo que fallaría sin token de
    // tarjeta y dejaría la tarjeta cobrada pero sin confirmación en la DB.
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

    // 3. Confirmar si MP ya lo aprobó.
    // Se usa solo el ID interno (garantizado tras registerExternalPayment) para
    // evitar la doble llamada anterior que silenciaba errores parciales: si
    // confirmPayment(mpId) actualizaba la DB pero fallaba antes de disparar
    // notificaciones, confirmPaymentById encontraba el pago en 'succeeded'
    // y también fallaba silenciosamente → el huésped nunca recibía el email.
    if (mpResult.status === 'approved') {
      await paymentService.confirmPaymentById(payment.payment_id);
    }

    const bedsCount = booking.beds_count ?? 0;
    const depositPercentage = bedsCount >= 15 ? 0.50 : 0.30;

    res.status(200).json(
      ApiResponse.success({
        payment: {
          paymentId:          payment.payment_id,
          mpPaymentId:        mpResult.id,
          type:               'deposit',
          amount:             chargedAmount,
          baseAmount:         depositAmount,
          cardSurchargePercent: surchargePercent,
          currency:           'BRL',
          status:             mpResult.status,   // 'approved' | 'pending' | 'in_process'
          statusDetail:       mpResult.statusDetail,
          provider:           'mercadopago',
          paymentMethod:      'card',
          installments,
        },
        depositInfo: {
          percentage: depositPercentage * 100,
          amount: depositAmount,
          bedsCount,
        },
      }, mpResult.status === 'approved' ? 'Pagamento aprovado!' : 'Pagamento em análise')
    );
  } catch (error) {
    logger.error('Error en deposit-mp-card', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
};

/** Traduce statusDetail de MP a mensajes amigables para el huésped */
function friendlyMpRejection(detail: string): string {
  const map: Record<string, string> = {
    cc_rejected_bad_filled_card_number:    'Número de cartão inválido. Verifique e tente novamente.',
    cc_rejected_bad_filled_date:           'Data de validade incorreta.',
    cc_rejected_bad_filled_other:          'Dados do cartão inválidos. Verifique e tente novamente.',
    cc_rejected_bad_filled_security_code:  'CVV incorreto.',
    cc_rejected_blacklist:                 'Cartão não autorizado pelo banco emissor.',
    cc_rejected_call_for_authorize:        'Cartão requer autorização manual. Ligue para o seu banco.',
    cc_rejected_card_disabled:             'Cartão bloqueado. Entre em contato com seu banco.',
    cc_rejected_card_error:               'Erro no cartão. Tente outro cartão.',
    cc_rejected_duplicated_payment:        'Pagamento duplicado. Já existe um pagamento idêntico recente.',
    cc_rejected_high_risk:                 'Pagamento recusado por segurança. Tente outro cartão ou use PIX.',
    cc_rejected_insufficient_amount:       'Saldo insuficiente no cartão.',
    cc_rejected_invalid_installments:     'Número de parcelas não aceito para este cartão.',
    cc_rejected_max_attempts:              'Limite de tentativas atingido. Aguarde alguns minutos.',
  };
  return map[detail] ?? 'Pagamento recusado pelo banco. Tente outro cartão ou use PIX.';
}

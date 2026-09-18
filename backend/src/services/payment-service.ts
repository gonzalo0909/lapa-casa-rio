// agrega handlePaymentSucceeded() -- dispara email de pago recibido y agenda saldo/bienvenida, desde el mismo punto que usan tanto el webhook real de Stripe/MercadoPago como la confirmación manual (ver más abajo)
// handlePaymentSucceeded también re-exporta la reserva a Sheets (deposit_paid/remaining_paid cambian con cada pago)

import type Stripe from 'stripe';
import { PaymentRepository } from '../database/repositories/payment-repository';
import { BookingRepository } from '../database/repositories/booking-repository';
import { StripeHandler } from '../lib/payments/stripe-handler';
import { MercadoPagoHandler } from '../lib/payments/mercado-pago-handler';
import { notificationService } from './notification-service';
import { scheduleRemainingPayment, scheduleApartmentRemainingPayment } from '../queues/remaining-payment.queue';
import { enqueueSheetsExport } from '../queues/sheets-export.queue';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error-handler';
import type { Payment, PaymentProvider, Reservation } from '../types/database';
import type { BookingWithGuest } from './email-service';

interface CreatePaymentIntentDTO {
  reservation_id: string;
  guest_id?: string;
  amount: number;
  /** Monto antes del recargo por tarjeta (si lo hay) -- lo que realmente cubre de la reserva, sin la comisión de Stripe. Se guarda en provider_metadata para que confirm-payment.ts pueda calcular el saldo restante real, no el monto bruto cobrado. */
  baseAmount?: number;
  currency?: string;
  guest_email: string;
  payment_type: 'deposit' | 'remaining';
  provider?: PaymentProvider;
  payment_method?: 'card' | 'pix';
  installments?: number;
  notificationUrl?: string;
}

interface PaymentIntentResponse {
  payment_id: string;
  client_secret?: string;
  provider_payment_id?: string;
  amount: number;
  currency: string;
  url?: string;
  qr_code?: string;
  qr_code_base64?: string;
  expires_at?: Date;
}

interface RefundDTO {
  reservation_id: string;
  amount: number;
  reason: string;
}

export class PaymentService {
  private paymentRepo: PaymentRepository;
  private bookingRepo: BookingRepository;
  private stripeHandler: StripeHandler;
  private mpHandler: InstanceType<typeof MercadoPagoHandler>;

  constructor() {
    this.paymentRepo = new PaymentRepository();
    this.bookingRepo = new BookingRepository();
    this.stripeHandler = new StripeHandler();
    this.mpHandler = new MercadoPagoHandler();
  }

  async createPaymentIntent(data: CreatePaymentIntentDTO): Promise<PaymentIntentResponse> {
    const reservation = await this.bookingRepo.findById(data.reservation_id);
    if (!reservation) {throw new AppError('Reserva no encontrada', 404);}

    const currency = data.currency || 'BRL';
    // L-04: el proveedor viene siempre en el payload (provider: 'stripe' | 'mercadopago').
    // Se eliminó la heurística por dominio de email — asignaba Stripe a
    // brasileños con Gmail/Outlook, causando fricción innecesaria y
    // comisiones más altas. Si no viene provider, default a mercadopago (Brasil).
    const provider: PaymentProvider = data.provider ?? 'mercadopago';
    const preferredMethod = data.payment_method || (provider === 'mercadopago' ? 'pix' : 'card');

    let providerPaymentId: string;
    let pixDetails: { qr_code?: string; qr_code_base64?: string; expires_at?: Date } = {};
    let stripeClientSecret: string | undefined;
    let url: string | undefined;

    if (provider === 'mercadopago') {
      const result = await this.mpHandler.createPaymentIntent({
        amount: data.amount,
        currency,
        description: `${data.payment_type === 'deposit' ? 'Depósito' : 'Saldo'} - Reserva ${reservation.reservation_number}`,
        payerEmail: data.guest_email,
        paymentMethod: preferredMethod,
        installments: data.installments,
        metadata: { reservation_id: data.reservation_id, payment_type: data.payment_type },
        notificationUrl: data.notificationUrl,
      });
      providerPaymentId = result.paymentIntentId;
      pixDetails = { qr_code: result.qrCode, qr_code_base64: result.qrCodeBase64, expires_at: result.expiresAt };
      url = result.url;
    } else {
      // Para apartamentos con administrador Stripe Connect, agregar transfer_data
      // para que Stripe pueda enrutar los fondos correctamente.
      let connectedAccountId: string | undefined;
      let applicationFeeAmountCents: number | undefined;

      try {
        const { rows: aptRows } = await query(
          `SELECT ao.stripe_account_id, ao.commission_rate, ao.onboarding_status
           FROM reservations r
           JOIN reservation_beds rb ON rb.reservation_id = r.id
           JOIN beds b ON b.id = rb.bed_id
           JOIN room_types rt ON rt.id = b.room_type_id
           JOIN apartment_owners ao ON ao.id = rt.owner_id
           WHERE r.id = $1
             AND rt.property_type = 'apartment'
             AND ao.onboarding_status = 'active'
             AND ao.stripe_account_id IS NOT NULL
           LIMIT 1`,
          [data.reservation_id]
        );

        if (aptRows.length > 0) {
          const apt = aptRows[0];
          connectedAccountId = apt.stripe_account_id;
          const commissionRate = parseFloat(apt.commission_rate);
          // application_fee = comisión de Lapa Casa sobre el monto del pago
          const feeAmount = data.amount * commissionRate;
          applicationFeeAmountCents = Math.round(feeAmount * 100);

          logger.info('Pago Stripe Connect para apartamento', {
            reservationId: data.reservation_id,
            connectedAccountId,
            commissionRate,
            applicationFeeAmountCents,
          });
        }
      } catch (aptLookupError: any) {
        // Si falla la consulta del apartamento, continuar sin Connect
        // (el pago queda en la plataforma y el Transfer se hace manual)
        logger.warn('No se pudo obtener cuenta Stripe del administrador, continuando sin Connect', {
          reservationId: data.reservation_id,
          error: aptLookupError.message,
        });
      }

      const result = await this.stripeHandler.createPaymentIntent({
        amount: data.amount,
        currency,
        customerEmail: data.guest_email,
        description: `${data.payment_type === 'deposit' ? 'Deposit' : 'Remaining'} - Booking ${reservation.reservation_number}`,
        metadata: { reservation_id: data.reservation_id, payment_type: data.payment_type },
        connectedAccountId,
        applicationFeeAmountCents,
      });
      providerPaymentId = result.paymentIntentId;
      stripeClientSecret = result.clientSecret;
    }

    const payment = await this.paymentRepo.create({
      reservation_id: data.reservation_id,
      guest_id: data.guest_id ?? null,
      provider,
      payment_type: data.payment_type,
      amount: data.amount,
      currency,
      provider_payment_id: providerPaymentId,
      metadata: { installments: data.installments, client_secret: stripeClientSecret, base_amount: data.baseAmount },
    });

    return {
      payment_id: payment.id,
      provider_payment_id: providerPaymentId,
      client_secret: stripeClientSecret,
      amount: payment.amount,
      currency: payment.currency,
      url,
      qr_code: pixDetails.qr_code,
      qr_code_base64: pixDetails.qr_code_base64,
      expires_at: pixDetails.expires_at,
    };
  }

  // Confirma un pago por provider_payment_id (usado por webhooks)
  async confirmPayment(providerPaymentId: string): Promise<Payment> {
    const payment = await this.paymentRepo.findByProviderPaymentId(providerPaymentId);
    if (!payment) {throw new AppError('Pago no encontrado', 404);}
    if (payment.status === 'succeeded') {throw new AppError('El pago ya fue confirmado', 400);}

    let verified = false;
    if (payment.provider === 'stripe') {
      verified = await this.stripeHandler.verifyPayment(providerPaymentId);
    } else if (payment.provider === 'mercadopago') {
      verified = await this.mpHandler.verifyPayment(providerPaymentId);
    }
    if (!verified) {throw new AppError('No se pudo verificar el pago', 400);}

    const confirmedPayment = await this.paymentRepo.markCompleted(payment.id);
    if (payment.payment_type === 'deposit') {
      await this.bookingRepo.updateStatus(payment.reservation_id, 'confirmed');
    }
    await this.handlePaymentSucceeded(confirmedPayment);
    return confirmedPayment;
  }

  // Confirma un pago por payment.id interno (usado por la ruta confirm-payment)
  async confirmPaymentById(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {throw new AppError('Pago no encontrado', 404);}
    if (payment.status === 'succeeded') {throw new AppError('El pago ya fue confirmado', 400);}

    let verified = false;
    if (payment.provider === 'stripe' && payment.provider_payment_id) {
      verified = await this.stripeHandler.verifyPayment(payment.provider_payment_id);
    } else if (payment.provider === 'mercadopago' && payment.provider_payment_id) {
      verified = await this.mpHandler.verifyPayment(payment.provider_payment_id);
    }
    if (!verified) {throw new AppError('No se pudo verificar el pago con el proveedor', 400);}

    const confirmed = await this.paymentRepo.markCompleted(paymentId);
    if (payment.payment_type === 'deposit') {
      await this.bookingRepo.updateStatus(payment.reservation_id, 'confirmed');
    }
    await this.handlePaymentSucceeded(confirmed);
    return confirmed;
  }

  // unico punto que dispara notificaciones de pago recibido --
  // corre tanto para el webhook real de Stripe/MercadoPago (confirmPayment)
  // como para la confirmacion manual desde el frontend (confirmPaymentById).
  // Antes solo la ruta confirm-payment.ts enviaba el email, asi que un pago
  // confirmado por webhook (el camino real de produccion) nunca disparaba
  // nada. Un fallo de email no debe tumbar la confirmacion del pago -- ya
  // sucedio y esta persistido -- por eso el try/catch no relanza.
  private async handlePaymentSucceeded(payment: Payment): Promise<void> {
    try {
      const booking = await this.bookingRepo.findById(payment.reservation_id);
      if (!booking || !booking.guest) {
        logger.warn('handlePaymentSucceeded: reserva o guest no encontrado, se omiten notificaciones', {
          reservationId: payment.reservation_id
        });
        return;
      }
      const bookingWithGuest = booking as BookingWithGuest;

      await notificationService.notify('payment_received', bookingWithGuest, { amount: Number(payment.amount) });
      enqueueSheetsExport(bookingWithGuest.id).catch(err =>
        logger.warn('No se pudo encolar el export a Sheets tras pago confirmado', { reservationId: bookingWithGuest.id, error: err.message })
      );

      if (payment.payment_type === 'deposit' && Number(bookingWithGuest.remaining_amount) > 0) {
        // Apartamentos: el 70% se cobra la mañana del check-in (Cláusula 3.2).
        // Hostel: se cobra 7 días antes (modelo clásico).
        const { rows: aptRows } = await query<{ count: string }>(
          `SELECT COUNT(*) AS count
           FROM reservation_beds rb
           JOIN beds b ON b.id = rb.bed_id
           JOIN room_types rt ON rt.id = b.room_type_id
           WHERE rb.reservation_id = $1 AND rt.property_type = 'apartment'`,
          [bookingWithGuest.id]
        );
        const isApartment = parseInt(aptRows[0]?.count ?? '0') > 0;

        if (isApartment) {
          await scheduleApartmentRemainingPayment(bookingWithGuest.id, new Date(bookingWithGuest.check_in_date));
        } else {
          await scheduleRemainingPayment(bookingWithGuest.id, new Date(bookingWithGuest.check_in_date));
        }

        const oneDayBeforeCheckIn = new Date(new Date(bookingWithGuest.check_in_date).getTime() - 24 * 60 * 60 * 1000);
        await notificationService.scheduleNotification('welcome', bookingWithGuest, oneDayBeforeCheckIn);
      }
    } catch (error: any) {
      logger.error('Error en efectos secundarios de pago confirmado (notificaciones)', {
        paymentId: payment.id,
        reservationId: payment.reservation_id,
        error: error.message
      });
    }
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    return this.paymentRepo.findById(id);
  }

  async processRefund(data: RefundDTO): Promise<Payment> {
    const payments = await this.paymentRepo.findByReservation(data.reservation_id);
    const successfulPayment = payments.find(p => p.status === 'succeeded');
    if (!successfulPayment) {throw new AppError('No hay pago completado para reembolsar', 400);}

    if (successfulPayment.provider === 'stripe' && successfulPayment.provider_payment_id) {
      await this.stripeHandler.createRefund({
        paymentIntentId: successfulPayment.provider_payment_id,
        amount: data.amount,
        reason: data.reason,
      });
    } else if (successfulPayment.provider === 'mercadopago' && successfulPayment.provider_payment_id) {
      await this.mpHandler.createRefund({
        paymentId: successfulPayment.provider_payment_id,
        amount: data.amount,
      });
    }
    return this.paymentRepo.processRefund(successfulPayment.id, data.amount);
  }

  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        // Pago grupal: el checkout de Stripe lleva member_id y group_session_id en metadata
        const cs = event.data.object as Stripe.Checkout.Session;
        const memberId = cs.metadata?.member_id;
        const groupSessionId = cs.metadata?.group_session_id;
        if (memberId && groupSessionId) {
          const providerPaymentId = (cs.payment_intent as string) ?? cs.id;
          const { groupPaymentService } = await import('./group-payment-service');
          await groupPaymentService.confirmMemberPayment({ memberId, providerPaymentId }).catch(err => {
            logger.warn('confirmMemberPayment Stripe ignorado', { memberId, err: err.message });
          });
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        // Pago grupal puede llegar también via payment_intent si el Checkout ya lo confirmó;
        // el check idempotente interno de confirmMemberPayment lo maneja.
        await this.confirmPayment(pi.id).catch(err => {
          logger.warn('confirmPayment en webhook ignorado', { id: pi.id, err: err.message });
        });
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const payment = await this.paymentRepo.findByProviderPaymentId(pi.id);
        if (payment) {
          await this.paymentRepo.markFailed(payment.id, pi.last_payment_error?.message);
        }
        break;
      }
    }
  }

  async handleMercadoPagoWebhook(data: any): Promise<void> {
    if (data.type === 'payment' && data.data?.id) {
      const mpPayment = await this.mpHandler.getPayment(data.data.id.toString());
      if (mpPayment.status === 'approved') {
        // Pago grupal: la metadata incluye member_id (group-payment-service.ts)
        const memberId = mpPayment.metadata?.member_id as string | undefined;
        if (memberId) {
          const { groupPaymentService } = await import('./group-payment-service');
          await groupPaymentService.confirmMemberPayment({
            memberId,
            providerPaymentId: mpPayment.id,
          }).catch(err => {
            logger.warn('confirmMemberPayment MP ignorado', { memberId, err: err.message });
          });
        } else {
          await this.confirmPayment(mpPayment.id).catch(err => {
            logger.warn('confirmPayment MP webhook ignorado', { id: mpPayment.id, err: err.message });
          });
        }
      }
    }
  }

  async getPaymentsByReservation(reservationId: string): Promise<Payment[]> {
    return this.paymentRepo.findByReservation(reservationId);
  }

  // usado por el flujo de cobro de saldo (3 reintentos cada 24h,
  // ver Prompt Maestro / POLITICAS OPERATIVAS) una vez que el proveedor
  // confirma el cargo del saldo. A diferencia del deposito, pagar el saldo
  // no cambia el status de la reserva -- ya esta 'confirmed' desde que se
  // pago el deposito -- solo marca el registro de pago como succeeded.
  async markRemainingPaid(reservationId: string): Promise<Payment> {
    const payments = await this.paymentRepo.findByReservation(reservationId);
    const remainingPayment = payments.find(p => p.payment_type === 'remaining');
    if (!remainingPayment) {
      throw new AppError('No existe un pago de saldo (remaining) para esta reserva', 404);
    }
    if (remainingPayment.status === 'succeeded') {
      throw new AppError('El saldo ya fue pagado', 400);
    }
    return this.paymentRepo.markCompleted(remainingPayment.id);
  }

  /**
   * Registra en la base de datos un pago que ya fue procesado por el proveedor.
   * Usar cuando el proveedor ya cobró (ej. MP tarjeta vía deposit-mp-card) y
   * solo se necesita persistir el registro sin volver a llamar a la API externa.
   */
  async registerExternalPayment(data: {
    reservationId: string;
    guestId?: string | null;
    amount: number;
    baseAmount?: number;
    currency: string;
    paymentType: 'deposit' | 'remaining';
    provider: PaymentProvider;
    providerPaymentId: string;
    installments?: number;
  }): Promise<{ payment_id: string }> {
    const payment = await this.paymentRepo.create({
      reservation_id: data.reservationId,
      guest_id: data.guestId ?? null,
      provider: data.provider,
      payment_type: data.paymentType,
      amount: data.amount,
      currency: data.currency,
      provider_payment_id: data.providerPaymentId,
      metadata: { installments: data.installments, base_amount: data.baseAmount },
    });
    return { payment_id: payment.id };
  }

  async getStatistics(): Promise<any> {
    return this.paymentRepo.getStatistics();
  }

  // L-04: isInternationalEmail eliminada — ver comentario en createPaymentIntent

  // Sección 7 auditoría 17 secciones: antes armada inline en la ruta
  // POST /payments/stripe-wa-link -- flujo WhatsApp, genera un link de pago
  // sin reserva previa (el titular no llegó a completar el wizard).
  async createWhatsappCheckoutLink(data: {
    amountBRL: number;
    description?: string;
    guestEmail?: string;
    frontendUrl?: string;
  }): Promise<{ url: string }> {
    const baseUrl = data.frontendUrl || process.env.FRONTEND_URL || 'https://lapacasario.com';
    const session = await this.stripeHandler.createCheckoutSession({
      amount: data.amountBRL,
      description: data.description || 'Depósito reserva — Lapa Casa Hostel',
      customerEmail: data.guestEmail || '',
      reservationId: `wa-${Date.now()}`,
      successUrl: `${baseUrl}/pt/hostel?paid=1`,
      cancelUrl: `${baseUrl}/pt/hostel`,
      metadata: { source: 'whatsapp' },
    });
    logger.info('Stripe WA link generado', { amount: data.amountBRL, sessionId: session.sessionId });
    return { url: session.url };
  }

  // Sección 7 auditoría 17 secciones: antes armada inline en la ruta
  // POST /payments/stripe-checkout -- Checkout Session de tarjeta para una
  // reserva ya creada (el 404/cancelada se valida en la ruta antes de
  // llamar acá, por eso recibe el booking ya resuelto).
  async createBookingCheckoutSession(
    booking: Reservation,
    frontendUrl?: string
  ): Promise<{ url: string; sessionId: string; amount: number; currency: string }> {
    const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'https://lapacasario.com';
    const depositAmount = Number(booking.deposit_amount);
    const displayCode = booking.reservation_number;
    const guestEmail = booking.guest?.email ?? '';

    const session = await this.stripeHandler.createCheckoutSession({
      amount: depositAmount,
      description: `Depósito reserva ${displayCode} — Lapa Casa Hostel`,
      customerEmail: guestEmail,
      reservationId: booking.id,
      successUrl: `${baseUrl}/pt/hostel?paid=1&booking=${booking.id}`,
      cancelUrl: `${baseUrl}/pt/hostel`,
    });

    logger.info('Stripe Checkout Session creada', { reservationId: booking.id, sessionId: session.sessionId });
    return { url: session.url, sessionId: session.sessionId, amount: depositAmount, currency: 'BRL' };
  }
}

export const paymentService = new PaymentService();

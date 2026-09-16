// lapa-casa-hostel/backend/src/lib/payments/stripe-connect.ts
// Wrapper del SDK de Stripe Connect para administradores de apartamentos.
//
// Modelo: "separate charges and transfers"
//   - Lapa Casa cobra el PaymentIntent (en la cuenta de la plataforma)
//   - Después del check-in se crea un Transfer hacia el acct_xxx del administrador
//
// Comisiones acordadas:
//   - Lapa Casa retiene 5% de comisión
//   - El administrador paga 0.99% de tasa de payout
//   - Stripe cobra 3.99% operacional (costo de la plataforma)
//   - El 30% de depósito se retiene hasta check-in:
//       5% = comisión de Lapa Casa
//       25% = garantía liberada al admin tras check-in

import Stripe from 'stripe';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';

interface CreateAccountLinkInput {
  stripeAccountId: string;
  refreshUrl: string;
  returnUrl: string;
}

interface CreateTransferInput {
  /** Monto en BRL (sin centavos — se convierte internamente a centavos) */
  amount: number;
  /** Cuenta Stripe del administrador (acct_xxx) */
  destinationAccountId: string;
  /** ID del PaymentIntent de origen (para trazabilidad) */
  sourcePaymentIntentId?: string;
  reservationId: string;
  description: string;
  metadata?: Record<string, string>;
}

interface TransferResult {
  transferId: string;
  amount: number;
  currency: string;
}

interface OnboardingLinkResult {
  url: string;
  expiresAt: Date;
}

export class StripeConnectHandler {
  private stripe: Stripe | null = null;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2023-10-16' });
    } else {
      logger.warn('STRIPE_SECRET_KEY no configurada — Stripe Connect deshabilitado');
    }
  }

  /**
   * Crea una cuenta Express de Stripe para un nuevo administrador.
   * Devuelve el stripe_account_id (acct_xxx) que se guarda en apartment_owners.
   */
  async createExpressAccount(email: string, country: string = 'BR'): Promise<string> {
    if (!this.stripe) {
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('Stripe Connect no disponible en este momento', 503);
      }
      // En dev/test devuelve un ID ficticio para no bloquear el flujo
      return `acct_test_${Date.now()}`;
    }

    const account = await this.stripe.accounts.create({
      type: 'express',
      country,
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      settings: {
        payouts: {
          // El administrador recibe el payout automáticamente cada 7 días
          schedule: { interval: 'weekly', weekly_anchor: 'monday' },
        },
      },
    });

    logger.info('Cuenta Stripe Express creada', { accountId: account.id, email });
    return account.id;
  }

  /**
   * Genera un link de onboarding para que el administrador registre su banco.
   * El link expira en 24h — si el admin no lo completó, se llama de nuevo.
   */
  async createOnboardingLink(input: CreateAccountLinkInput): Promise<OnboardingLinkResult> {
    if (!this.stripe) {
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('Stripe Connect no disponible en este momento', 503);
      }
      // Stub en dev
      return {
        url: `https://connect.stripe.com/setup/s/test_${Date.now()}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    }

    const link = await this.stripe.accountLinks.create({
      account: input.stripeAccountId,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: 'account_onboarding',
    });

    // Stripe devuelve expires_at en segundos Unix
    const expiresAt = new Date(link.expires_at * 1000);
    logger.info('Link de onboarding generado', { accountId: input.stripeAccountId, expiresAt });

    return { url: link.url, expiresAt };
  }

  /**
   * Verifica el estado actual de una cuenta Stripe Connect.
   * Devuelve si puede recibir transferencias o aún está en onboarding.
   */
  async getAccountStatus(stripeAccountId: string): Promise<{
    canReceiveTransfers: boolean;
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  }> {
    if (!this.stripe) {
      return { canReceiveTransfers: true, detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true };
    }

    const account = await this.stripe.accounts.retrieve(stripeAccountId);
    return {
      canReceiveTransfers: account.payouts_enabled === true,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled ?? false,
    };
  }

  /**
   * Crea un Transfer de Stripe hacia la cuenta del administrador.
   * Se usa en dos momentos:
   *   1. Tras el check-in: transfiere el 70% del precio total (remaining_amount)
   *   2. Junto con lo anterior: libera el 25% retenido del depósito
   *
   * IMPORTANTE: el Transfer se crea en la cuenta de la plataforma y se destina
   * al acct_xxx del admin. Stripe valida que el PaymentIntent de origen ya
   * esté en estado `succeeded` antes de permitir el Transfer.
   */
  async createTransfer(input: CreateTransferInput): Promise<TransferResult> {
    if (!this.stripe) {
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('Stripe Connect no disponible en este momento', 503);
      }
      logger.warn('Stripe Connect — simulando Transfer en dev', {
        amount: input.amount,
        destination: input.destinationAccountId,
      });
      return {
        transferId: `tr_test_${Date.now()}`,
        amount: input.amount,
        currency: 'BRL',
      };
    }

    const amountCents = Math.round(input.amount * 100);

    const transfer = await this.stripe.transfers.create({
      amount: amountCents,
      currency: 'brl',
      destination: input.destinationAccountId,
      description: input.description,
      metadata: {
        reservation_id: input.reservationId,
        ...input.metadata,
      },
      // Si se provee el PaymentIntent de origen Stripe verifica que esté succeeded
      ...(input.sourcePaymentIntentId
        ? { source_transaction: input.sourcePaymentIntentId }
        : {}),
    });

    logger.info('Transfer Stripe creado', {
      transferId: transfer.id,
      amount: input.amount,
      destination: input.destinationAccountId,
      reservationId: input.reservationId,
    });

    return {
      transferId: transfer.id,
      amount: input.amount,
      currency: 'BRL',
    };
  }

  /**
   * Calcula cuánto le corresponde al administrador después de retener la
   * comisión de Lapa Casa y la tasa de payout.
   *
   * Ejemplo con finalPrice = 1000 BRL:
   *   commissionRate = 0.05  →  50 BRL para Lapa Casa
   *   payoutFeeRate  = 0.0099 →  9.9 BRL de tasa de payout
   *   adminReceives  = 1000 - 50 - 9.9 = 940.1 BRL
   */
  calculateAdminAmount(params: {
    finalPrice: number;
    commissionRate: number;
    payoutFeeRate: number;
  }): {
    commissionAmount: number;
    payoutFeeAmount: number;
    adminNetAmount: number;
  } {
    const { finalPrice, commissionRate, payoutFeeRate } = params;
    const commissionAmount = parseFloat((finalPrice * commissionRate).toFixed(2));
    const payoutFeeAmount = parseFloat((finalPrice * payoutFeeRate).toFixed(2));
    const adminNetAmount = parseFloat((finalPrice - commissionAmount - payoutFeeAmount).toFixed(2));
    return { commissionAmount, payoutFeeAmount, adminNetAmount };
  }
}

export const stripeConnectHandler = new StripeConnectHandler();

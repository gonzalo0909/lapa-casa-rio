import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../services/payment-service';
import { bookingService } from '../../services/booking-service';
import { emailService } from '../../services/email-service';
import { logger } from '../../utils/logger';

export const handleWebhookHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const provider = (req.query.provider as string) || 'stripe';

  try {
    if (provider === 'stripe') {
      const signature = req.headers['stripe-signature'] as string;
      if (!signature) {
        res.status(400).json({ error: 'No signature' });
        return;
      }
      await paymentService.handleStripeWebhook(req.body, signature);
    } else if (provider === 'mercadopago') {
      await paymentService.handleMercadoPagoWebhook(req.body);
    } else {
      res.status(400).json({ error: 'Unknown provider' });
      return;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling webhook', {
      provider,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(200).json({ received: true, error: 'Processing failed' });
  }
};

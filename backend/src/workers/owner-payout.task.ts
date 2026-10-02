import { releaseDueOwnerPayouts } from '../services/owner-payout-service';
import { logger } from '../utils/logger';

/** Paga a los propietarios las garantias retenidas ya vencidas. Idempotente. */
export async function runOwnerPayouts(): Promise<void> {
  const res = await releaseDueOwnerPayouts();
  logger.info('owner-payout completado', res);
}

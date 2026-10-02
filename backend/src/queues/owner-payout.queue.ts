//
// Repeatable job una vez por dia, 13:00 America/Sao_Paulo (despues del check-out de las 12:00): paga a los administradores de apartamentos las
// garantías retenidas de reservas ya terminadas (post check-out + período de
// espera). Ver services/owner-payout-service.ts.

import { createSafeQueue } from './safe-queue';

export const ownerPayoutQueue = createSafeQueue('owner-payout', { attempts: 1 });

const SCHEDULER_ID = 'owner-payout-hourly';

export async function registerOwnerPayoutScheduler(): Promise<void> {
  await ownerPayoutQueue.upsertScheduler(SCHEDULER_ID, { pattern: '0 16 * * *' }, { name: 'release-due-payouts' });
}

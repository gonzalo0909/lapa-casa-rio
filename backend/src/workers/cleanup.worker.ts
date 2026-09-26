
import { type Job, Worker } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import { query } from '../config/database';
import bookingRepo from '../database/repositories/booking-repository';
import { notificationService } from '../services/notification-service';
import { groupPaymentService } from '../services/group-payment-service';
import { emailService, type BookingWithGuest } from '../services/email-service';
import { generateReferralCode } from '../utils/encryption';
import { logger } from '../utils/logger';

async function notifyPendingNoShows(): Promise<void> {
  // Idempotente: solo reservas no_show que todavia no tienen una notificacion
  // 'sent' con template no_show -- no depende de una ventana de tiempo, asi
  // que corridas superpuestas del job nunca duplican el envio.
  const { rows } = await query<{ id: string }>(
    `SELECT r.id FROM reservations r
     WHERE r.status = 'no_show'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.reservation_id = r.id AND n.template = 'no_show' AND n.status = 'sent'
       )`
  );

  for (const row of rows) {
    const booking = await bookingRepo.findById(row.id);
    if (!booking?.guest) {
      logger.warn('Reserva no_show sin guest cargado, se omite notificación', { reservationId: row.id });
      continue;
    }
    try {
      await notificationService.notify('no_show', booking as BookingWithGuest);
    } catch (error: any) {
      logger.error('Error notificando no-show', { reservationId: row.id, error: error.message });
    }
  }
}

async function notifyExpiredPending(): Promise<void> {
  // Mismo patron idempotente que notifyPendingNoShows(): no depende de una
  // ventana de tiempo, asi que corridas superpuestas del job nunca
  // duplican el envio. cancellation_reason='auto_timeout_pending_expired'
  // es el valor que pone sp_cleanup_expired_pending() (0013_fix_pending_timeout_label.sql)
  // -- distingue esta cancelacion automatica por hold vencido de una
  // cancelacion pedida por el huesped, que ya tiene su propio email.
  const { rows } = await query<{ id: string }>(
    `SELECT r.id FROM reservations r
     WHERE r.status = 'cancelled'
       AND r.cancellation_reason = 'auto_timeout_pending_expired'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.reservation_id = r.id AND n.template = 'booking_expired' AND n.status = 'sent'
       )`
  );

  for (const row of rows) {
    const booking = await bookingRepo.findById(row.id);
    if (!booking?.guest) {
      logger.warn('Reserva expirada sin guest cargado, se omite notificación', { reservationId: row.id });
      continue;
    }
    try {
      await notificationService.notify('booking_expired', booking as BookingWithGuest);
    } catch (error: any) {
      logger.error('Error notificando reserva expirada', { reservationId: row.id, error: error.message });
    }
  }
}

/**
 * Recordatorio de check-in: reservas confirmadas con check-in entre 46h y 50h desde ahora.
 * La ventana de 4h (no 1h exacta) absorbe corridas desfasadas del cron sin
 * enviar duplicados -- el NOT EXISTS en la tabla notifications hace el trabajo real.
 */
async function notifyCheckinReminders(): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `SELECT r.id FROM reservations r
     WHERE r.status = 'confirmed'
       AND r.check_in_date::date = (NOW() AT TIME ZONE 'America/Sao_Paulo' + INTERVAL '2 days')::date
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.reservation_id = r.id AND n.template = 'checkin_reminder' AND n.status = 'sent'
       )`
  );

  for (const row of rows) {
    const booking = await bookingRepo.findById(row.id);
    if (!booking?.guest) {
      logger.warn('Reserva sin guest para recordatorio de check-in', { reservationId: row.id });
      continue;
    }
    try {
      await notificationService.notify('checkin_reminder', booking as BookingWithGuest);
    } catch (error: any) {
      logger.error('Error enviando recordatorio de check-in', { reservationId: row.id, error: error.message });
    }
  }
}

/**
 * Solicitud de reseña post-checkout: reservas completadas cuyo check-out fue ayer o avant-hier.
 * Se espera ~24h para dar tiempo al huesped de llegar a destino antes de pedirle la reseña.
 */
async function notifyPostCheckoutReviews(): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `SELECT r.id FROM reservations r
     WHERE r.status = 'completed'
       AND r.check_out_date::date = (NOW() AT TIME ZONE 'America/Sao_Paulo' - INTERVAL '1 day')::date
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.reservation_id = r.id AND n.template = 'review_request' AND n.status = 'sent'
       )`
  );

  for (const row of rows) {
    const booking = await bookingRepo.findById(row.id);
    if (!booking?.guest) {
      logger.warn('Reserva sin guest para solicitud de reseña', { reservationId: row.id });
      continue;
    }
    try {
      await notificationService.notify('review_request', booking as BookingWithGuest);
    } catch (error: any) {
      logger.error('Error enviando solicitud de reseña', { reservationId: row.id, error: error.message });
    }
  }
}

/**
 * Premio de referido post-checkout: se ejecuta el día siguiente al check-out.
 * Solo premia si la reserva usó un código de referido y la notificación
 * 'referral_reward' aún no fue enviada para esa reserva (idempotente).
 */
async function grantPostCheckoutReferralRewards(): Promise<void> {
  const { rows } = await query<{
    id: string;
    guest_id: string;
    referral_owner_guest_id: string;
  }>(
    `SELECT r.id, r.guest_id, ao.referral_owner_guest_id
     FROM reservations r
     JOIN apartment_offers ao ON r.applied_offer_code = ao.code
     WHERE r.status = 'completed'
       AND r.check_out_date::date = (NOW() AT TIME ZONE 'America/Sao_Paulo' - INTERVAL '1 day')::date
       AND ao.referral_owner_guest_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.reservation_id = r.id AND n.template = 'referral_reward' AND n.status = 'sent'
       )`
  );

  for (const row of rows) {
    try {
      const { rows: referrerRows } = await query<{ full_name: string; email: string; language: string | null }>(
        `SELECT full_name, email, language FROM guests WHERE id = $1`,
        [row.referral_owner_guest_id],
      );
      const referrer = referrerRows[0];
      if (!referrer) {continue;}

      // Busca saldo acumulado activo para este referidor
      const { rows: existingRows } = await query<{ id: number; code: string; valid_to: string }>(
        `SELECT id, code, valid_to FROM apartment_offers
         WHERE referral_owner_guest_id = $1 AND label = 'Premio por referido'
           AND is_active = true AND valid_to >= now()::date
         ORDER BY valid_to ASC LIMIT 1`,
        [row.referral_owner_guest_id],
      );

      let rewardCode: string;
      let rewardValidTo: Date;

      if (existingRows.length > 0) {
        rewardCode = existingRows[0].code;
        rewardValidTo = new Date(existingRows[0].valid_to);
        await query(
          `UPDATE apartment_offers SET discount_amount = discount_amount + 5 WHERE id = $1`,
          [existingRows[0].id],
        );
      } else {
        rewardCode = generateReferralCode();
        rewardValidTo = new Date(process.env.REFERRAL_CODE_VALID_UNTIL ?? '2099-12-31');
        await query(
          `INSERT INTO apartment_offers
             (code, label, discount_percent, discount_amount,
              apartment_ids, valid_from, valid_to, is_active, referral_owner_guest_id)
           VALUES ($1, 'Premio por referido', 0, 5, NULL, now()::date, $2::date, true, $3)`,
          [rewardCode, rewardValidTo.toISOString().slice(0, 10), row.referral_owner_guest_id],
        );
      }

      await emailService.sendReferralReward(
        { fullName: referrer.full_name, email: referrer.email, language: referrer.language },
        rewardCode,
        rewardValidTo,
      );

      // Registra para idempotência: próxima execução do worker ignora esta reserva
      await query(
        `INSERT INTO notifications (reservation_id, guest_id, channel, template, status, sent_at)
         VALUES ($1, $2, 'email', 'referral_reward', 'sent', now())`,
        [row.id, row.guest_id],
      );

      logger.info('Premio de referido otorgado post-checkout', {
        reservationId: row.id,
        referrerGuestId: row.referral_owner_guest_id,
        rewardCode,
      });
    } catch (error: any) {
      logger.error('Error otorgando premio de referido post-checkout', {
        reservationId: row.id,
        error: error.message,
      });
    }
  }
}

export function startCleanupWorker(): Worker {
  const worker = new Worker(
    'cleanup',
    async (_job: Job) => {
      const start = Date.now();
      await query('CALL sp_cleanup_expired_pending()');
      await query('CALL sp_release_no_show()');
      await notifyPendingNoShows();
      await notifyExpiredPending();
      await notifyCheckinReminders();
      await notifyPostCheckoutReviews();
      await grantPostCheckoutReferralRewards();
      // Feature 2: cancelar sesiones de pago grupal expiradas (timer 30 min)
      const cancelled = await groupPaymentService.cancelExpiredSessions();
      if (cancelled > 0) {logger.info('Sesiones grupales expiradas canceladas', { count: cancelled });}
      logger.info('cleanup worker completado', { ms: Date.now() - start });
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('cleanup worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}

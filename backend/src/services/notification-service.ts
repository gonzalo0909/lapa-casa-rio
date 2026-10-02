//
// Servicio de notificaciones por email: envia inmediato (notify) o
// programa para mas adelante (scheduleNotification, via BullMQ). Toda
// notificacion queda persistida en la tabla real `notifications`
// (0002_tables.sql) -- getNotificationHistory lee de ahi, no de un log.
//
// El canal WhatsApp vive aparte en whatsapp-notification-service.ts
// (deshabilitado por defecto, WHATSAPP_ENABLED=false) -- este archivo
// es el que implementado en notification-service.ts.

import { query } from '../config/database';
import bookingRepo from '../database/repositories/booking-repository';
import { emailService, type BookingWithGuest } from './email-service';
import { logger } from '../utils/logger';

export type NotificationType =
  | 'booking_confirmation'
  | 'payment_reminder'
  | 'payment_received'
  | 'welcome'
  | 'cancellation'
  | 'no_show'
  | 'booking_expired'
  | 'checkin_reminder'
  | 'review_request';

export interface NotificationRecord {
  id: string;
  reservation_id: string | null;
  guest_id: string | null;
  channel: string;
  template: string;
  status: string;
  payload: Record<string, any> | null;
  sent_at: Date | null;
  error: string | null;
  created_at: Date;
}

async function dispatchByType(type: NotificationType, booking: BookingWithGuest, data: Record<string, any>): Promise<void> {
  switch (type) {
    case 'booking_confirmation':
      await emailService.sendBookingConfirmation(booking, data.referralCode as string | null | undefined);
      return;
    case 'payment_reminder':
      await emailService.sendPaymentReminder(booking);
      return;
    case 'payment_received':
      await emailService.sendPaymentReceived(booking, data.amount);
      return;
    case 'welcome':
      // Ya no se envia (el huesped recibe solo confirmacion, un recordatorio y la despedida).
      // Queda como no-op por los jobs 'welcome' que pudieran seguir programados en Redis.
      return;
    case 'cancellation':
      await emailService.sendCancellationNotice(booking, data.refundAmount ?? 0);
      return;
    case 'no_show':
      await emailService.sendNoShowNotice(booking);
      return;
    case 'booking_expired':
      await emailService.sendBookingExpiredNotice(booking);
      return;
    case 'checkin_reminder':
      // Recordatorio UNICO antes del check-in: si falta pagar el saldo, sugiere pagar;
      // si ya esta pago, manda los datos del check-in.
      if (data.mode === 'pay') {
        await emailService.sendPaymentReminder(booking);
      } else {
        await emailService.sendCheckinReminder(booking);
      }
      return;
    case 'review_request':
      await emailService.sendReviewRequest(booking);
      return;
    default:
      throw new Error(`Tipo de notificación desconocido: ${type}`);
  }
}

export class NotificationService {
  /**
   * intenta el envío ya mismo, en el request actual. Si falla, la notificación
   * queda en estado 'failed' con un contador de intentos y la tarea periódica
   * retryFailedNotifications() la reintenta hasta 3 veces en total (sin colas ni
   * Redis: el estado vive en la tabla notifications).
   */
  async notify(type: NotificationType, booking: BookingWithGuest, data: Record<string, any> = {}): Promise<void> {
    const notificationId = await this.recordNotification({
      reservationId: booking.id,
      guestId: booking.guest.id,
      template: type,
      status: 'pending',
      payload: data
    });

    try {
      await dispatchByType(type, booking, data);
      await this.updateNotification(notificationId, { status: 'sent', sentAt: new Date() });
    } catch (error: any) {
      logger.error('Error enviando notificación, se reintentará', {
        type,
        reservationId: booking.id,
        notificationId,
        error: error.message
      });
      await this.markFailedAttempt(notificationId, error.message);
      // No relanza: el reintento queda en manos de la tarea periódica, el llamador no
      // tiene por qué bloquear ni fallar la respuesta HTTP por esto.
    }
  }

  /** Reintenta el envío de una notificación ya registrada (usado por retryFailedNotifications). */
  async processScheduled(notificationId: string, reservationId: string, type: NotificationType): Promise<void> {
    const notification = await this.getNotificationById(notificationId);
    if (!notification) {
      logger.warn('Notificación programada no encontrada, se descarta', { notificationId });
      return;
    }

    const booking = await bookingRepo.findById(reservationId);
    if (!booking || !booking.guest) {
      await this.updateNotification(notificationId, { status: 'failed', error: 'reservation_or_guest_not_found' });
      logger.error('No se pudo procesar notificación programada: reserva o huésped inexistente', { notificationId, reservationId });
      return;
    }

    try {
      await dispatchByType(type, booking as BookingWithGuest, notification.payload ?? {});
      await this.updateNotification(notificationId, { status: 'sent', sentAt: new Date() });
    } catch (error: any) {
      await this.markFailedAttempt(notificationId, error.message);
      throw error;
    }
  }

  /** Reintenta las notificaciones fallidas de los últimos 2 días (máx. 3 intentos en total). Lo llama el planificador del worker. */
  async retryFailedNotifications(): Promise<void> {
    const { rows } = await query<{ id: string; reservation_id: string; template: string }>(
      `SELECT id, reservation_id, template
       FROM notifications
       WHERE status = 'failed' AND channel = 'email'
         AND reservation_id IS NOT NULL
         AND created_at > now() - INTERVAL '2 days'
         AND COALESCE((payload->>'_attempts')::int, 0) < 3
       ORDER BY created_at
       LIMIT 50`
    );
    for (const row of rows) {
      try {
        await this.processScheduled(row.id, row.reservation_id, row.template as NotificationType);
      } catch (error: any) {
        logger.warn('Reintento de notificación fallido', { notificationId: row.id, error: error.message });
      }
    }
  }

  private async markFailedAttempt(id: string, error: string): Promise<void> {
    await query(
      `UPDATE notifications
       SET status = 'failed', error = $2,
           payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('_attempts', COALESCE((payload->>'_attempts')::int, 0) + 1)
       WHERE id = $1`,
      [id, error]
    );
  }

  async getNotificationHistory(bookingId: string): Promise<NotificationRecord[]> {
    const { rows } = await query<NotificationRecord>(
      `SELECT id, reservation_id, guest_id, channel, template, status, payload, sent_at, error, created_at
       FROM notifications
       WHERE reservation_id = $1
       ORDER BY created_at DESC`,
      [bookingId]
    );
    return rows;
  }

  private async recordNotification(entry: {
    reservationId: string;
    guestId: string;
    template: string;
    status: 'sent' | 'pending' | 'failed';
    payload?: Record<string, any>;
    sentAt?: Date;
    error?: string;
  }): Promise<string> {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO notifications (reservation_id, guest_id, channel, template, status, payload, sent_at, error)
       VALUES ($1, $2, 'email', $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        entry.reservationId,
        entry.guestId,
        entry.template,
        entry.status,
        entry.payload ? JSON.stringify(entry.payload) : null,
        entry.sentAt ?? null,
        entry.error ?? null
      ]
    );
    return rows[0].id;
  }

  private async updateNotification(id: string, update: { status: 'sent' | 'failed'; sentAt?: Date; error?: string }): Promise<void> {
    await query(
      `UPDATE notifications SET status = $2, sent_at = $3, error = $4 WHERE id = $1`,
      [id, update.status, update.sentAt ?? null, update.error ?? null]
    );
  }

  private async getNotificationById(id: string): Promise<NotificationRecord | null> {
    const { rows } = await query<NotificationRecord>(
      `SELECT id, reservation_id, guest_id, channel, template, status, payload, sent_at, error, created_at
       FROM notifications WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }
}

export const notificationService = new NotificationService();

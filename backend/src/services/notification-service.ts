// lapa-casa-hostel/backend/src/services/notification-service.ts
// ventana4
//
// Servicio de notificaciones por email: envia inmediato (notify) o
// programa para mas adelante (scheduleNotification, via BullMQ). Toda
// notificacion queda persistida en la tabla real `notifications`
// (0002_tables.sql) -- getNotificationHistory lee de ahi, no de un log.
//
// El canal WhatsApp vive aparte en whatsapp-notification-service.ts
// (deshabilitado por defecto, WHATSAPP_ENABLED=false) -- este archivo
// es el que Ventana 4 pide bajo el nombre notification-service.ts.

import { query } from '../config/database';
import bookingRepo from '../database/repositories/booking-repository';
import { emailService, BookingWithGuest } from './email-service';
import { emailNotificationsQueue } from '../queues/email-notifications.queue';
import { logger } from '../utils/logger';

export type NotificationType =
  | 'booking_confirmation'
  | 'payment_reminder'
  | 'payment_received'
  | 'welcome'
  | 'cancellation'
  | 'no_show';

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
      await emailService.sendBookingConfirmation(booking);
      return;
    case 'payment_reminder':
      await emailService.sendPaymentReminder(booking);
      return;
    case 'payment_received':
      await emailService.sendPaymentReceived(booking, data.amount);
      return;
    case 'welcome':
      await emailService.sendWelcomeEmail(booking);
      return;
    case 'cancellation':
      await emailService.sendCancellationNotice(booking, data.refundAmount ?? 0);
      return;
    case 'no_show':
      await emailService.sendNoShowNotice(booking);
      return;
    default:
      throw new Error(`Tipo de notificación desconocido: ${type}`);
  }
}

export class NotificationService {
  /** Envia ya mismo, en el request actual. Para llamados que puedan tardar/fallar sin bloquear al usuario, usar scheduleNotification con sendAt=now. */
  async notify(type: NotificationType, booking: BookingWithGuest, data: Record<string, any> = {}): Promise<void> {
    try {
      await dispatchByType(type, booking, data);
      await this.recordNotification({
        reservationId: booking.id,
        guestId: booking.guest.id,
        template: type,
        status: 'sent',
        payload: data,
        sentAt: new Date()
      });
    } catch (error: any) {
      logger.error('Error enviando notificación', { type, reservationId: booking.id, error: error.message });
      await this.recordNotification({
        reservationId: booking.id,
        guestId: booking.guest.id,
        template: type,
        status: 'failed',
        payload: data,
        error: error.message
      });
      throw error;
    }
  }

  /** Encola el envio para `sendAt` via BullMQ (delay). Si REDIS_URL no esta configurada, safe-queue loguea y no encola -- ver src/queues/connection.ts. */
  async scheduleNotification(
    type: NotificationType,
    booking: BookingWithGuest,
    sendAt: Date,
    data: Record<string, any> = {}
  ): Promise<string> {
    const notificationId = await this.recordNotification({
      reservationId: booking.id,
      guestId: booking.guest.id,
      template: type,
      status: 'pending',
      payload: data
    });

    const delayMs = Math.max(0, sendAt.getTime() - Date.now());
    await emailNotificationsQueue.add(
      'send-scheduled-notification',
      { notificationId, reservationId: booking.id, type },
      { delay: delayMs }
    );

    return notificationId;
  }

  /** Usado por el worker (workers/email-notifications.worker.ts) al procesar un job encolado por scheduleNotification. */
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
      await this.updateNotification(notificationId, { status: 'failed', error: error.message });
      throw error; // deja que BullMQ reintente segun la política de la cola
    }
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

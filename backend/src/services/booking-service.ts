// lapa-casa-hostel/backend/src/services/booking-service.ts
//
// REQUISITO CRITICO #1 (prompt Maestro v1.5): acquire_bed_locks() +
// check_availability() + el INSERT de reservation_beds deben correr
// dentro de la MISMA transaccion (pg_advisory_xact_lock solo protege
// dentro de la misma conexion fisica). La version anterior de este
// archivo creaba la fila en `reservations` pero NUNCA insertaba en
// `reservation_beds` -- ninguna cama quedaba realmente bloqueada y el
// constraint EXCLUDE (autoridad final anti-overbooking) nunca llegaba a
// intervenir. Corregido acá.

import { PoolClient } from 'pg';
import { query, withTransaction } from '../config/database';
import { GuestRepository } from '../database/repositories/guest-repository';
import { BookingRepository } from '../database/repositories/booking-repository';
import { acquireLock } from '../database/lock-middleware';
import { pricingService } from './pricing-service';
import { enqueueSheetsExport } from '../queues/sheets-export.queue';
import { logger } from '../utils/logger';
import type { Reservation, BookingStatus } from '../types/database';

// ventana4 (bloque 2): fire-and-forget -- un fallo al encolar el espejo a
// Sheets nunca debe tumbar la operación real sobre la reserva.
const exportToSheetsAsync = (reservationId: string, action: 'upsert' | 'delete' = 'upsert'): void => {
  enqueueSheetsExport(reservationId, action).catch(err =>
    logger.warn('No se pudo encolar el export a Sheets', { reservationId, error: err.message })
  );
};

const guestRepo = new GuestRepository();
const bookingRepo = new BookingRepository();

export class InsufficientAvailabilityError extends Error {
  constructor(public readonly details: unknown) {
    super('No hay camas suficientes disponibles para las fechas solicitadas');
    this.name = 'InsufficientAvailabilityError';
  }
}

const isOverbookingError = (error: unknown): boolean => {
  const code = (error as { code?: string })?.code;
  // 23505 = unique_violation (trigger trg_prevent_overbooking), 23P01 = exclusion_violation (constraint EXCLUDE)
  return code === '23505' || code === '23P01';
};

const generateReservationNumber = (): string =>
  `LCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

interface CreateBookingInput {
  checkIn: string;
  checkOut: string;
  rooms: Array<{ roomId: string; bedsCount: number }>;
  guest: {
    full_name: string;
    email: string;
    phone?: string;
    country?: string;
    document?: string;
    language?: string;
  };
  nights: number;
  totalBeds: number;
  pricing: {
    basePrice: number;
    seasonMultiplier: number;
    groupDiscount: number;
    totalPrice: number;
    depositAmount: number;
    depositPercent: number;
    remainingAmount: number;
  };
  specialRequests?: string;
  source?: string;
  language?: 'pt' | 'en' | 'es';
  status?: BookingStatus;
}

/** Selecciona `count` camas libres y elegibles por genero dentro de UNA habitacion, bajo la transaccion activa. */
const pickAvailableBedsInRoom = async (
  client: PoolClient,
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
  count: number,
  gender: 'mixed' | 'female' | 'male'
): Promise<string[]> => {
  const { rows } = await client.query(
    `SELECT bed_id FROM check_availability($1::date, $2::date, $3::bed_gender)
     WHERE room_type_id = $4::uuid AND is_gender_eligible = true AND is_available = true
     LIMIT $5`,
    [checkIn, checkOut, gender, roomTypeId, count]
  );
  return rows.map((r: any) => r.bed_id);
};

export class BookingService {
  async createBooking(data: CreateBookingInput): Promise<Reservation & { bedIds: string[] }> {
    const result = await withTransaction(async (client) => {
      const guest = await guestRepo.upsert({
        full_name: data.guest.full_name,
        email: data.guest.email,
        phone: data.guest.phone ?? null,
        country: data.guest.country ?? null,
        language: data.guest.language ?? null
      });

      const { rows: channelRows } = await client.query(`SELECT id FROM channels WHERE code = 'direct'`);
      if (channelRows.length === 0) throw new Error('Canal "direct" no encontrado en la tabla channels');
      const channelId = channelRows[0].id;

      // 1) Elegir camas candidatas por habitacion (sin lock todavia)
      const candidateBedIds: string[] = [];
      for (const room of data.rooms) {
        const beds = await pickAvailableBedsInRoom(client, room.roomId, data.checkIn, data.checkOut, room.bedsCount, 'mixed');
        if (beds.length < room.bedsCount) {
          throw new InsufficientAvailabilityError({ roomId: room.roomId, requested: room.bedsCount, found: beds.length });
        }
        candidateBedIds.push(...beds);
      }

      // 2) Adquirir advisory locks de esas camas especificas, DENTRO de esta transaccion
      await acquireLock(client, candidateBedIds);

      // 3) Re-verificar bajo lock: otra transaccion pudo haber tomado alguna mientras esperabamos
      const { rows: stillOccupied } = await client.query(
        `SELECT bed_id FROM reservation_beds
         WHERE bed_id = ANY($1::uuid[])
           AND daterange(check_in, check_out, '[)') && daterange($2::date, $3::date, '[)')`,
        [candidateBedIds, data.checkIn, data.checkOut]
      );
      if (stillOccupied.length > 0) {
        throw new InsufficientAvailabilityError({ conflictingBeds: stillOccupied.map((r: any) => r.bed_id) });
      }

      // 4) early_bird_discount real, via SQL (el resto del precio ya vino de pricingService)
      const bookingDate = new Date().toISOString().slice(0, 10);
      const { rows: earlyBirdRows } = await client.query(
        `SELECT calculate_early_bird_discount($1::date, $2::date) AS d`,
        [bookingDate, data.checkIn]
      );
      const earlyBirdDiscount = parseFloat(earlyBirdRows[0].d);

      const reservationNumber = generateReservationNumber();
      const initialStatus = data.status ?? 'pending_payment';

      const { rows: reservationRows } = await client.query(
        `INSERT INTO reservations (
           reservation_number, guest_id, channel_id,
           check_in_date, check_out_date, nights_count, beds_count,
           base_price, season_multiplier, group_discount, early_bird_discount, final_price,
           deposit_percent, deposit_amount, remaining_amount,
           status, pending_expires_at, special_requests, source
         ) VALUES (
           $1, $2, $3,
           $4::date, $5::date, $6, $7,
           $8, $9, $10, $11, $12,
           $13, $14, $15,
           $16::booking_status, $17, $18, $19
         ) RETURNING *`,
        [
          reservationNumber,
          guest.id,
          channelId,
          data.checkIn,
          data.checkOut,
          data.nights,
          data.totalBeds,
          data.pricing.basePrice,
          data.pricing.seasonMultiplier,
          data.pricing.groupDiscount,
          earlyBirdDiscount,
          data.pricing.totalPrice,
          data.pricing.depositPercent / 100,
          data.pricing.depositAmount,
          data.pricing.remainingAmount,
          initialStatus,
          initialStatus === 'pending_payment' ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null,
          data.specialRequests ?? null,
          data.source ?? 'direct'
        ]
      );
      const reservation = reservationRows[0];

      try {
        for (const bedId of candidateBedIds) {
          await client.query(
            `INSERT INTO reservation_beds (reservation_id, bed_id, check_in, check_out)
             VALUES ($1, $2, $3::date, $4::date)`,
            [reservation.id, bedId, data.checkIn, data.checkOut]
          );
        }
      } catch (error) {
        if (isOverbookingError(error)) {
          throw new InsufficientAvailabilityError({ reason: 'overbooking_detected_at_insert' });
        }
        throw error;
      }

      logger.info('Booking created', { reservationId: reservation.id, reservationNumber, beds: candidateBedIds.length });
      return { ...reservation, bedIds: candidateBedIds };
    });

    // Fuera de la transaccion a proposito: si esto fallara, la reserva ya
    // esta confirmada en la base -- un email/export perdido no debe
    // revertir una reserva real.
    exportToSheetsAsync(result.id);
    return result;
  }

  async getBooking(id: string): Promise<Reservation | null> {
    return bookingRepo.findById(id);
  }

  /** No reimplementa liberacion de camas -- trg_release_beds_on_status_change lo hace solo al cambiar status. */
  async cancelBooking(id: string, reason?: string): Promise<Reservation> {
    const result = await bookingRepo.cancelReservation(id, reason);
    exportToSheetsAsync(id);
    return result;
  }

  async confirmBooking(id: string): Promise<Reservation> {
    const result = await bookingRepo.confirmReservation(id);
    exportToSheetsAsync(id);
    return result;
  }

  async listBookings(filters: {
    status?: BookingStatus;
    dateFrom?: string;
    dateTo?: string;
    guestEmail?: string;
    guestName?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: Reservation[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
    const { data, total } = await bookingRepo.search({ ...filters, page, limit });
    return { data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async getBookingStats(from: string, to: string): Promise<{
    totalBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    cancelledBookings: number;
    totalRevenue: number;
  }> {
    const result = await query<{
      total: string; confirmed: string; pending: string; cancelled: string; revenue: string;
    }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status IN ('confirmed','completed'))::int AS confirmed,
         COUNT(*) FILTER (WHERE status = 'pending_payment')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
         COALESCE(SUM(final_price) FILTER (WHERE status IN ('confirmed','completed')), 0) AS revenue
       FROM reservations
       WHERE check_in_date >= $1::date AND check_in_date <= $2::date`,
      [from, to]
    );
    const row = result.rows[0];
    return {
      totalBookings: parseInt(row.total, 10),
      confirmedBookings: parseInt(row.confirmed, 10),
      pendingBookings: parseInt(row.pending, 10),
      cancelledBookings: parseInt(row.cancelled, 10),
      totalRevenue: parseFloat(row.revenue)
    };
  }

  /** Libera reservas pending_payment vencidas (>15 min). sp_cleanup_expired_pending() cubre lo mismo desde BullMQ (Ventana 4). */
  async expirePendingBookings(): Promise<number> {
    const { rows } = await query(
      `UPDATE reservations
       SET status = 'cancelled', cancelled_at = now(), cancellation_reason = 'pending_payment_expired', updated_at = now()
       WHERE status = 'pending_payment' AND pending_expires_at < now()
       RETURNING id`
    );
    return rows.length;
  }

  // ventana3
  async updateBooking(id: string, data: Parameters<typeof bookingRepo.update>[1]): Promise<Reservation> {
    const result = await bookingRepo.update(id, data);
    exportToSheetsAsync(id);
    return result;
  }

  // ventana3
  async updateGuest(guestId: string, data: Partial<{
    full_name: string;
    phone: string;
    country: string;
    language: string;
  }>): Promise<void> {
    await guestRepo.update(guestId, data);
  }
}

export const bookingService = new BookingService();

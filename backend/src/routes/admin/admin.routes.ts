//
// Reescrito completo: la version anterior devolvia datos hardcodeados en
// cada endpoint (bookings: [], stats fijas, "Room updated" sin tocar la
// base). Todo acá lee/escribe la base real. authenticateToken ya se
// aplica en routes/index.ts para todo /admin -- login vive aparte en
// admin-auth.routes.ts, montado sin ese middleware.
//
// REQUISITO CRITICO #1 respetado a proposito: PUT /bookings/:id NO
// permite cambiar fechas/habitaciones/status acá (eso saltearia el
// motor anti-overbooking real de create-booking.ts, que adquiere locks
// y reverifica disponibilidad bajo transaccion). Para eso: cancelar
// (DELETE /bookings/:id, ya calcula reembolso) + crear una reserva
// nueva. Este endpoint es solo para correcciones que no tocan
// disponibilidad (contacto del huesped, notas, ajuste manual de precio).

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validation';
import { bookingService } from '../../services/booking-service';
import { notificationService } from '../../services/notification-service';
import { statsService } from '../../services/stats-service';
import { auditLogService } from '../../services/audit-log-service';
import { fullExport } from '../../integrations/google-sheets/booking-export';
import { query } from '../../config/database';
import { ApiResponse } from '../../utils/responses';
import { adminConflictsRouter } from './conflicts.routes';
import { adminPhotosRouter } from './photos.routes';
import { adminBlockedDatesRouter } from './blocked-dates.routes';
import { roomTypePhotosRouter } from './room-type-photos.routes';
import { apartmentOwnersRouter } from './apartment-owners.routes';
import { dynamicPricingRouter } from './dynamic-pricing.routes';
import { guestsRouter } from './guests.routes';
import { admin2faRouter } from './admin-2fa.routes';
import type { BookingWithGuest } from '../../services/email-service';

const router = Router();

/**
 * GET /admin/me — verificacion de sesion (checkSession en api.js).
 * Sin auth requerida: el panel admin no exige contraseña.
 */
router.get('/me', (_req, res) => {
  res.json(ApiResponse.success({ role: 'admin' }));
});

/**
 * /admin/conflicts — detalle + resolucion manual agregados en conflicts.routes.ts
 * (conflict-service.ts). Reemplaza el listado inline que vivia aca desde
 * (ya removido para no duplicar la ruta).
 */
router.use('/conflicts', adminConflictsRouter);

/**
 * /admin/photos — galería curada de fotos de huéspedes (photos.routes.ts)
 */
router.use('/photos', adminPhotosRouter);

/**
 * /admin/blocked-dates — bloqueo manual de fechas por habitación
 * (mantenimiento/evento privado), ver blocked-dates.routes.ts
 */
router.use('/blocked-dates', adminBlockedDatesRouter);

/**
 * /admin/room-types — gestión de fotos por apartamento
 */
router.use('/room-types', roomTypePhotosRouter);

/**
 * /admin/apartment-owners — administradores de apartamentos con Stripe Connect
 */
router.use('/apartment-owners', apartmentOwnersRouter);

/**
 * /admin/dynamic-pricing — bot de precios dinámicos (config, eventos, calendario)
 */
router.use('/dynamic-pricing', dynamicPricingRouter);

/**
 * /admin/guests — listado, bloqueo y desbloqueo de huéspedes
 */
router.use('/guests', guestsRouter);

/**
 * /admin/2fa — doble verificación (TOTP) opcional para el login de admin
 */
router.use('/2fa', admin2faRouter);

/**
 * GET /admin/dashboard — KPIs del mes actual
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // FIX (auditoría 2026-08-30): antes traía acá un top-10 de próximos
    // check-ins con una query que no seleccionaba check_out_date ni
    // status (el frontend los mostraba vacíos/rotos). Esa vista ahora la
    // cubre GET /admin/bookings/upcoming, con las columnas completas.
    const [bookingStats, occupancy, revenue, channels, groups] = await Promise.all([
      bookingService.getBookingStats(
        `${year}-${String(month).padStart(2, '0')}-01`,
        new Date(year, month, 0).toISOString().slice(0, 10),
      ),
      statsService.getOccupancyStats(month, year),
      statsService.getRevenueStats(month, year),
      statsService.getChannelStats(month, year),
      statsService.getGroupStats(month, year),
    ]);

    res.status(200).json(
      ApiResponse.success(
        {
          period: { month, year },
          bookings: bookingStats,
          occupancy: {
            averagePercent: occupancy.averageOccupancyPercent,
            byRoom: occupancy.byRoom,
          },
          revenue,
          channels,
          groups,
        },
        'Dashboard data retrieved',
      ),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/bookings — listado con filtros
 */
router.get('/bookings', async (req, res, next) => {
  try {
    const { status, from, to, channel, page, limit } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [];
    if (status) {
      params.push(status);
      conditions.push(`r.status = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`r.check_in_date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      conditions.push(`r.check_in_date <= $${params.length}::date`);
    }
    if (channel) {
      params.push(channel);
      conditions.push(`c.code = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));

    const [dataResult, countResult] = await Promise.all([
      query(
        `SELECT r.id, r.reservation_number, r.status, r.check_in_date, r.check_out_date,
                r.beds_count, r.final_price, r.deposit_amount, r.remaining_amount,
                g.full_name AS guest_name, g.email AS guest_email,
                c.code AS channel_code, r.created_at,
                units.property_type, units.unit_names
         FROM reservations r
         JOIN guests g ON g.id = r.guest_id
         JOIN channels c ON c.id = r.channel_id
         -- Hostel y apartamentos comparten la misma tabla reservations
         -- (room_types.property_type los distingue) -- sin este join la
         -- lista de Reservas no dice de cuál se trata.
         LEFT JOIN LATERAL (
           SELECT
             (ARRAY_AGG(DISTINCT rt.property_type::text))[1] AS property_type,
             STRING_AGG(DISTINCT rt.name, ', ') AS unit_names
           FROM reservation_beds rb
           JOIN beds b ON b.id = rb.bed_id
           JOIN room_types rt ON rt.id = b.room_type_id
           WHERE rb.reservation_id = r.id
         ) units ON true
         ${where}
         ORDER BY r.created_at DESC
         LIMIT ${limitNum} OFFSET ${(pageNum - 1) * limitNum}`,
        params,
      ),
      query(
        `SELECT COUNT(*)::int AS total FROM reservations r JOIN channels c ON c.id = r.channel_id ${where}`,
        params,
      ),
    ]);

    res.status(200).json(
      ApiResponse.success({
        bookings: dataResult.rows,
        pagination: { page: pageNum, limit: limitNum, total: countResult.rows[0].total },
      }),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/bookings/today — check-ins y check-outs del día actual
 */
router.get('/bookings/today', async (_req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [checkIns, checkOuts, occ] = await Promise.all([
      query<{
        id: string;
        confirmationNumber: string;
        guestName: string;
        checkIn: string;
        checkOut: string;
        bedsCount: number;
        status: string;
        nights: number;
      }>(
        `SELECT r.id,
                r.reservation_number AS "confirmationNumber",
                g.full_name AS "guestName",
                r.check_in_date::text AS "checkIn",
                r.check_out_date::text AS "checkOut",
                r.beds_count AS "bedsCount",
                r.status,
                (r.check_out_date - r.check_in_date)::int AS nights
         FROM reservations r JOIN guests g ON g.id = r.guest_id
         WHERE r.check_in_date = $1::date
           AND r.status IN ('confirmed', 'pending_payment')
         ORDER BY r.reservation_number ASC`,
        [today],
      ),
      query<{
        id: string;
        confirmationNumber: string;
        guestName: string;
        checkIn: string;
        checkOut: string;
        bedsCount: number;
        status: string;
        nights: number;
      }>(
        `SELECT r.id,
                r.reservation_number AS "confirmationNumber",
                g.full_name AS "guestName",
                r.check_in_date::text AS "checkIn",
                r.check_out_date::text AS "checkOut",
                r.beds_count AS "bedsCount",
                r.status,
                (r.check_out_date - r.check_in_date)::int AS nights
         FROM reservations r JOIN guests g ON g.id = r.guest_id
         WHERE r.check_out_date = $1::date
           AND r.status = 'confirmed'
         ORDER BY r.reservation_number ASC`,
        [today],
      ),
      query<{ occupied: number; total: number }>(
        `SELECT
           (SELECT COUNT(rb.id)::int FROM reservation_beds rb
            JOIN reservations r ON r.id = rb.reservation_id
            WHERE r.status = 'confirmed'
              AND r.check_in_date <= $1::date AND r.check_out_date > $1::date
           ) AS occupied,
           (SELECT COUNT(*)::int FROM beds) AS total`,
        [today],
      ),
    ]);

    const toBooking = (r: Record<string, any>) => ({ ...r, roomNames: [] as string[] });
    const occRow = occ.rows[0];

    res.status(200).json(
      ApiResponse.success({
        checkIns: checkIns.rows.map(toBooking),
        checkOuts: checkOuts.rows.map(toBooking),
        occupancyToday: occRow?.occupied ?? 0,
        totalBeds: occRow?.total ?? 45,
      }),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/bookings/upcoming?days=N — próximas reservas (default: 7 días)
 */
router.get('/bookings/upcoming', async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(30, parseInt((req.query.days as string) || '7', 10) || 7));
    const today = new Date().toISOString().slice(0, 10);
    const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

    const result = await query<{
      id: string;
      confirmationNumber: string;
      guestName: string;
      checkIn: string;
      checkOut: string;
      bedsCount: number;
      status: string;
      nights: number;
    }>(
      `SELECT r.id,
              r.reservation_number AS "confirmationNumber",
              g.full_name AS "guestName",
              r.check_in_date::text AS "checkIn",
              r.check_out_date::text AS "checkOut",
              r.beds_count AS "bedsCount",
              r.status,
              (r.check_out_date - r.check_in_date)::int AS nights
       FROM reservations r JOIN guests g ON g.id = r.guest_id
       WHERE r.check_in_date >= $1::date AND r.check_in_date <= $2::date
         AND r.status IN ('confirmed', 'pending_payment')
       ORDER BY r.check_in_date ASC
       LIMIT 50`,
      [today, until],
    );

    res.status(200).json(
      ApiResponse.success({
        bookings: result.rows.map((r) => ({ ...r, roomNames: [] as string[] })),
      }),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/bookings/export — descarga CSV con filtros opcionales (status, from, to)
 * Responde con Content-Disposition: attachment para que el browser descargue el archivo.
 */
router.get('/bookings/export', async (req, res, next) => {
  try {
    const { status, from, to } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [];
    if (status) {
      params.push(status);
      conditions.push(`r.status = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`r.check_in_date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      conditions.push(`r.check_in_date <= $${params.length}::date`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT
         r.reservation_number  AS "Reserva",
         g.full_name           AS "Huesped",
         g.email               AS "Email",
         g.phone               AS "Telefono",
         g.country             AS "Pais",
         r.check_in_date::text AS "Check-in",
         r.check_out_date::text AS "Check-out",
         (r.check_out_date - r.check_in_date)::int AS "Noches",
         r.beds_count          AS "Camas",
         c.code                AS "Canal",
         r.status              AS "Estado",
         r.final_price         AS "Precio total",
         r.deposit_amount      AS "Deposito",
         r.remaining_amount    AS "Saldo pendiente",
         r.special_requests    AS "Notas",
         r.created_at::text    AS "Creada"
       FROM reservations r
       JOIN guests g ON g.id = r.guest_id
       JOIN channels c ON c.id = r.channel_id
       ${where}
       ORDER BY r.check_in_date DESC, r.created_at DESC`,
      params,
    );

    const escapeCell = (v: any): string => {
      if (v == null) {
        return '';
      }
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    };

    const headers = rows.length
      ? Object.keys(rows[0]!)
      : [
          'Reserva',
          'Huesped',
          'Email',
          'Telefono',
          'Pais',
          'Check-in',
          'Check-out',
          'Noches',
          'Camas',
          'Canal',
          'Estado',
          'Precio total',
          'Deposito',
          'Saldo pendiente',
          'Notas',
          'Creada',
        ];
    const lines = [
      headers.join(','),
      ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
    ];
    // BOM UTF-8 para que Excel abra sin problemas de encoding
    const csv = '﻿' + lines.join('\n');

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reservas-${date}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /admin/bookings/:id — corrección manual (no toca fechas/habitaciones/status, ver nota arriba)
 */
router.put('/bookings/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body as Record<string, any>;

    const forbidden = ['checkIn', 'checkOut', 'check_in_date', 'check_out_date', 'rooms', 'status'];
    const attempted = forbidden.filter((f) => body[f] !== undefined);
    if (attempted.length > 0) {
      res
        .status(400)
        .json(
          ApiResponse.error(
            `No se pueden modificar estos campos desde acá (saltearía el motor anti-overbooking): ${attempted.join(', ')}. Para cambiar fechas/habitaciones: cancelar y crear una reserva nueva. Para cambiar el status: usar los endpoints dedicados (confirmar/cancelar).`,
          ),
        );
      return;
    }

    const existing = await bookingService.getBooking(id);
    if (!existing) {
      res.status(404).json(ApiResponse.error('Reserva no encontrada'));
      return;
    }

    const updateData: Record<string, any> = {};
    if (body.specialRequests !== undefined) {
      updateData.special_requests = body.specialRequests;
    }
    if (body.finalPrice !== undefined) {
      updateData.final_price = Number(body.finalPrice);
    }
    if (body.depositAmount !== undefined) {
      updateData.deposit_amount = Number(body.depositAmount);
    }
    if (body.remainingAmount !== undefined) {
      updateData.remaining_amount = Number(body.remainingAmount);
    }

    if (Object.keys(updateData).length > 0) {
      await bookingService.updateBooking(id, updateData);
    }

    if (body.guest) {
      const guestUpdate: Record<string, any> = {};
      if (body.guest.fullName) {
        guestUpdate.full_name = body.guest.fullName;
      }
      if (body.guest.phone) {
        guestUpdate.phone = body.guest.phone;
      }
      if (body.guest.country) {
        guestUpdate.country = body.guest.country;
      }
      if (Object.keys(guestUpdate).length > 0) {
        await bookingService.updateGuest(existing.guest_id, guestUpdate);
      }
    }

    await auditLogService.log({
      entity_type: 'reservation',
      entity_id: id,
      operation: 'ADMIN_UPDATE',
      reservation_id: id,
      guest_id: existing.guest_id,
      old_data: existing as unknown as Record<string, unknown>,
      new_data: { ...updateData, guest: body.guest },
    });

    const updated = await bookingService.getBooking(id);
    res.status(200).json(ApiResponse.success(updated, 'Reserva actualizada'));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /admin/bookings/:id — cancelación manual por el administrador
 */
router.delete('/bookings/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await bookingService.getBooking(id);
    if (!existing) {
      res.status(404).json(ApiResponse.error('Reserva no encontrada'));
      return;
    }
    if (existing.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('La reserva ya está cancelada'));
      return;
    }
    const cancelled = await bookingService.cancelBooking(id, 'cancelled_by_admin');
    await auditLogService.log({
      entity_type: 'reservation',
      entity_id: id,
      operation: 'ADMIN_CANCEL_BOOKING',
      reservation_id: id,
      guest_id: existing.guest_id,
      old_data: { status: existing.status },
      new_data: { status: 'cancelled', reason: 'cancelled_by_admin' },
    });
    res.status(200).json(ApiResponse.success(cancelled, 'Reserva cancelada'));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/bookings/:id/resend-confirmation
 */
router.post('/bookings/:id/resend-confirmation', async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await bookingService.getBooking(id);
    if (!booking || !booking.guest) {
      res.status(404).json(ApiResponse.error('Reserva o huésped no encontrado'));
      return;
    }
    await notificationService.notify('booking_confirmation', booking as BookingWithGuest);
    res.status(200).json(ApiResponse.success({ sent: true }, 'Confirmación reenviada'));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/bookings/:id/confirm — override manual, confirma sin depender de un pago
 */
router.post('/bookings/:id/confirm', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await bookingService.getBooking(id);
    if (!existing) {
      res.status(404).json(ApiResponse.error('Reserva no encontrada'));
      return;
    }
    const updated = await bookingService.confirmBooking(id);
    await auditLogService.log({
      entity_type: 'reservation',
      entity_id: id,
      operation: 'ADMIN_FORCE_CONFIRM',
      reservation_id: id,
      guest_id: existing.guest_id,
      old_data: { status: existing.status },
      new_data: { status: 'confirmed' },
    });
    res.status(200).json(ApiResponse.success(updated, 'Reserva confirmada'));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /admin/rooms/:id/settings — precio base y flag de flexible. El
 * descuento por grupo dejó de ser por cuarto (ver 0010_global_group_discount_tiers.sql,
 * PUT /admin/group-discounts más abajo) porque depende del total de
 * camas de toda la reserva, no de un cuarto individual.
 */
const RoomSettingsSchema = z
  .object({
    basePrice: z.number().positive().optional(),
    isFlexible: z.boolean().optional(),
  })
  .refine((v) => v.basePrice !== undefined || v.isFlexible !== undefined, {
    message: 'Nada para actualizar: basePrice y/o isFlexible',
  });

router.put('/rooms/:id/settings', validate(RoomSettingsSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { basePrice, isFlexible } = req.body as z.infer<typeof RoomSettingsSchema>;

    const sets: string[] = [];
    const params: any[] = [];
    if (basePrice !== undefined) {
      params.push(basePrice);
      sets.push(`base_price = $${params.length}`);
    }
    if (isFlexible !== undefined) {
      params.push(isFlexible);
      sets.push(`is_flexible = $${params.length}`);
    }
    params.push(id);

    const { rows } = await query(
      `UPDATE room_types SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('Habitación no encontrada'));
      return;
    }

    await auditLogService.log({
      entity_type: 'room_type',
      entity_id: id,
      operation: 'ADMIN_UPDATE_SETTINGS',
      new_data: { basePrice, isFlexible },
    });

    res.status(200).json(ApiResponse.success(rows[0], 'Habitación actualizada'));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/pricing — estado actual de rate_plans, para poblar el formulario del panel
 */
router.get('/pricing', async (req, res, next) => {
  try {
    const [ratePlans, groupDiscountTiers, cardSurcharge, luggageStorage, checkinTimes, maxAptGuests] =
      await Promise.all([
        query(
          `SELECT season_type, multiplier, min_nights, description FROM rate_plans ORDER BY season_type`,
        ),
        query(`SELECT id, min_beds, percentage FROM group_discount_tiers ORDER BY min_beds`),
        query<{ value: any }>(
          `SELECT value FROM system_config WHERE key = 'card_surcharge_percent'`,
        ),
        query<{ value: any }>(`SELECT value FROM system_config WHERE key = 'luggage_storage'`),
        query<{ value: any }>(`SELECT value FROM system_config WHERE key = 'checkin_times'`),
        query<{ value: any }>(`SELECT value FROM system_config WHERE key = 'max_apt_guests'`),
      ]);
    res.status(200).json(
      ApiResponse.success({
        ratePlans: ratePlans.rows,
        groupDiscountTiers: groupDiscountTiers.rows,
        cardSurchargePercent: cardSurcharge.rows[0]?.value ?? 10,
        luggageStorage: luggageStorage.rows[0]?.value ?? {
          price: 30,
          currency: 'BRL',
          days: 'Todos los días',
          start_time: '08:00',
          end_time: '22:00',
        },
        checkinTimes: checkinTimes.rows[0]?.value ?? ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'],
        maxAptGuests: maxAptGuests.rows[0]?.value ?? 2,
      }),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /admin/pricing — rate_plans (multiplicador/mín. noches por temporada)
 */
const PricingUpdateSchema = z.object({
  seasonType: z.enum(['alta', 'media', 'baja']).optional(),
  multiplier: z.number().positive().optional(),
  minNights: z.number().int().positive().optional(),
  cardSurchargePercent: z.number().min(0).max(100).optional(),
  // Guarda-equipaje (Malas/Guardavolumes): precio de la diaria (BRL), días en que se ofrece y franja horaria HH:MM.
  luggageStorage: z
    .object({
      price: z.number().min(0),
      days: z.string().trim().min(1),
      startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato esperado HH:MM'),
      endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato esperado HH:MM'),
    })
    .optional(),
  checkinTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/, 'Formato esperado HH:MM')).min(1).optional(),
  maxAptGuests: z.number().int().min(1).max(20).optional(),
});

router.put('/pricing', validate(PricingUpdateSchema), async (req, res, next) => {
  try {
    const { seasonType, multiplier, minNights, cardSurchargePercent, luggageStorage, checkinTimes, maxAptGuests } =
      req.body as z.infer<typeof PricingUpdateSchema>;

    const updated: Record<string, any> = {};

    if (seasonType && (multiplier !== undefined || minNights !== undefined)) {
      const sets: string[] = [];
      const params: any[] = [];
      if (multiplier !== undefined) {
        params.push(multiplier);
        sets.push(`multiplier = $${params.length}`);
      }
      if (minNights !== undefined) {
        params.push(minNights);
        sets.push(`min_nights = $${params.length}`);
      }
      params.push(seasonType);
      const { rows } = await query(
        `UPDATE rate_plans SET ${sets.join(', ')}, updated_at = now() WHERE season_type = $${params.length}::season_type RETURNING *`,
        params,
      );
      if (rows.length === 0) {
        res.status(404).json(ApiResponse.error(`Temporada "${seasonType}" no encontrada`));
        return;
      }
      updated.ratePlan = rows[0];
    }

    if (cardSurchargePercent !== undefined) {
      const { rows } = await query(
        `UPDATE system_config SET value = $1::jsonb, updated_at = now() WHERE key = 'card_surcharge_percent' RETURNING *`,
        [JSON.stringify(cardSurchargePercent)],
      );
      updated.cardSurchargePercent = rows[0];
    }

    if (luggageStorage) {
      const { rows: existingRows } = await query<{ value: { currency?: string } }>(
        `SELECT value FROM system_config WHERE key = 'luggage_storage'`,
      );
      const currency = existingRows[0]?.value?.currency ?? 'BRL';
      const nextValue = {
        price: luggageStorage.price,
        currency,
        days: luggageStorage.days,
        start_time: luggageStorage.startTime,
        end_time: luggageStorage.endTime,
      };
      const { rows } = await query(
        `UPDATE system_config SET value = $1::jsonb, updated_at = now() WHERE key = 'luggage_storage' RETURNING *`,
        [JSON.stringify(nextValue)],
      );
      updated.luggageStorage = rows[0];
    }

    if (checkinTimes) {
      const { rows } = await query(
        `UPDATE system_config SET value = $1::jsonb, updated_at = now() WHERE key = 'checkin_times' RETURNING *`,
        [JSON.stringify(checkinTimes)],
      );
      updated.checkinTimes = rows[0];
    }

    if (maxAptGuests !== undefined) {
      const { rows } = await query(
        `UPDATE system_config SET value = $1::jsonb, updated_at = now() WHERE key = 'max_apt_guests' RETURNING *`,
        [JSON.stringify(maxAptGuests)],
      );
      updated.maxAptGuests = rows[0];
    }

    if (Object.keys(updated).length === 0) {
      res
        .status(400)
        .json(
          ApiResponse.error(
            'Nada para actualizar: seasonType+multiplier/minNights, carnival, cardSurchargePercent, luggageStorage, checkinTimes, o maxAptGuests',
          ),
        );
      return;
    }

    await auditLogService.log({
      entity_type: 'pricing_config',
      entity_id: 'global',
      operation: 'ADMIN_UPDATE_PRICING',
      new_data: updated,
    });

    res.status(200).json(ApiResponse.success(updated, 'Precios actualizados'));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /admin/group-discount-tiers/:id — edita un tramo existente
 * (a partir de cuantas camas, y que porcentaje). Ver 0010_global_group_discount_tiers.sql:
 * el descuento se evalua sobre el total de camas de TODA la reserva, no
 * por cuarto -- por eso es un ajuste global, no algo de room_types.
 */
const GroupDiscountTierSchema = z
  .object({
    minBeds: z.number().int().positive().optional(),
    percentage: z.number().min(0).max(100).optional(),
  })
  .refine((v) => v.minBeds !== undefined || v.percentage !== undefined, {
    message: 'Nada para actualizar: minBeds y/o percentage',
  });

router.put(
  '/group-discount-tiers/:id',
  validate(GroupDiscountTierSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { minBeds, percentage } = req.body as z.infer<typeof GroupDiscountTierSchema>;

      const sets: string[] = [];
      const params: any[] = [];
      if (minBeds !== undefined) {
        params.push(minBeds);
        sets.push(`min_beds = $${params.length}`);
      }
      if (percentage !== undefined) {
        params.push(percentage);
        sets.push(`percentage = $${params.length}`);
      }
      params.push(id);

      const { rows } = await query(
        `UPDATE group_discount_tiers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
        params,
      );
      if (rows.length === 0) {
        res.status(404).json(ApiResponse.error('Tramo de descuento no encontrado'));
        return;
      }

      await auditLogService.log({
        entity_type: 'group_discount_tier',
        entity_id: id,
        operation: 'ADMIN_UPDATE_SETTINGS',
        new_data: { minBeds, percentage },
      });

      res.status(200).json(ApiResponse.success(rows[0], 'Tramo de descuento actualizado'));
    } catch (error) {
      next(error);
    }
  },
);

// ─── Ofertas / Descuentos ────────────────────────────────────────────────────

/**
 * GET /admin/offers — lista todas las ofertas
 */
router.get('/offers', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, code, label, discount_percent, apartment_ids,
              valid_from::text, valid_to::text, is_active, created_at, updated_at
       FROM apartment_offers
       ORDER BY created_at DESC`,
    );
    res.status(200).json(ApiResponse.success(rows));
  } catch (error) {
    next(error);
  }
});

const CreateOfferSchema = z.object({
  code: z.string().trim().min(1),
  label: z.string().trim().min(1),
  discountPercent: z.number().gt(0).max(100),
  apartmentIds: z.array(z.string()).nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const UpdateOfferSchema = z.object({
  label: z.string().trim().min(1).optional(),
  discountPercent: z.number().gt(0).max(100).optional(),
  apartmentIds: z.array(z.string()).nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * POST /admin/offers — crea una oferta
 */
router.post('/offers', validate(CreateOfferSchema), async (req, res, next) => {
  try {
    const { code, label, discountPercent, apartmentIds, validFrom, validTo, isActive } =
      req.body as z.infer<typeof CreateOfferSchema>;

    const { rows } = await query(
      `INSERT INTO apartment_offers (code, label, discount_percent, apartment_ids, valid_from, valid_to, is_active)
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7)
       RETURNING id, code, label, discount_percent, apartment_ids, valid_from::text, valid_to::text, is_active, created_at`,
      [
        code.trim(),
        label.trim(),
        discountPercent,
        apartmentIds?.length ? apartmentIds : null,
        validFrom ?? null,
        validTo ?? null,
        isActive ?? true,
      ],
    );

    await auditLogService.log({
      entity_type: 'apartment_offer',
      entity_id: rows[0].id,
      operation: 'ADMIN_CREATE_OFFER',
      new_data: rows[0],
    });

    res.status(201).json(ApiResponse.success(rows[0], 'Oferta creada'));
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(409).json(ApiResponse.error(`El código "${req.body.code}" ya existe`));
      return;
    }
    next(error);
  }
});

/**
 * PUT /admin/offers/:id — edita una oferta existente
 */
router.put('/offers/:id', validate(UpdateOfferSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { label, discountPercent, apartmentIds, validFrom, validTo, isActive } =
      req.body as z.infer<typeof UpdateOfferSchema>;

    const sets: string[] = [];
    const params: any[] = [];

    if (label !== undefined) {
      params.push(label.trim());
      sets.push(`label = $${params.length}`);
    }
    if (discountPercent !== undefined) {
      params.push(discountPercent);
      sets.push(`discount_percent = $${params.length}`);
    }
    if (apartmentIds !== undefined) {
      params.push(apartmentIds?.length ? apartmentIds : null);
      sets.push(`apartment_ids = $${params.length}`);
    }
    if (validFrom !== undefined) {
      params.push(validFrom ?? null);
      sets.push(`valid_from = $${params.length}::date`);
    }
    if (validTo !== undefined) {
      params.push(validTo ?? null);
      sets.push(`valid_to = $${params.length}::date`);
    }
    if (isActive !== undefined) {
      params.push(isActive);
      sets.push(`is_active = $${params.length}`);
    }

    if (sets.length === 0) {
      res.status(400).json(ApiResponse.error('Nada para actualizar'));
      return;
    }

    params.push(id);
    const { rows } = await query(
      `UPDATE apartment_offers SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${params.length}
       RETURNING id, code, label, discount_percent, apartment_ids, valid_from::text, valid_to::text, is_active, updated_at`,
      params,
    );

    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('Oferta no encontrada'));
      return;
    }

    await auditLogService.log({
      entity_type: 'apartment_offer',
      entity_id: id,
      operation: 'ADMIN_UPDATE_OFFER',
      new_data: rows[0],
    });

    res.status(200).json(ApiResponse.success(rows[0], 'Oferta actualizada'));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /admin/offers/:id — elimina una oferta
 */
router.delete('/offers/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`DELETE FROM apartment_offers WHERE id = $1 RETURNING id, code`, [
      id,
    ]);
    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('Oferta no encontrada'));
      return;
    }
    await auditLogService.log({
      entity_type: 'apartment_offer',
      entity_id: id,
      operation: 'ADMIN_DELETE_OFFER',
      old_data: rows[0],
    });
    res.status(200).json(ApiResponse.success({ deleted: rows[0] }, 'Oferta eliminada'));
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/audit-logs
 */
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { entityType, operation, from, to, page, limit } = req.query as Record<string, string>;
    const result = await auditLogService.listAll({
      entityType,
      operation,
      dateFrom: from,
      dateTo: to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(ApiResponse.success(result));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/stats/occupancy?month=&year=
 */
router.get('/stats/occupancy', async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);
    const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
    const stats = await statsService.getOccupancyStats(month, year);
    res.status(200).json(ApiResponse.success(stats));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/stats/revenue?month=&year=
 */
router.get('/stats/revenue', async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);
    const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
    const stats = await statsService.getRevenueStats(month, year);
    res.status(200).json(ApiResponse.success(stats));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/stats/channels?month=&year=
 */
router.get('/stats/channels', async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);
    const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
    const stats = await statsService.getChannelStats(month, year);
    res.status(200).json(ApiResponse.success(stats));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/stats/groups?month=&year=
 */
router.get('/stats/groups', async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);
    const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
    const stats = await statsService.getGroupStats(month, year);
    res.status(200).json(ApiResponse.success(stats));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/sync/sheets — export manual completo a Google Sheets
 */
router.post('/sync/sheets', async (req, res, next) => {
  try {
    const result = await fullExport();
    res
      .status(200)
      .json(
        ApiResponse.success(
          result,
          result.errors.length === 0 ? 'Sync completado' : 'Sync completado con errores',
        ),
      );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/health
 */
router.get('/health', async (req, res, next) => {
  try {
    const { testConnection } = await import('../../config/database');
    const dbOk = await testConnection();
    res.status(200).json(
      ApiResponse.success({
        status: dbOk ? 'healthy' : 'degraded',
        uptime: process.uptime(),
        database: dbOk ? 'connected' : 'disconnected',
      }),
    );
  } catch (error) {
    next(error);
  }
});

export const adminRouter = router;

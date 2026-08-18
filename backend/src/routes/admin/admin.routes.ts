// lapa-casa-hostel/backend/src/routes/admin/admin.routes.ts
// ventana4 (bloque 2)
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
import type { BookingWithGuest } from '../../services/email-service';

const router = Router();

/**
 * /admin/conflicts — detalle + resolucion manual agregados en Ventana 5
 * (conflict-service.ts). Reemplaza el listado inline que vivia aca desde
 * Ventana 4 (ver mas abajo, ahora removido para no duplicar la ruta).
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
 * GET /admin/dashboard — KPIs del mes actual
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [bookingStats, occupancy, revenue, channels, groups, upcoming] = await Promise.all([
      bookingService.getBookingStats(
        `${year}-${String(month).padStart(2, '0')}-01`,
        new Date(year, month, 0).toISOString().slice(0, 10)
      ),
      statsService.getOccupancyStats(month, year),
      statsService.getRevenueStats(month, year),
      statsService.getChannelStats(month, year),
      statsService.getGroupStats(month, year),
      query<{ id: string; reservation_number: string; check_in_date: string; guest_name: string; beds_count: number }>(
        `SELECT r.id, r.reservation_number, r.check_in_date::text, g.full_name AS guest_name, r.beds_count
         FROM reservations r JOIN guests g ON g.id = r.guest_id
         WHERE r.status = 'confirmed' AND r.check_in_date >= CURRENT_DATE
         ORDER BY r.check_in_date ASC LIMIT 10`
      )
    ]);

    res.status(200).json(
      ApiResponse.success({
        period: { month, year },
        bookings: bookingStats,
        occupancy: { averagePercent: occupancy.averageOccupancyPercent, byRoom: occupancy.byRoom },
        revenue,
        channels,
        groups,
        upcomingCheckIns: upcoming.rows
      }, 'Dashboard data retrieved')
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
    if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }
    if (from) { params.push(from); conditions.push(`r.check_in_date >= $${params.length}::date`); }
    if (to) { params.push(to); conditions.push(`r.check_in_date <= $${params.length}::date`); }
    if (channel) { params.push(channel); conditions.push(`c.code = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));

    const [dataResult, countResult] = await Promise.all([
      query(
        `SELECT r.id, r.reservation_number, r.status, r.check_in_date, r.check_out_date,
                r.beds_count, r.final_price, r.deposit_amount, r.remaining_amount,
                g.full_name AS guest_name, g.email AS guest_email,
                c.code AS channel_code, r.created_at
         FROM reservations r
         JOIN guests g ON g.id = r.guest_id
         JOIN channels c ON c.id = r.channel_id
         ${where}
         ORDER BY r.created_at DESC
         LIMIT ${limitNum} OFFSET ${(pageNum - 1) * limitNum}`,
        params
      ),
      query(`SELECT COUNT(*)::int AS total FROM reservations r JOIN channels c ON c.id = r.channel_id ${where}`, params)
    ]);

    res.status(200).json(
      ApiResponse.success({
        bookings: dataResult.rows,
        pagination: { page: pageNum, limit: limitNum, total: countResult.rows[0].total }
      })
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
        id: string; confirmationNumber: string; guestName: string;
        checkIn: string; checkOut: string; bedsCount: number; status: string; nights: number;
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
           AND r.status IN ('confirmed', 'pending', 'checked-in')
         ORDER BY r.reservation_number ASC`,
        [today]
      ),
      query<{
        id: string; confirmationNumber: string; guestName: string;
        checkIn: string; checkOut: string; bedsCount: number; status: string; nights: number;
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
           AND r.status IN ('confirmed', 'checked-in', 'checked-out')
         ORDER BY r.reservation_number ASC`,
        [today]
      ),
      query<{ occupied: number; total: number }>(
        `SELECT
           (SELECT COUNT(rb.id)::int FROM reservation_beds rb
            JOIN reservations r ON r.id = rb.reservation_id
            WHERE r.status IN ('confirmed', 'checked-in')
              AND r.check_in_date <= $1::date AND r.check_out_date > $1::date
           ) AS occupied,
           (SELECT COUNT(*)::int FROM beds) AS total`,
        [today]
      )
    ]);

    const toBooking = (r: Record<string, any>) => ({ ...r, roomNames: [] as string[] });
    const occRow = occ.rows[0];

    res.status(200).json(ApiResponse.success({
      checkIns: checkIns.rows.map(toBooking),
      checkOuts: checkOuts.rows.map(toBooking),
      occupancyToday: occRow?.occupied ?? 0,
      totalBeds: occRow?.total ?? 45,
    }));
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
      id: string; confirmationNumber: string; guestName: string;
      checkIn: string; checkOut: string; bedsCount: number; status: string; nights: number;
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
         AND r.status IN ('confirmed', 'pending')
       ORDER BY r.check_in_date ASC
       LIMIT 50`,
      [today, until]
    );

    res.status(200).json(ApiResponse.success({
      bookings: result.rows.map((r) => ({ ...r, roomNames: [] as string[] })),
    }));
  } catch (error) {
    next(error);
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
    const attempted = forbidden.filter(f => body[f] !== undefined);
    if (attempted.length > 0) {
      res.status(400).json(
        ApiResponse.error(
          `No se pueden modificar estos campos desde acá (saltearía el motor anti-overbooking): ${attempted.join(', ')}. Para cambiar fechas/habitaciones: cancelar y crear una reserva nueva. Para cambiar el status: usar los endpoints dedicados (confirmar/cancelar).`
        )
      );
      return;
    }

    const existing = await bookingService.getBooking(id);
    if (!existing) {
      res.status(404).json(ApiResponse.error('Reserva no encontrada'));
      return;
    }

    const updateData: Record<string, any> = {};
    if (body.specialRequests !== undefined) updateData.special_requests = body.specialRequests;
    if (body.finalPrice !== undefined) updateData.final_price = Number(body.finalPrice);
    if (body.depositAmount !== undefined) updateData.deposit_amount = Number(body.depositAmount);
    if (body.remainingAmount !== undefined) updateData.remaining_amount = Number(body.remainingAmount);

    if (Object.keys(updateData).length > 0) {
      await bookingService.updateBooking(id, updateData);
    }

    if (body.guest) {
      const guestUpdate: Record<string, any> = {};
      if (body.guest.fullName) guestUpdate.full_name = body.guest.fullName;
      if (body.guest.phone) guestUpdate.phone = body.guest.phone;
      if (body.guest.country) guestUpdate.country = body.guest.country;
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
      new_data: { ...updateData, guest: body.guest }
    });

    const updated = await bookingService.getBooking(id);
    res.status(200).json(ApiResponse.success(updated, 'Reserva actualizada'));
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
      entity_type: 'reservation', entity_id: id, operation: 'ADMIN_FORCE_CONFIRM',
      reservation_id: id, guest_id: existing.guest_id,
      old_data: { status: existing.status }, new_data: { status: 'confirmed' }
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
router.put('/rooms/:id/settings', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { basePrice, isFlexible } = req.body as {
      basePrice?: number;
      isFlexible?: boolean;
    };

    if (basePrice === undefined && isFlexible === undefined) {
      res.status(400).json(ApiResponse.error('Nada para actualizar: basePrice y/o isFlexible'));
      return;
    }

    const sets: string[] = [];
    const params: any[] = [];
    if (basePrice !== undefined) { params.push(basePrice); sets.push(`base_price = $${params.length}`); }
    if (isFlexible !== undefined) { params.push(isFlexible); sets.push(`is_flexible = $${params.length}`); }
    params.push(id);

    const { rows } = await query(
      `UPDATE room_types SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('Habitación no encontrada'));
      return;
    }

    await auditLogService.log({
      entity_type: 'room_type', entity_id: id, operation: 'ADMIN_UPDATE_SETTINGS',
      new_data: { basePrice, isFlexible }
    });

    res.status(200).json(ApiResponse.success(rows[0], 'Habitación actualizada'));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/pricing — estado actual de rate_plans + fechas de Carnaval, para poblar el formulario del panel
 */
router.get('/pricing', async (req, res, next) => {
  try {
    const [ratePlans, carnivalConfig, groupDiscountTiers, cardSurcharge] = await Promise.all([
      query(`SELECT season_type, multiplier, min_nights, description FROM rate_plans ORDER BY season_type`),
      query<{ value: any }>(`SELECT value FROM system_config WHERE key = 'carnival_dates'`),
      query(`SELECT id, min_beds, percentage FROM group_discount_tiers ORDER BY min_beds`),
      query<{ value: any }>(`SELECT value FROM system_config WHERE key = 'card_surcharge_percent'`)
    ]);
    res.status(200).json(
      ApiResponse.success({
        ratePlans: ratePlans.rows,
        carnivalDates: carnivalConfig.rows[0]?.value ?? [],
        groupDiscountTiers: groupDiscountTiers.rows,
        cardSurchargePercent: cardSurcharge.rows[0]?.value ?? 10
      })
    );
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /admin/pricing — rate_plans (multiplicador/mín. noches por temporada) + fechas de Carnaval
 */
router.put('/pricing', async (req, res, next) => {
  try {
    const { seasonType, multiplier, minNights, carnival, cardSurchargePercent } = req.body as {
      seasonType?: 'alta' | 'media' | 'baja' | 'carnaval';
      multiplier?: number;
      minNights?: number;
      // ventana4: system_config.carnival_dates es un ARRAY de rangos
      // {year, start_date, end_date} (ver 0001_seed.sql y
      // get_season_type() en 0004_pricing_functions.sql, que itera el
      // array buscando en qué rango cae la fecha) -- no un mapa por año.
      carnival?: { year: number; startDate: string; endDate: string };
      cardSurchargePercent?: number;
    };

    const updated: Record<string, any> = {};

    if (seasonType && (multiplier !== undefined || minNights !== undefined)) {
      const sets: string[] = [];
      const params: any[] = [];
      if (multiplier !== undefined) { params.push(multiplier); sets.push(`multiplier = $${params.length}`); }
      if (minNights !== undefined) { params.push(minNights); sets.push(`min_nights = $${params.length}`); }
      params.push(seasonType);
      const { rows } = await query(
        `UPDATE rate_plans SET ${sets.join(', ')}, updated_at = now() WHERE season_type = $${params.length}::season_type RETURNING *`,
        params
      );
      if (rows.length === 0) {
        res.status(404).json(ApiResponse.error(`Temporada "${seasonType}" no encontrada`));
        return;
      }
      updated.ratePlan = rows[0];
    }

    if (carnival) {
      const { rows: existingRows } = await query<{ value: Array<{ year: number; start_date: string; end_date: string }> }>(
        `SELECT value FROM system_config WHERE key = 'carnival_dates'`
      );
      const currentValue = existingRows[0]?.value ?? [];
      // Reemplaza el rango existente de ese año (si lo había) en vez de acumular duplicados -- "mantenimiento anual" del Maestro.
      const nextValue = [
        ...currentValue.filter(p => p.year !== carnival.year),
        { year: carnival.year, start_date: carnival.startDate, end_date: carnival.endDate }
      ].sort((a, b) => a.year - b.year);

      const { rows } = await query(
        `UPDATE system_config SET value = $1::jsonb, updated_at = now() WHERE key = 'carnival_dates' RETURNING *`,
        [JSON.stringify(nextValue)]
      );
      updated.carnivalDates = rows[0];
    }

    if (cardSurchargePercent !== undefined) {
      if (cardSurchargePercent < 0 || cardSurchargePercent > 100) {
        res.status(400).json(ApiResponse.error('cardSurchargePercent debe estar entre 0 y 100'));
        return;
      }
      const { rows } = await query(
        `UPDATE system_config SET value = $1::jsonb, updated_at = now() WHERE key = 'card_surcharge_percent' RETURNING *`,
        [JSON.stringify(cardSurchargePercent)]
      );
      updated.cardSurchargePercent = rows[0];
    }

    if (Object.keys(updated).length === 0) {
      res.status(400).json(ApiResponse.error('Nada para actualizar: seasonType+multiplier/minNights, carnival, o cardSurchargePercent'));
      return;
    }

    await auditLogService.log({ entity_type: 'pricing_config', entity_id: 'global', operation: 'ADMIN_UPDATE_PRICING', new_data: updated });

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
router.put('/group-discount-tiers/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { minBeds, percentage } = req.body as { minBeds?: number; percentage?: number };

    if (minBeds === undefined && percentage === undefined) {
      res.status(400).json(ApiResponse.error('Nada para actualizar: minBeds y/o percentage'));
      return;
    }

    const sets: string[] = [];
    const params: any[] = [];
    if (minBeds !== undefined) { params.push(minBeds); sets.push(`min_beds = $${params.length}`); }
    if (percentage !== undefined) { params.push(percentage); sets.push(`percentage = $${params.length}`); }
    params.push(id);

    const { rows } = await query(
      `UPDATE group_discount_tiers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('Tramo de descuento no encontrado'));
      return;
    }

    await auditLogService.log({
      entity_type: 'group_discount_tier', entity_id: id, operation: 'ADMIN_UPDATE_SETTINGS',
      new_data: { minBeds, percentage }
    });

    res.status(200).json(ApiResponse.success(rows[0], 'Tramo de descuento actualizado'));
  } catch (error) {
    next(error);
  }
});

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
       ORDER BY created_at DESC`
    );
    res.status(200).json(ApiResponse.success(rows));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/offers — crea una oferta
 */
router.post('/offers', async (req, res, next) => {
  try {
    const { code, label, discountPercent, apartmentIds, validFrom, validTo, isActive } = req.body as {
      code: string;
      label: string;
      discountPercent: number;
      apartmentIds?: string[] | null;
      validFrom?: string | null;
      validTo?: string | null;
      isActive?: boolean;
    };

    if (!code || !label || discountPercent === undefined) {
      res.status(400).json(ApiResponse.error('Campos requeridos: code, label, discountPercent'));
      return;
    }
    if (discountPercent <= 0 || discountPercent > 100) {
      res.status(400).json(ApiResponse.error('discountPercent debe estar entre 1 y 100'));
      return;
    }

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
      ]
    );

    await auditLogService.log({
      entity_type: 'apartment_offer', entity_id: rows[0].id, operation: 'ADMIN_CREATE_OFFER',
      new_data: rows[0]
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
router.put('/offers/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { label, discountPercent, apartmentIds, validFrom, validTo, isActive } = req.body as {
      label?: string;
      discountPercent?: number;
      apartmentIds?: string[] | null;
      validFrom?: string | null;
      validTo?: string | null;
      isActive?: boolean;
    };

    if (discountPercent !== undefined && (discountPercent <= 0 || discountPercent > 100)) {
      res.status(400).json(ApiResponse.error('discountPercent debe estar entre 1 y 100'));
      return;
    }

    const sets: string[] = [];
    const params: any[] = [];

    if (label !== undefined) { params.push(label.trim()); sets.push(`label = $${params.length}`); }
    if (discountPercent !== undefined) { params.push(discountPercent); sets.push(`discount_percent = $${params.length}`); }
    if (apartmentIds !== undefined) {
      params.push(apartmentIds?.length ? apartmentIds : null);
      sets.push(`apartment_ids = $${params.length}`);
    }
    if (validFrom !== undefined) { params.push(validFrom ?? null); sets.push(`valid_from = $${params.length}::date`); }
    if (validTo !== undefined) { params.push(validTo ?? null); sets.push(`valid_to = $${params.length}::date`); }
    if (isActive !== undefined) { params.push(isActive); sets.push(`is_active = $${params.length}`); }

    if (sets.length === 0) {
      res.status(400).json(ApiResponse.error('Nada para actualizar'));
      return;
    }

    params.push(id);
    const { rows } = await query(
      `UPDATE apartment_offers SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${params.length}
       RETURNING id, code, label, discount_percent, apartment_ids, valid_from::text, valid_to::text, is_active, updated_at`,
      params
    );

    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('Oferta no encontrada'));
      return;
    }

    await auditLogService.log({
      entity_type: 'apartment_offer', entity_id: id, operation: 'ADMIN_UPDATE_OFFER',
      new_data: rows[0]
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
    const { rows } = await query(
      `DELETE FROM apartment_offers WHERE id = $1 RETURNING id, code`,
      [id]
    );
    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('Oferta no encontrada'));
      return;
    }
    await auditLogService.log({
      entity_type: 'apartment_offer', entity_id: id, operation: 'ADMIN_DELETE_OFFER',
      old_data: rows[0]
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
      entityType, operation, dateFrom: from, dateTo: to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined
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
    res.status(200).json(ApiResponse.success(result, result.errors.length === 0 ? 'Sync completado' : 'Sync completado con errores'));
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
        database: dbOk ? 'connected' : 'disconnected'
      })
    );
  } catch (error) {
    next(error);
  }
});

export const adminRouter = router;

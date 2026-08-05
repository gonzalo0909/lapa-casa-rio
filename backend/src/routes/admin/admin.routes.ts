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
import type { BookingWithGuest } from '../../services/email-service';

const router = Router();

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
 * PUT /admin/rooms/:id/settings — precio base y flag de flexible
 */
router.put('/rooms/:id/settings', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { basePrice, isFlexible } = req.body as { basePrice?: number; isFlexible?: boolean };

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
    const [ratePlans, carnivalConfig] = await Promise.all([
      query(`SELECT season_type, multiplier, min_nights, description FROM rate_plans ORDER BY season_type`),
      query<{ value: any }>(`SELECT value FROM system_config WHERE key = 'carnival_dates'`)
    ]);
    res.status(200).json(
      ApiResponse.success({
        ratePlans: ratePlans.rows,
        carnivalDates: carnivalConfig.rows[0]?.value ?? []
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
    const { seasonType, multiplier, minNights, carnival } = req.body as {
      seasonType?: 'alta' | 'media' | 'baja' | 'carnaval';
      multiplier?: number;
      minNights?: number;
      // ventana4: system_config.carnival_dates es un ARRAY de rangos
      // {year, start_date, end_date} (ver 0001_seed.sql y
      // get_season_type() en 0004_pricing_functions.sql, que itera el
      // array buscando en qué rango cae la fecha) -- no un mapa por año.
      carnival?: { year: number; startDate: string; endDate: string };
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

    if (Object.keys(updated).length === 0) {
      res.status(400).json(ApiResponse.error('Nada para actualizar: seasonType+multiplier/minNights, o carnival'));
      return;
    }

    await auditLogService.log({ entity_type: 'pricing_config', entity_id: 'global', operation: 'ADMIN_UPDATE_PRICING', new_data: updated });

    res.status(200).json(ApiResponse.success(updated, 'Precios actualizados'));
  } catch (error) {
    next(error);
  }
});

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
 * GET /admin/conflicts — conflictos de overbooking entre canales (detalle completo: Ventana 5)
 */
router.get('/conflicts', async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    const params: any[] = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE bc.status = $1::conflict_status`; }

    const { rows } = await query(
      `SELECT bc.id, bc.reservation_id_a, bc.reservation_id_b, bc.bed_id,
              bc.channel_a, bc.channel_b, bc.status, bc.detected_at, bc.resolved_at, bc.resolution_notes
       FROM booking_conflicts bc
       ${where}
       ORDER BY bc.detected_at DESC
       LIMIT 100`,
      params
    );
    res.status(200).json(ApiResponse.success({ conflicts: rows }));
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

// lapa-casa-hostel/backend/src/services/stats-service.ts
// ventana4 (bloque 2)
//
// Estadísticas para el dashboard/panel admin. El prompt de esta ventana
// dice "las estadísticas usan availability_cache (tabla real) para
// consultas rápidas" -- se verificó que availability_cache
// (0002_tables.sql) no la puebla nada en todo el repo (ni un cron, ni
// una función SQL, ni un trigger): leer de ahí devolvería siempre cero.
// Se calcula en cambio directo sobre reservation_beds/reservations,
// igual que ya hace BookingRepository.getOccupancyRate() (probado,
// Ventana 2/3) -- no se reimplementa nada que ya sea de la fuente real,
// solo se evita depender de una tabla que nunca se llena.
//
// Por lo mismo, el ingreso neto por canal usa la función SQL
// calculate_channel_net_revenue() (0004_pricing_functions.sql) en vez
// de reimplementar el descuento de comisión en JS (REQUISITO CRÍTICO #6).

import { query } from '../config/database';

const TOTAL_BEDS = 45;

function monthRange(month: number, year: number): { start: string; end: string; days: number } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1)); // primer día del mes siguiente, exclusivo
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), days };
}

export interface OccupancyByDay {
  date: string;
  occupiedBeds: number;
  totalBeds: number;
  occupancyPercent: number;
}

export interface OccupancyByRoom {
  roomTypeId: string;
  code: string;
  name: string;
  capacity: number;
  occupiedBedNights: number;
  capacityBedNights: number;
  occupancyPercent: number;
}

export interface OccupancyStats {
  period: { month: number; year: number };
  averageOccupancyPercent: number;
  byDay: OccupancyByDay[];
  byRoom: OccupancyByRoom[];
}

export interface ChannelRevenue {
  channelCode: string;
  channelName: string;
  bookings: number;
  grossRevenue: number;
  netRevenue: number;
}

export interface RevenueStats {
  period: { month: number; year: number };
  totalGrossRevenue: number;
  totalNetRevenue: number;
  byChannel: ChannelRevenue[];
}

export interface ChannelBookingCount {
  channelCode: string;
  channelName: string;
  bookings: number;
  percent: number;
}

export interface GroupStats {
  period: { month: number; year: number };
  totalBookings: number;
  averageGroupSize: number;
  largeGroups: number;
  largeGroupPercent: number;
}

export class StatsService {
  async getOccupancyStats(month: number, year: number): Promise<OccupancyStats> {
    const { start, end, days } = monthRange(month, year);

    const [byDayResult, byRoomResult] = await Promise.all([
      query<{ date: string; occupied_beds: string }>(
        `SELECT gs::date::text AS date,
                (SELECT COUNT(*) FROM reservation_beds rb
                   WHERE rb.check_in <= gs::date AND rb.check_out > gs::date) AS occupied_beds
         FROM generate_series($1::date, $2::date - interval '1 day', interval '1 day') gs
         ORDER BY date`,
        [start, end]
      ),
      query<{ id: string; code: string; name: string; capacity: number; occupied_bed_nights: string }>(
        // ventana4: OJO -- LEAST/GREATEST de Postgres ignoran NULL en vez de
        // propagarlo (a diferencia de los operadores de comparacion
        // estandar). Sin el CASE WHEN, una cama sin ninguna reserva (rb.*
        // todo NULL por el LEFT JOIN) calculaba LEAST(NULL,end)=end y
        // GREATEST(NULL,start)=start, dando "ocupada el periodo completo"
        // en vez de 0 -- inflaba la ocupacion real a mas de 80% con datos
        // de prueba minimos. Verificado con datos reales antes de corregir.
        `SELECT rt.id, rt.code, rt.name, rt.capacity,
                COALESCE(SUM(
                  CASE WHEN rb.id IS NOT NULL
                    THEN GREATEST(0, LEAST(rb.check_out, $2::date) - GREATEST(rb.check_in, $1::date))
                    ELSE 0
                  END
                ), 0) AS occupied_bed_nights
         FROM room_types rt
         LEFT JOIN beds b ON b.room_type_id = rt.id
         LEFT JOIN reservation_beds rb ON rb.bed_id = b.id
           AND rb.check_in < $2::date AND rb.check_out > $1::date
         GROUP BY rt.id, rt.code, rt.name, rt.capacity
         ORDER BY rt.name`,
        [start, end]
      )
    ]);

    const byDay: OccupancyByDay[] = byDayResult.rows.map(r => ({
      date: r.date,
      occupiedBeds: Number(r.occupied_beds),
      totalBeds: TOTAL_BEDS,
      occupancyPercent: Math.round((Number(r.occupied_beds) / TOTAL_BEDS) * 1000) / 10
    }));

    const byRoom: OccupancyByRoom[] = byRoomResult.rows.map(r => {
      const capacityBedNights = Number(r.capacity) * days;
      const occupiedBedNights = Number(r.occupied_bed_nights);
      return {
        roomTypeId: r.id,
        code: r.code,
        name: r.name,
        capacity: Number(r.capacity),
        occupiedBedNights,
        capacityBedNights,
        occupancyPercent: capacityBedNights > 0 ? Math.round((occupiedBedNights / capacityBedNights) * 1000) / 10 : 0
      };
    });

    const totalOccupied = byRoom.reduce((sum, r) => sum + r.occupiedBedNights, 0);
    const totalCapacity = TOTAL_BEDS * days;
    const averageOccupancyPercent = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 1000) / 10 : 0;

    return { period: { month, year }, averageOccupancyPercent, byDay, byRoom };
  }

  async getRevenueStats(month: number, year: number): Promise<RevenueStats> {
    const { start, end } = monthRange(month, year);

    const { rows } = await query<{
      channel_code: string; channel_name: string; bookings: string; gross_revenue: string; net_revenue: string;
    }>(
      `SELECT c.code AS channel_code, c.name AS channel_name,
              COUNT(r.id) AS bookings,
              COALESCE(SUM(r.final_price), 0) AS gross_revenue,
              COALESCE(SUM(calculate_channel_net_revenue(r.final_price, r.channel_id)), 0) AS net_revenue
       FROM reservations r
       JOIN channels c ON c.id = r.channel_id
       WHERE r.status IN ('confirmed', 'completed')
         AND r.check_in_date >= $1::date AND r.check_in_date < $2::date
       GROUP BY c.id, c.code, c.name
       ORDER BY gross_revenue DESC`,
      [start, end]
    );

    const byChannel: ChannelRevenue[] = rows.map(r => ({
      channelCode: r.channel_code,
      channelName: r.channel_name,
      bookings: Number(r.bookings),
      grossRevenue: Number(r.gross_revenue),
      netRevenue: Number(r.net_revenue)
    }));

    return {
      period: { month, year },
      totalGrossRevenue: byChannel.reduce((sum, c) => sum + c.grossRevenue, 0),
      totalNetRevenue: byChannel.reduce((sum, c) => sum + c.netRevenue, 0),
      byChannel
    };
  }

  async getChannelStats(month: number, year: number): Promise<ChannelBookingCount[]> {
    const { start, end } = monthRange(month, year);

    const { rows } = await query<{ channel_code: string; channel_name: string; bookings: string }>(
      `SELECT c.code AS channel_code, c.name AS channel_name, COUNT(r.id) AS bookings
       FROM reservations r
       JOIN channels c ON c.id = r.channel_id
       WHERE r.check_in_date >= $1::date AND r.check_in_date < $2::date
         AND r.status != 'cancelled'
       GROUP BY c.id, c.code, c.name
       ORDER BY bookings DESC`,
      [start, end]
    );

    const total = rows.reduce((sum, r) => sum + Number(r.bookings), 0);

    return rows.map(r => ({
      channelCode: r.channel_code,
      channelName: r.channel_name,
      bookings: Number(r.bookings),
      percent: total > 0 ? Math.round((Number(r.bookings) / total) * 1000) / 10 : 0
    }));
  }

  /** "Grupo grande" = 7+ camas, mismo umbral que activa el descuento por grupo (calculate_group_discount, 0004_pricing_functions.sql). */
  async getGroupStats(month: number, year: number): Promise<GroupStats> {
    const { start, end } = monthRange(month, year);

    const { rows } = await query<{ total: string; avg_size: string | null; large_groups: string }>(
      `SELECT COUNT(*) AS total,
              AVG(beds_count) AS avg_size,
              COUNT(*) FILTER (WHERE beds_count >= 7) AS large_groups
       FROM reservations
       WHERE check_in_date >= $1::date AND check_in_date < $2::date
         AND status != 'cancelled'`,
      [start, end]
    );

    const row = rows[0];
    const totalBookings = Number(row?.total ?? 0);
    const largeGroups = Number(row?.large_groups ?? 0);

    return {
      period: { month, year },
      totalBookings,
      averageGroupSize: row?.avg_size ? Math.round(Number(row.avg_size) * 10) / 10 : 0,
      largeGroups,
      largeGroupPercent: totalBookings > 0 ? Math.round((largeGroups / totalBookings) * 1000) / 10 : 0
    };
  }
}

export const statsService = new StatsService();

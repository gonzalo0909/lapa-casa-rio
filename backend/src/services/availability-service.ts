// lapa-casa-hostel/backend/src/services/availability-service.ts
//
// REQUISITO CRITICO #6: check_availability() y get_flexible_room_status()
// (migracion 0005) son la unica fuente de verdad sobre que cama esta
// libre -- este servicio agrega el resultado por habitacion, nunca
// decide disponibilidad por su cuenta con una query propia distinta.
// La version anterior de este archivo ignoraba check_availability() por
// completo (reimplementaba el filtro de solapamiento a mano y nunca
// filtraba por genero pese a recibir el parametro).

import { query } from '../config/database';
import { logger } from '../utils/logger';
import redisClient from '../cache/redis-client';

interface BedAvailabilityRow {
  roomTypeId: string;
  roomCode: string;
  roomName: string;
  capacity: number;
  effectiveGender: string;
  bedId: string;
  bedCode: string;
  isGenderEligible: boolean;
  isOccupied: boolean;
  isAvailable: boolean;
}

const CACHE_TTL_SECONDS = 5 * 60;

export class AvailabilityService {
  /** check_availability() crudo, sin agregar -- usado por checkAvailability/checkRoomAvailability. */
  private async rawCheckAvailability(
    checkIn: string,
    checkOut: string,
    gender: 'mixed' | 'female' | 'male' = 'mixed'
  ): Promise<BedAvailabilityRow[]> {
    const cacheKey = `availability:${checkIn}:${checkOut}:${gender}`;
    const cached = await redisClient.get<BedAvailabilityRow[]>(cacheKey).catch(() => null);
    if (cached) return cached;

    const { rows } = await query(
      `SELECT * FROM check_availability($1::date, $2::date, $3::bed_gender)`,
      [checkIn, checkOut, gender]
    );
    const mapped: BedAvailabilityRow[] = rows.map((r: any) => ({
      roomTypeId: r.room_type_id,
      roomCode: r.room_code,
      roomName: r.room_name,
      capacity: r.capacity,
      effectiveGender: r.effective_gender,
      bedId: r.bed_id,
      bedCode: r.bed_code,
      isGenderEligible: r.is_gender_eligible,
      isOccupied: r.is_occupied,
      isAvailable: r.is_available
    }));
    await redisClient.set(cacheKey, mapped, CACHE_TTL_SECONDS).catch(() => undefined);
    return mapped;
  }

  /** Disponibilidad global agregada -- usada por check-availability.ts. */
  async checkAvailability(params: {
    checkIn: string;
    checkOut: string;
    bedsNeeded: number;
    gender?: 'mixed' | 'female' | 'male';
  }): Promise<{ available: boolean; availableBeds: number; alternativeDates: any[] }> {
    const rows = await this.rawCheckAvailability(params.checkIn, params.checkOut, params.gender ?? 'mixed');
    const availableBeds = rows.filter((r) => r.isGenderEligible && r.isAvailable).length;
    const available = availableBeds >= params.bedsNeeded;
    const alternativeDates = available
      ? []
      : await this.findAlternativeDates(params.checkIn, params.checkOut, params.bedsNeeded);
    return { available, availableBeds, alternativeDates };
  }

  /** Disponibilidad de UNA habitacion (room_type_id real, UUID). */
  async checkRoomAvailability(
    roomTypeId: string,
    checkIn: string,
    checkOut: string
  ): Promise<{ availableBeds: number; occupiedBeds: number }> {
    const rows = await this.rawCheckAvailability(checkIn, checkOut, 'mixed');
    const roomRows = rows.filter((r) => r.roomTypeId === roomTypeId);
    return {
      availableBeds: roomRows.filter((r) => r.isAvailable).length,
      occupiedBeds: roomRows.filter((r) => r.isOccupied).length
    };
  }

  /**
   * Camas reales (bed_code + disponibilidad) de UNA habitacion, para el
   * selector de camas específicas del frontend (elegir cama puntual en
   * vez de solo una cantidad). El genero no afecta ocupado/disponible
   * (check_availability() ya lo aisla en is_gender_eligible, que acá no
   * se usa), así que 'mixed' sirve como valor neutro igual que en
   * checkRoomAvailability().
   */
  async getRoomBeds(
    roomTypeId: string,
    checkIn: string,
    checkOut: string
  ): Promise<Array<{ bedId: string; bedCode: string; isAvailable: boolean }>> {
    const rows = await this.rawCheckAvailability(checkIn, checkOut, 'mixed');
    return rows
      .filter((r) => r.roomTypeId === roomTypeId)
      .map((r) => ({ bedId: r.bedId, bedCode: r.bedCode, isAvailable: r.isAvailable }));
  }

  /**
   * Ocupacion dia por dia de UNA habitacion real (UUID), para el detalle de
   * disponibilidad. Delega en check_availability() dia por dia -- nunca
   * reimplementa la regla de solapamiento en JS (mismo criterio del resto
   * del archivo).
   */
  async getRoomDailyOccupancy(
    roomTypeId: string,
    checkIn: string,
    checkOut: string
  ): Promise<Array<{ date: string; available: number; occupied: number }>> {
    const days: Array<{ date: string; available: number; occupied: number }> = [];
    const current = new Date(checkIn);
    const end = new Date(checkOut);

    while (current < end) {
      const dateStr = current.toISOString().slice(0, 10);
      const next = new Date(current);
      next.setDate(next.getDate() + 1);
      const nextStr = next.toISOString().slice(0, 10);

      const rows = await this.rawCheckAvailability(dateStr, nextStr, 'mixed');
      const roomRows = rows.filter((r) => r.roomTypeId === roomTypeId);
      days.push({
        date: dateStr,
        available: roomRows.filter((r) => r.isAvailable).length,
        occupied: roomRows.filter((r) => r.isOccupied).length
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  async findAlternativeDates(
    checkIn: string,
    checkOut: string,
    bedsNeeded: number
  ): Promise<Array<{ checkIn: string; checkOut: string; availableBeds: number }>> {
    const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
    const alternatives: Array<{ checkIn: string; checkOut: string; availableBeds: number }> = [];
    const base = new Date(checkIn);

    for (let offset = 1; offset <= 14 && alternatives.length < 5; offset++) {
      const altIn = new Date(base);
      altIn.setDate(altIn.getDate() + offset);
      const altOut = new Date(altIn);
      altOut.setDate(altOut.getDate() + nights);
      const altInStr = altIn.toISOString().slice(0, 10);
      const altOutStr = altOut.toISOString().slice(0, 10);

      const rows = await this.rawCheckAvailability(altInStr, altOutStr, 'mixed');
      const availableBeds = rows.filter((r) => r.isGenderEligible && r.isAvailable).length;
      if (availableBeds >= bedsNeeded) {
        alternatives.push({ checkIn: altInStr, checkOut: altOutStr, availableBeds });
      }
    }
    return alternatives;
  }

  /** get_flexible_room_status() -- conversion Flexible 7 por fecha especifica (Requisito Critico #2). */
  async getFlexibleRoomStatus(roomTypeId: string, targetDate: string): Promise<{
    effectiveGender: string;
    isConverted: boolean;
    convertedAt: string | null;
    hoursUntilCheckin: number;
    willConvertPrediction: boolean | null;
  }> {
    const { rows } = await query(
      `SELECT * FROM get_flexible_room_status($1::uuid, $2::date)`,
      [roomTypeId, targetDate]
    );
    const r = rows[0];
    return {
      effectiveGender: r.effective_gender,
      isConverted: r.is_converted,
      convertedAt: r.converted_at,
      hoursUntilCheckin: parseFloat(r.hours_until_checkin),
      willConvertPrediction: r.will_convert_prediction
    };
  }

  async getDailyOccupancy(from: string, to: string): Promise<Array<{
    date: string; occupied: number; available: number; total: number;
  }>> {
    const { rows } = await query(
      `WITH dates AS (
         SELECT generate_series($1::date, $2::date - 1, '1 day')::date AS date
       ),
       daily AS (
         SELECT d.date, COUNT(DISTINCT rb.bed_id)::int AS occupied
         FROM dates d
         LEFT JOIN reservation_beds rb
           ON daterange(rb.check_in, rb.check_out, '[)') @> d.date
         GROUP BY d.date
       ),
       total_beds AS (SELECT COUNT(*)::int AS total FROM beds WHERE is_active = true)
       SELECT daily.date::text, daily.occupied, total_beds.total
       FROM daily CROSS JOIN total_beds
       ORDER BY daily.date`,
      [from, to]
    );
    return rows.map((r: any) => ({
      date: r.date,
      occupied: parseInt(r.occupied, 10),
      total: parseInt(r.total, 10),
      available: parseInt(r.total, 10) - parseInt(r.occupied, 10)
    }));
  }

  async clearCache(): Promise<void> {
    await redisClient.delPattern('availability:*');
    logger.info('Availability cache cleared');
  }
}

export const availabilityService = new AvailabilityService();

// lapa-casa-hostel/backend/src/services/pricing-service.ts
//
// REQUISITO CRITICO #6 (prompt Maestro v1.5): las funciones SQL de
// Ventana 1 (0004_pricing_functions.sql) son la UNICA implementacion de
// las reglas de precio. Este servicio es un wrapper delgado -- nunca
// reimplementa temporada/descuentos/deposito en JS. La version anterior
// de este archivo lo hacia (constantes hardcodeadas, fechas de Carnaval
// duplicadas a mano) y quedaba desincronizada de system_config/rate_plans
// apenas alguien cambiara esas tablas sin tocar el codigo.
//
// Nota de tipado (migracion 0008): calculate_group_discount,
// calculate_final_price y calculate_deposit piden INTEGER, no SMALLINT.

import { query } from '../config/database';

interface PricingRequest {
  checkInDate: string;
  checkOutDate: string;
  rooms: Array<{ roomId: string; bedsCount: number }>;
  totalBeds: number;
}

interface PricingResponse {
  basePrice: number;
  groupDiscount: number;
  groupDiscountPercent: number;
  discountAmount: number;
  seasonMultiplier: number;
  seasonType: string;
  priceAfterDiscount: number;
  priceAfterSeason: number;
  totalPrice: number;
  depositAmount: number;
  depositPercent: number;
  remainingAmount: number;
  nights: number;
  pricePerNight: number;
  pricePerBed: number;
  breakdown: {
    bedBasePrice: number;
    nightlyRate: number;
    subtotal: number;
    discountApplied: number;
    seasonAdjustment: number;
    finalTotal: number;
  };
}

const nightsBetween = (checkIn: string, checkOut: string): number =>
  Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));

const todayDate = (): string => new Date().toISOString().slice(0, 10);

export class PricingService {
  /** Precio final via calculate_final_price() -- suma por habitacion si cada una tiene base_price distinto. */
  async calculateTotalPrice(request: PricingRequest): Promise<PricingResponse> {
    const nights = nightsBetween(request.checkInDate, request.checkOutDate);
    if (nights < 1) {
      throw new Error('La reserva debe ser de al menos 1 noche');
    }

    const bookingDate = todayDate();

    // Precio base ponderado: consulta room_types real por cada roomId solicitado.
    let basePrice = 0;
    let finalPrice = 0;
    for (const room of request.rooms) {
      const { rows } = await query<{ base_price: string }>(
        `SELECT base_price FROM room_types WHERE id = $1`,
        [room.roomId]
      );
      const roomBasePrice = rows[0] ? parseFloat(rows[0].base_price) : 60;
      basePrice += roomBasePrice * nights * room.bedsCount;

      const { rows: priceRows } = await query<{ p: string }>(
        `SELECT calculate_final_price($1::numeric, $2, $3, $4::date, $5::date) AS p`,
        [roomBasePrice, nights, room.bedsCount, request.checkInDate, bookingDate]
      );
      finalPrice += parseFloat(priceRows[0].p);
    }
    finalPrice = Math.round(finalPrice * 100) / 100;

    const groupDiscount = await this.getGroupDiscountRate(request.totalBeds);
    const seasonMultiplier = await this.getSeasonMultiplier(request.checkInDate);
    const seasonType = await this.getSeasonType(request.checkInDate);
    const minNights = await this.getMinNightsFromDb(request.checkInDate);
    if (seasonType === 'carnaval' && nights < minNights) {
      throw new Error(`Durante Carnaval se requiere minimo ${minNights} noches`);
    }

    const discountAmount = Math.round(basePrice * groupDiscount * 100) / 100;
    const priceAfterDiscount = basePrice - discountAmount;
    const priceAfterSeason = Math.round(priceAfterDiscount * seasonMultiplier * 100) / 100;

    const deposit = await this.calculateDeposit(finalPrice, request.totalBeds);

    return {
      basePrice,
      groupDiscount,
      groupDiscountPercent: groupDiscount * 100,
      discountAmount,
      seasonMultiplier,
      seasonType,
      priceAfterDiscount,
      priceAfterSeason,
      totalPrice: finalPrice,
      depositAmount: deposit.amount,
      depositPercent: deposit.percent * 100,
      remainingAmount: deposit.remaining,
      nights,
      pricePerNight: finalPrice / nights,
      pricePerBed: finalPrice / (request.totalBeds * nights),
      breakdown: {
        bedBasePrice: basePrice / (request.totalBeds * nights || 1),
        nightlyRate: basePrice / (nights || 1),
        subtotal: basePrice,
        discountApplied: discountAmount,
        seasonAdjustment: priceAfterSeason - priceAfterDiscount,
        finalTotal: finalPrice
      }
    };
  }

  async getRateForDates(roomTypeId: string, checkInDate: string, checkOutDate: string): Promise<number> {
    const { rows } = await query<{ base_price: string }>(
      `SELECT base_price FROM room_types WHERE id = $1`,
      [roomTypeId]
    );
    const basePrice = rows[0] ? parseFloat(rows[0].base_price) : 60;
    const multiplier = await this.getSeasonMultiplier(checkInDate);
    return Math.round(basePrice * multiplier * 100) / 100;
  }

  async getMinNights(checkInDate: string, _checkOutDate: string): Promise<number> {
    return this.getMinNightsFromDb(checkInDate);
  }

  private async getMinNightsFromDb(checkIn: string): Promise<number> {
    const { rows } = await query<{ get_min_nights: number }>(
      `SELECT get_min_nights($1::date) AS get_min_nights`,
      [checkIn]
    );
    return rows[0]?.get_min_nights ?? 1;
  }

  async calculateFinalPrice(
    checkInDate: string,
    checkOutDate: string,
    totalBeds: number,
    roomTypeId?: string
  ): Promise<{ totalPrice: number; depositAmount: number; remainingAmount: number; nights: number }> {
    const nights = nightsBetween(checkInDate, checkOutDate);
    let basePrice = 60;
    if (roomTypeId) {
      const { rows } = await query<{ base_price: string }>(
        `SELECT base_price FROM room_types WHERE id = $1`,
        [roomTypeId]
      );
      if (rows[0]) basePrice = parseFloat(rows[0].base_price);
    }
    const bookingDate = todayDate();
    const { rows: priceRows } = await query<{ p: string }>(
      `SELECT calculate_final_price($1::numeric, $2, $3, $4::date, $5::date) AS p`,
      [basePrice, nights, totalBeds, checkInDate, bookingDate]
    );
    const totalPrice = parseFloat(priceRows[0].p);
    const deposit = await this.calculateDeposit(totalPrice, totalBeds);
    return { totalPrice, depositAmount: deposit.amount, remainingAmount: deposit.remaining, nights };
  }

  calculateBasePrice(totalBeds: number, nights: number): number {
    return 60 * totalBeds * nights;
  }

  /** calculate_group_discount() -- nunca hardcodear los tramos en JS. */
  async calculateGroupDiscount(totalBeds: number): Promise<{ discount: number; name: string }> {
    const discount = await this.getGroupDiscountRate(totalBeds);
    return { discount, name: discount > 0 ? `${discount * 100}% de descuento por grupo` : 'Sin descuento' };
  }

  private async getGroupDiscountRate(totalBeds: number): Promise<number> {
    const { rows } = await query<{ calculate_group_discount: string }>(
      `SELECT calculate_group_discount($1) AS calculate_group_discount`,
      [totalBeds]
    );
    return parseFloat(rows[0].calculate_group_discount);
  }

  private async getSeasonMultiplier(checkIn: string): Promise<number> {
    const { rows } = await query<{ calculate_season_multiplier: string }>(
      `SELECT calculate_season_multiplier($1::date) AS calculate_season_multiplier`,
      [checkIn]
    );
    return parseFloat(rows[0].calculate_season_multiplier);
  }

  private async getSeasonType(checkIn: string): Promise<string> {
    const { rows } = await query<{ get_season_type: string }>(
      `SELECT get_season_type($1::date) AS get_season_type`,
      [checkIn]
    );
    return rows[0].get_season_type;
  }

  /** determineSeason: usado por rutas para mostrar info de temporada -- via SQL, no tabla hardcodeada. */
  async determineSeason(checkIn: string, _checkOut: string): Promise<{ type: string; multiplier: number; minNights: number }> {
    const [type, multiplier, minNights] = await Promise.all([
      this.getSeasonType(checkIn),
      this.getSeasonMultiplier(checkIn),
      this.getMinNightsFromDb(checkIn)
    ]);
    return { type, multiplier, minNights };
  }

  /** calculate_deposit() -- 30% estandar / 50% para 15+ camas, definido en SQL. */
  async calculateDeposit(totalPrice: number, totalBeds: number): Promise<{ amount: number; percent: number; remaining: number }> {
    const { rows } = await query<{ deposit_percent: string; deposit_amount: string; remaining_amount: string }>(
      `SELECT * FROM calculate_deposit($1::numeric, $2)`,
      [totalPrice, totalBeds]
    );
    return {
      amount: parseFloat(rows[0].deposit_amount),
      percent: parseFloat(rows[0].deposit_percent),
      remaining: parseFloat(rows[0].remaining_amount)
    };
  }

  /** Solo para reportes internos -- nunca se suma al precio del huesped (Requisito Critico #3). */
  async calculateChannelNetRevenue(guestPrice: number, channelId: string): Promise<number> {
    const { rows } = await query<{ calculate_channel_net_revenue: string }>(
      `SELECT calculate_channel_net_revenue($1::numeric, $2::uuid) AS calculate_channel_net_revenue`,
      [guestPrice, channelId]
    );
    return parseFloat(rows[0].calculate_channel_net_revenue);
  }

  async estimatePriceRange(
    checkInDate: string,
    checkOutDate: string,
    totalBeds: number
  ): Promise<{ minPrice: number; maxPrice: number; averagePrice: number; seasonType: string }> {
    const nights = nightsBetween(checkInDate, checkOutDate);
    const basePrice = this.calculateBasePrice(totalBeds, nights);
    const { discount } = await this.calculateGroupDiscount(totalBeds);
    const priceAfterDiscount = basePrice * (1 - discount);
    const seasonType = await this.getSeasonType(checkInDate);
    const seasonMultiplier = await this.getSeasonMultiplier(checkInDate);
    const seasonPrice = priceAfterDiscount * seasonMultiplier;

    return {
      minPrice: Math.round(priceAfterDiscount * 0.8 * 100) / 100,
      maxPrice: Math.round(priceAfterDiscount * 2.0 * 100) / 100,
      averagePrice: Math.round(seasonPrice * 100) / 100,
      seasonType
    };
  }
}

export const pricingService = new PricingService();

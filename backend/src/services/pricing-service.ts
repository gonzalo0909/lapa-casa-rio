// Las funciones SQL de 0004_pricing_functions.sql son la única implementación
// de las reglas de precio. Este servicio es un wrapper delgado -- nunca
// reimplementa temporada/descuentos/depósito en JS.
//
// Nota de tipado (migracion 0008): calculate_group_discount,
// calculate_final_price y calculate_deposit piden INTEGER, no SMALLINT.

import { query } from '../config/database';
import { getSeasonType } from './season-type';

interface PricingRequest {
  checkInDate: string;
  checkOutDate: string;
  rooms: Array<{ roomId: string; hostelBeds?: number }>;
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
}

const nightsBetween = (checkIn: string, checkOut: string): number =>
  Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));

const todayDate = (): string => new Date().toISOString().slice(0, 10);

/** La reserva pisa un período especial (special_period_rules, 0045) que exige
 *  más noches de las pedidas -- ej. mínimo 5 noches para Carnaval. */
export class MinNightsRequiredError extends Error {
  constructor(
    public readonly minNights: number,
    public readonly label: string | null,
    public readonly roomId: string,
    public readonly pricePerNight: number
  ) {
    super(
      label
        ? `${label} exige un mínimo de ${minNights} noches para esa habitación`
        : `Esas fechas exigen un mínimo de ${minNights} noches para esa habitación`
    );
    this.name = 'MinNightsRequiredError';
  }
}

export class PricingService {
  /**
   * Precio final via calculate_final_price() -- suma por habitacion (cada
   * una con su propio base_price y temporada/early-bird aplicados). El
   * descuento por grupo NO se resuelve por cuarto: depende del total de
   * camas de TODA la reserva (una reserva de 13+ personas necesariamente
   * cruza dos cuartos, ej. 12A+12B, y ningun cuarto individual ve nunca
   * ese total) -- se calcula una sola vez con calculate_group_discount()
   * y se aplica sobre la suma de todos los cuartos.
   */
  async calculateTotalPrice(request: PricingRequest): Promise<PricingResponse> {
    const nights = nightsBetween(request.checkInDate, request.checkOutDate);
    if (nights < 1) {
      throw new Error('La reserva debe ser de al menos 1 noche');
    }

    const bookingDate = todayDate();

    let basePrice = 0;
    let preDiscountTotal = 0;
    let allApartments = true;
    for (const room of request.rooms) {
      const { rows } = await query<{ base_price: string; property_type: string }>(
        `SELECT base_price, property_type FROM room_types WHERE id = $1`,
        [room.roomId]
      );
      if (!rows[0]) {throw new Error(`Tipo de cuarto no encontrado: ${room.roomId}`);}
      const isApartment = rows[0].property_type === 'apartment';
      if (!isApartment) {allApartments = false;}
      const roomBasePrice = parseFloat(rows[0].base_price);
      const beds = isApartment ? 1 : (room.hostelBeds ?? 1);
      basePrice += roomBasePrice * nights * beds;

      // Período especial (0045): pisa el precio de temporada normal para
      // esta habitación en este rango -- exige el mínimo de noches y usa
      // su propio precio por noche en vez de calculate_final_price.
      const { rows: ruleRows } = await query<{ min_nights: number; price_per_night: string; label: string | null }>(
        `SELECT * FROM get_special_period_rule($1, $2::date)`,
        [room.roomId, request.checkInDate]
      );
      const rule = ruleRows[0];

      if (rule) {
        if (nights < rule.min_nights) {
          throw new MinNightsRequiredError(rule.min_nights, rule.label, room.roomId, parseFloat(rule.price_per_night));
        }
        preDiscountTotal += parseFloat(rule.price_per_night) * nights * beds;
        continue;
      }

      const { rows: priceRows } = await query<{ p: string }>(
        `SELECT calculate_final_price($1::numeric, $2, $3, $4::date, $5::date) AS p`,
        [roomBasePrice, nights, beds, request.checkInDate, bookingDate]
      );
      preDiscountTotal += parseFloat(priceRows[0].p);
    }

    // rate_plans.min_nights (editable desde el panel admin) -- antes solo se
    // aplicaba el mínimo de special_period_rules; este mínimo genérico por
    // temporada nunca se validaba server-side, solo en el frontend
    // (getSeason() en hostel-engine.utils.ts), así que se podía saltear
    // llamando la API directo. No aplica a apartamentos (unidad completa,
    // fuera de este alcance -- mismo criterio que el descuento grupal abajo).
    if (!allApartments) {
      const { rows: seasonRows } = await query<{ min_nights: number; description: string | null }>(
        `SELECT min_nights, description FROM rate_plans WHERE season_type = get_season_type($1::date)`,
        [request.checkInDate]
      );
      const seasonMinNights = seasonRows[0]?.min_nights ?? 1;
      if (seasonMinNights > 1 && nights < seasonMinNights) {
        throw new MinNightsRequiredError(
          seasonMinNights,
          seasonRows[0]?.description ?? null,
          request.rooms[0]?.roomId ?? '',
          0,
        );
      }
    }

    // Apartamentos se reservan como unidad completa — descuento grupal no aplica.
    const groupDiscount = allApartments ? 0 : await this.getGroupDiscountRate(request.totalBeds);
    const discountAmount = Math.round(preDiscountTotal * groupDiscount * 100) / 100;
    const finalPrice = Math.round((preDiscountTotal - discountAmount) * 100) / 100;

    const seasonMultiplier = await this.getSeasonMultiplier(request.checkInDate);
    const seasonType = await getSeasonType(request.checkInDate);

    // preDiscountTotal ya incorpora temporada + early bird (vía SQL calculate_final_price).
    // priceAfterSeason = ese total pre-descuento de grupo; priceAfterDiscount = total real.
    const priceAfterSeason = preDiscountTotal;
    const priceAfterDiscount = finalPrice;

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
    };
  }

  async getRateForDates(roomTypeId: string, checkInDate: string): Promise<number> {
    const { rows } = await query<{ base_price: string }>(
      `SELECT base_price FROM room_types WHERE id = $1`,
      [roomTypeId]
    );
    if (!rows[0]) {throw new Error(`Tipo de cuarto no encontrado: ${roomTypeId}`);}
    const basePrice = parseFloat(rows[0].base_price);
    const multiplier = await this.getSeasonMultiplier(checkInDate);
    return Math.round(basePrice * multiplier * 100) / 100;
  }

  /** calculate_group_discount() -- nunca hardcodear los tramos en JS; los tramos viven en group_discount_tiers, editables desde el admin. */
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

  /** determineSeason: usado por rutas para mostrar info de temporada -- via SQL, no tabla hardcodeada. */
  async determineSeason(checkIn: string): Promise<{ type: string; multiplier: number }> {
    const [type, multiplier] = await Promise.all([
      getSeasonType(checkIn),
      this.getSeasonMultiplier(checkIn),
    ]);
    return { type, multiplier };
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
}

export const pricingService = new PricingService();

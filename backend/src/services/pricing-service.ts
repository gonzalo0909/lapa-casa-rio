// lapa-casa-hostel/backend/src/services/pricing-service.ts

import { parseISO, differenceInDays, getMonth } from 'date-fns';
import { logger } from '../utils/logger';
import { AppError } from '../utils/responses';

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
  seasonType: 'low' | 'medium' | 'high' | 'carnival';
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

interface SeasonConfig {
  type: 'low' | 'medium' | 'high' | 'carnival';
  multiplier: number;
  months?: number[];
  specificDates?: Array<{ start: string; end: string }>;
  minNights?: number;
}

export class PricingService {
  private readonly BASE_PRICE_PER_BED = 60.00;

  private readonly GROUP_DISCOUNTS = [
    { minBeds: 26, discount: 0.20, name: '20% - Grupos 26+' },
    { minBeds: 16, discount: 0.15, name: '15% - Grupos 16-25' },
    { minBeds: 7, discount: 0.10, name: '10% - Grupos 7-15' }
  ];

  private readonly SEASON_CONFIG: SeasonConfig[] = [
    {
      type: 'carnival',
      multiplier: 2.00,
      specificDates: [
        { start: '2025-02-28', end: '2025-03-05' },
        { start: '2026-02-13', end: '2026-02-18' },
        { start: '2027-02-05', end: '2027-02-10' }
      ],
      minNights: 5
    },
    { type: 'high', multiplier: 1.50, months: [11, 0, 1, 2] },
    { type: 'low', multiplier: 0.80, months: [5, 6, 7, 8] },
    { type: 'medium', multiplier: 1.00, months: [3, 4, 9, 10] }
  ];

  private readonly DEPOSIT_RULES = {
    standard: 0.30,
    largeGroup: 0.50,
    threshold: 15
  };

  async calculateTotalPrice(request: PricingRequest): Promise<PricingResponse> {
    try {
      const checkIn = parseISO(request.checkInDate);
      const checkOut = parseISO(request.checkOutDate);
      const nights = differenceInDays(checkOut, checkIn);

      if (nights < 1) {
        throw new AppError('La reserva debe ser de al menos 1 noche', 400);
      }

      const basePrice = this.BASE_PRICE_PER_BED * request.totalBeds * nights;
      const groupDiscountData = this.calculateGroupDiscount(request.totalBeds);
      const discountAmount = basePrice * groupDiscountData.discount;
      const priceAfterDiscount = basePrice - discountAmount;

      const seasonData = this.determineSeason(request.checkInDate, request.checkOutDate);

      if (seasonData.type === 'carnival' && nights < (seasonData.minNights || 5)) {
        throw new AppError(`Durante Carnaval se requiere mínimo ${seasonData.minNights} noches`, 400);
      }

      const priceAfterSeason = priceAfterDiscount * seasonData.multiplier;
      const totalPrice = Math.round(priceAfterSeason * 100) / 100;

      const depositData = this.calculateDeposit(totalPrice, request.totalBeds);

      const breakdown = {
        bedBasePrice: this.BASE_PRICE_PER_BED,
        nightlyRate: this.BASE_PRICE_PER_BED * request.totalBeds,
        subtotal: basePrice,
        discountApplied: discountAmount,
        seasonAdjustment: priceAfterSeason - priceAfterDiscount,
        finalTotal: totalPrice
      };

      return {
        basePrice,
        groupDiscount: groupDiscountData.discount,
        groupDiscountPercent: groupDiscountData.discount * 100,
        discountAmount,
        seasonMultiplier: seasonData.multiplier,
        seasonType: seasonData.type,
        priceAfterDiscount,
        priceAfterSeason,
        totalPrice,
        depositAmount: depositData.amount,
        depositPercent: depositData.percent * 100,
        remainingAmount: depositData.remaining,
        nights,
        pricePerNight: totalPrice / nights,
        pricePerBed: totalPrice / (request.totalBeds * nights),
        breakdown
      };
    } catch (error) {
      logger.error('Error calculando pricing', error);
      throw error;
    }
  }

  calculateBasePrice(totalBeds: number, nights: number): number {
    return this.BASE_PRICE_PER_BED * totalBeds * nights;
  }

  calculateGroupDiscount(totalBeds: number): { discount: number; name: string; appliedTier?: string } {
    for (const tier of this.GROUP_DISCOUNTS) {
      if (totalBeds >= tier.minBeds) {
        return {
          discount: tier.discount,
          name: tier.name,
          appliedTier: `${tier.minBeds}+ beds`
        };
      }
    }
    return { discount: 0, name: 'Sin descuento', appliedTier: 'Individual booking' };
  }

  determineSeason(checkInDate: string, checkOutDate: string): SeasonConfig {
    const checkIn = parseISO(checkInDate);
    const checkOut = parseISO(checkOutDate);

    for (const config of this.SEASON_CONFIG) {
      if (config.type === 'carnival' && config.specificDates) {
        for (const period of config.specificDates) {
          const periodStart = parseISO(period.start);
          const periodEnd = parseISO(period.end);
          if (
            (checkIn >= periodStart && checkIn <= periodEnd) ||
            (checkOut >= periodStart && checkOut <= periodEnd) ||
            (checkIn <= periodStart && checkOut >= periodEnd)
          ) {
            return config;
          }
        }
      }
    }

    const checkInMonth = getMonth(checkIn);
    for (const config of this.SEASON_CONFIG) {
      if (config.months && config.months.includes(checkInMonth)) {
        return config;
      }
    }

    return { type: 'medium', multiplier: 1.00 };
  }

  calculateDeposit(totalPrice: number, totalBeds: number): { amount: number; percent: number; remaining: number } {
    const percent = totalBeds >= this.DEPOSIT_RULES.threshold
      ? this.DEPOSIT_RULES.largeGroup
      : this.DEPOSIT_RULES.standard;

    const amount = Math.round(totalPrice * percent * 100) / 100;
    const remaining = Math.round((totalPrice - amount) * 100) / 100;

    return { amount, percent, remaining };
  }

  getSeasonInfo(): SeasonConfig[] {
    return this.SEASON_CONFIG;
  }

  getGroupDiscountTiers(): typeof this.GROUP_DISCOUNTS {
    return this.GROUP_DISCOUNTS;
  }

  async estimatePriceRange(
    checkInDate: string,
    checkOutDate: string,
    totalBeds: number
  ): Promise<{ minPrice: number; maxPrice: number; averagePrice: number; seasonType: string }> {
    const checkIn = parseISO(checkInDate);
    const checkOut = parseISO(checkOutDate);
    const nights = differenceInDays(checkOut, checkIn);

    const basePrice = this.calculateBasePrice(totalBeds, nights);
    const groupDiscount = this.calculateGroupDiscount(totalBeds);
    const priceAfterDiscount = basePrice * (1 - groupDiscount.discount);
    const season = this.determineSeason(checkInDate, checkOutDate);
    const seasonPrice = priceAfterDiscount * season.multiplier;

    return {
      minPrice: Math.round(priceAfterDiscount * 0.80 * 100) / 100,
      maxPrice: Math.round(priceAfterDiscount * 2.00 * 100) / 100,
      averagePrice: Math.round(seasonPrice * 100) / 100,
      seasonType: season.type
    };
  }
}

// lapa-casa-hostel/backend/src/lib/pricing/seasonal-pricing.ts

import { differenceInDays, format, isSameDay, parseISO } from 'date-fns';

interface Season {
  name: string;
  multiplier: number;
  months: number[];
  minNights?: number;
  description: string;
}

interface SeasonalPrice {
  basePrice: number;
  season: Season;
  multiplier: number;
  adjustedPrice: number;
  nightsCount: number;
  totalPrice: number;
}

interface CarnivalPeriod {
  startDate: Date;
  endDate: Date;
  year: number;
}

interface SeasonalBreakdown {
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  seasons: Array<{
    seasonName: string;
    nights: number;
    basePrice: number;
    multiplier: number;
    subtotal: number;
  }>;
  totalBasePrice: number;
  totalAdjustedPrice: number;
  averageMultiplier: number;
}

const SEASONS: Season[] = [
  {
    name: 'high',
    multiplier: 1.50,
    months: [12, 1, 2, 3],
    description: 'High Season (Dec-Mar)'
  },
  {
    name: 'medium',
    multiplier: 1.00,
    months: [4, 5, 10, 11],
    description: 'Medium Season (Apr-May, Oct-Nov)'
  },
  {
    name: 'low',
    multiplier: 0.80,
    months: [6, 7, 8, 9],
    description: 'Low Season (Jun-Sep)'
  },
  {
    name: 'carnival',
    multiplier: 2.00,
    minNights: 5,
    months: [2],
    description: 'Carnival (February - 5 night minimum)'
  }
];

const CARNIVAL_DATES: Record<number, CarnivalPeriod> = {
  2025: {
    startDate: new Date('2025-02-28'),
    endDate: new Date('2025-03-05'),
    year: 2025
  },
  2026: {
    startDate: new Date('2026-02-13'),
    endDate: new Date('2026-02-18'),
    year: 2026
  },
  2027: {
    startDate: new Date('2027-02-05'),
    endDate: new Date('2027-02-10'),
    year: 2027
  }
};

export class SeasonalPricingCalculator {
  private readonly BASE_PRICE_PER_BED = 60.00;

  calculateSeasonalPrice(
    checkInDate: Date | string,
    checkOutDate: Date | string,
    basePricePerBed?: number
  ): SeasonalPrice {
    const checkIn = typeof checkInDate === 'string' ? parseISO(checkInDate) : checkInDate;
    const checkOut = typeof checkOutDate === 'string' ? parseISO(checkOutDate) : checkOutDate;
    const basePrice = basePricePerBed || this.BASE_PRICE_PER_BED;

    const nightsCount = differenceInDays(checkOut, checkIn);

    if (nightsCount < 1) {
      throw new Error('Check-out date must be at least 1 day after check-in date');
    }

    const season = this.getSeason(checkIn, checkOut);
    const multiplier = season.multiplier;
    const adjustedPrice = basePrice * multiplier;
    const totalPrice = adjustedPrice * nightsCount;

    return {
      basePrice,
      season,
      multiplier,
      adjustedPrice,
      nightsCount,
      totalPrice
    };
  }

  private getSeason(checkInDate: Date, checkOutDate: Date): Season {
    if (this.isCarnivalPeriod(checkInDate, checkOutDate)) {
      const nightsCount = differenceInDays(checkOutDate, checkInDate);
      const carnivalSeason = SEASONS.find(s => s.name === 'carnival')!;
      
      if (nightsCount >= (carnivalSeason.minNights || 0)) {
        return carnivalSeason;
      }
    }

    const month = checkInDate.getMonth() + 1;
    
    for (const season of SEASONS) {
      if (season.name !== 'carnival' && season.months.includes(month)) {
        return season;
      }
    }

    return SEASONS.find(s => s.name === 'medium')!;
  }

  private isCarnivalPeriod(checkInDate: Date, checkOutDate: Date): boolean {
    const year = checkInDate.getFullYear();
    const carnival = CARNIVAL_DATES[year];

    if (!carnival) {
      return false;
    }

    return (
      checkInDate <= carnival.endDate &&
      checkOutDate >= carnival.startDate
    );
  }

  calculateMultiSeasonPrice(
    checkInDate: Date | string,
    checkOutDate: Date | string,
    basePricePerBed?: number
  ): SeasonalBreakdown {
    const checkIn = typeof checkInDate === 'string' ? parseISO(checkInDate) : checkInDate;
    const checkOut = typeof checkOutDate === 'string' ? parseISO(checkOutDate) : checkOutDate;
    const basePrice = basePricePerBed || this.BASE_PRICE_PER_BED;

    const totalNights = differenceInDays(checkOut, checkIn);
    const breakdown: SeasonalBreakdown = {
      checkInDate: checkIn,
      checkOutDate: checkOut,
      nights: totalNights,
      seasons: [],
      totalBasePrice: 0,
      totalAdjustedPrice: 0,
      averageMultiplier: 1.0
    };

    let currentDate = new Date(checkIn);
    const seasonGroups = new Map<string, number>();

    while (currentDate < checkOut) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const season = this.getSeason(currentDate, nextDate);
      const seasonKey = season.name;

      seasonGroups.set(seasonKey, (seasonGroups.get(seasonKey) || 0) + 1);
      currentDate = nextDate;
    }

    for (const [seasonName, nights] of seasonGroups) {
      const season = SEASONS.find(s => s.name === seasonName)!;
      const subtotal = basePrice * season.multiplier * nights;

      breakdown.seasons.push({
        seasonName: season.description,
        nights,
        basePrice,
        multiplier: season.multiplier,
        subtotal
      });

      breakdown.totalBasePrice += basePrice * nights;
      breakdown.totalAdjustedPrice += subtotal;
    }

    breakdown.averageMultiplier = breakdown.totalBasePrice > 0
      ? breakdown.totalAdjustedPrice / breakdown.totalBasePrice
      : 1.0;

    return breakdown;
  }

  getSeasonInfo(date: Date | string): Season {
    const checkDate = typeof date === 'string' ? parseISO(date) : date;
    const nextDay = new Date(checkDate);
    nextDay.setDate(nextDay.getDate() + 1);

    return this.getSeason(checkDate, nextDay);
  }

  getCarnivalDates(year: number): CarnivalPeriod | null {
    return CARNIVAL_DATES[year] || null;
  }

  isCarnivalDate(date: Date | string): boolean {
    const checkDate = typeof date === 'string' ? parseISO(date) : date;
    const year = checkDate.getFullYear();
    const carnival = CARNIVAL_DATES[year];

    if (!carnival) {
      return false;
    }

    return checkDate >= carnival.startDate && checkDate <= carnival.endDate;
  }

  validateCarnivalBooking(checkInDate: Date, checkOutDate: Date): {
    isValid: boolean;
    errors: string[];
    requiredNights: number;
    actualNights: number;
  } {
    const errors: string[] = [];
    const carnivalSeason = SEASONS.find(s => s.name === 'carnival')!;
    const requiredNights = carnivalSeason.minNights || 5;
    const actualNights = differenceInDays(checkOutDate, checkInDate);

    if (this.isCarnivalPeriod(checkInDate, checkOutDate)) {
      if (actualNights < requiredNights) {
        errors.push(
          `Carnival bookings require a minimum of ${requiredNights} nights. Current booking: ${actualNights} nights.`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      requiredNights,
      actualNights
    };
  }

  getSeasonalRecommendation(
    requestedDate: Date,
    nightsCount: number
  ): {
    requestedSeason: Season;
    requestedPrice: number;
    alternatives: Array<{
      season: Season;
      suggestedDate: Date;
      price: number;
      savings: number;
      savingsPercentage: number;
    }>;
  } {
    const requestedSeason = this.getSeasonInfo(requestedDate);
    const checkOutDate = new Date(requestedDate);
    checkOutDate.setDate(checkOutDate.getDate() + nightsCount);
    
    const requestedCalc = this.calculateSeasonalPrice(requestedDate, checkOutDate);
    const requestedPrice = requestedCalc.totalPrice;

    const alternatives = [];
    const lowSeason = SEASONS.find(s => s.name === 'low')!;

    for (let monthOffset = 1; monthOffset <= 6; monthOffset++) {
      const altDate = new Date(requestedDate);
      altDate.setMonth(altDate.getMonth() + monthOffset);
      
      const altSeason = this.getSeasonInfo(altDate);
      
      if (altSeason.multiplier < requestedSeason.multiplier) {
        const altCheckOut = new Date(altDate);
        altCheckOut.setDate(altCheckOut.getDate() + nightsCount);
        
        const altCalc = this.calculateSeasonalPrice(altDate, altCheckOut);
        const savings = requestedPrice - altCalc.totalPrice;
        const savingsPercentage = (savings / requestedPrice) * 100;

        alternatives.push({
          season: altSeason,
          suggestedDate: altDate,
          price: altCalc.totalPrice,
          savings,
          savingsPercentage
        });
      }
    }

    alternatives.sort((a, b) => b.savings - a.savings);

    return {
      requestedSeason,
      requestedPrice,
      alternatives: alternatives.slice(0, 3)
    };
  }

  static getSeasons(): Season[] {
    return SEASONS;
  }

  static getCarnivalYears(): number[] {
    return Object.keys(CARNIVAL_DATES).map(Number);
  }

  formatSeasonalPrice(seasonalPrice: SeasonalPrice): {
    basePriceFormatted: string;
    adjustedPriceFormatted: string;
    totalPriceFormatted: string;
    multiplierFormatted: string;
    seasonName: string;
  } {
    return {
      basePriceFormatted: `R$ ${seasonalPrice.basePrice.toFixed(2)}`,
      adjustedPriceFormatted: `R$ ${seasonalPrice.adjustedPrice.toFixed(2)}`,
      totalPriceFormatted: `R$ ${seasonalPrice.totalPrice.toFixed(2)}`,
      multiplierFormatted: `${(seasonalPrice.multiplier * 100).toFixed(0)}%`,
      seasonName: seasonalPrice.season.description
    };
  }
}

export const seasonalPricingCalculator = new SeasonalPricingCalculator();
